const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Helper function to log stat changes
async function logStatChange(userId, statType, value) {
  try {
    await db.query(
      'INSERT INTO user_stat_history (user_id, stat_type, value) VALUES ($1, $2, $3)',
      [userId, statType, value]
    );
  } catch (error) {
    console.error('Error logging stat change:', error);
  }
}

// Helper function to calculate and log profit/loss percentage and value
async function calculateAndLogProfitLoss(userId) {
  try {
    // Get total investment
    const investmentRes = await db.query(`
      SELECT COALESCE(SUM((COALESCE(c.purchase_price,0) + COALESCE(c.grading_cost,0)) * c.quantity), 0) AS total_investment
      FROM collections c
      WHERE c.user_id = $1
    `, [userId]);
    
    const totalInvestment = parseFloat(investmentRes.rows[0].total_investment) || 0;
    
    if (totalInvestment > 0) {
      // Get total market value
      const marketRes = await db.query(`
        SELECT COALESCE(SUM(ph.price * c.quantity), 0) AS total_market_value
        FROM collections c
        JOIN products p ON c.product_id = p.id
        LEFT JOIN (
          SELECT DISTINCT ON (product_id, grading_company, grade, condition)
            product_id, grading_company, grade, condition, price
          FROM price_history 
          WHERE source = 'ebay_api'
          ORDER BY product_id, grading_company, grade, condition, date_recorded DESC
        ) ph ON p.id = ph.product_id
         AND COALESCE(c.grading_company, '') = COALESCE(ph.grading_company, '')
         AND COALESCE(c.grade, '') = COALESCE(ph.grade, '')
         AND COALESCE(c.condition, '') = COALESCE(ph.condition, '')
        WHERE c.user_id = $1
      `, [userId]);
      
      const totalMarketValue = parseFloat(marketRes.rows[0].total_market_value) || 0;
      
      // Calculate profit/loss percentage and value
      const profitLossPct = ((totalMarketValue - totalInvestment) / totalInvestment) * 100;
      const profitLossValue = totalMarketValue - totalInvestment;
      
      // Log the profit/loss percentage and value
      await logStatChange(userId, 'profit_loss_pct', profitLossPct);
      await logStatChange(userId, 'lifetime_profit_loss_value', profitLossValue);
    }
  } catch (error) {
    console.error('Error calculating profit/loss:', error);
  }
}

// Get user's collection with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', set = '', product_type = '' } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = 'WHERE c.user_id = $1';
    const params = [req.user.userId];
    let paramIndex = 2;

    if (search) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.set_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (set) {
      whereClause += ` AND p.set_name = $${paramIndex}`;
      params.push(set);
      paramIndex++;
    }

    if (product_type) {
      whereClause += ` AND p.product_type = $${paramIndex}`;
      params.push(product_type);
      paramIndex++;
    }

    // Get collection items with product details
    const collectionQuery = `
      SELECT 
        c.*, 
        p.name, p.product_type, p.set_name, p.set_code, p.card_number, p.rarity,
        p.image_url, p.description,
        p.card_type, p.pokemon_type, p.hp, p.artist, p.release_date,
        p.sealed, p.box_type, p.pack_count,
        ph.price as current_market_price,
        ph.date_recorded as market_price_date
      FROM collections c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id, grading_company, grade, condition)
          product_id, grading_company, grade, condition, price, date_recorded
        FROM price_history 
        WHERE source = 'ebay_api'
        ORDER BY product_id, grading_company, grade, condition, date_recorded DESC
      ) ph ON p.id = ph.product_id
       AND COALESCE(c.grading_company, '') = COALESCE(ph.grading_company, '')
       AND COALESCE(c.grade, '') = COALESCE(ph.grade, '')
       AND COALESCE(c.condition, '') = COALESCE(ph.condition, '')
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const collection = await db.query(collectionQuery, [...params, limit, offset]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) 
      FROM collections c
      JOIN products p ON c.product_id = p.id
      ${whereClause}
    `;
    const totalCount = await db.query(countQuery, params);

    res.json({
      collection: collection.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount.rows[0].count / limit),
        totalItems: parseInt(totalCount.rows[0].count),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add product to collection
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      product_id, quantity = 1, purchase_price, purchase_date, notes,
      grading_company, grade, condition,
      grading_status, raw_card_cost, grading_cost, predicted_grade
    } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Check if product exists
    const product = await db.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Determine grading_status
    let finalGradingStatus = grading_status;
    if (!finalGradingStatus) {
      if (product.rows[0].product_type === 'graded_card' || grade || grading_company) {
        finalGradingStatus = 'graded';
      } else {
        finalGradingStatus = 'raw';
      }
    }

    // If being graded, override
    if (grading_status === 'grading') {
      finalGradingStatus = 'grading';
    }

    // Check if already in collection (match on user_id, product_id, grading_status, grade, grading_company, condition)
    const existingItem = await db.query(
      `SELECT * FROM collections
       WHERE user_id = $1 AND product_id = $2
         AND COALESCE(grading_status, '') = $3
         AND COALESCE(grade, '') = $4
         AND COALESCE(grading_company, '') = $5
         AND COALESCE(condition, '') = $6`,
      [
        req.user.userId,
        product_id,
        finalGradingStatus || '',
        grade || '',
        grading_company || '',
        condition || ''
      ]
    );

    if (existingItem.rows.length > 0) {
      // Get the old investment amount before update
      const oldInvestment = (parseFloat(existingItem.rows[0].purchase_price) || 0) * (parseInt(existingItem.rows[0].quantity) || 1);
      
      // Update existing item
      const updatedItem = await db.query(`
        UPDATE collections 
        SET quantity = quantity + $1, 
            purchase_price = COALESCE($2, purchase_price),
            purchase_date = COALESCE($3, purchase_date),
            notes = COALESCE($4, notes),
            grading_company = COALESCE($5, grading_company),
            grade = COALESCE($6, grade),
            condition = COALESCE($7, condition),
            grading_status = COALESCE($8, grading_status),
            raw_card_cost = COALESCE($9, raw_card_cost),
            grading_cost = COALESCE($10, grading_cost),
            predicted_grade = COALESCE($11, predicted_grade),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $12 AND product_id = $13
        RETURNING *
      `, [
        quantity, purchase_price, purchase_date, notes, grading_company, grade, condition,
        finalGradingStatus, raw_card_cost, grading_cost, predicted_grade,
        req.user.userId, product_id
      ]);

      // Calculate new investment amount
      const newInvestment = (parseFloat(updatedItem.rows[0].purchase_price) || 0) * (parseInt(updatedItem.rows[0].quantity) || 1);
      const investmentDifference = newInvestment - oldInvestment;
      
      // Update lifetime_earnings if there's a difference
      if (investmentDifference !== 0) {
        await db.query(
          'UPDATE users SET lifetime_earnings = lifetime_earnings - $1 WHERE id = $2',
          [investmentDifference, req.user.userId]
        );
        
        // Log the lifetime earnings change
        await logStatChange(req.user.userId, 'lifetime_earnings', -investmentDifference);
        
        // Calculate and log profit/loss percentage
        await calculateAndLogProfitLoss(req.user.userId);
      }

      res.json({
        message: 'Collection item updated successfully',
        item: updatedItem.rows[0]
      });
    } else {
      // Add new item
      const newItem = await db.query(`
        INSERT INTO collections (
          user_id, product_id, quantity, purchase_price, purchase_date, notes, grading_company, grade, condition,
          grading_status, raw_card_cost, grading_cost, predicted_grade
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        req.user.userId, product_id, quantity, purchase_price, purchase_date, notes, grading_company, grade, condition,
        finalGradingStatus, raw_card_cost, grading_cost, predicted_grade
      ]);

      // Calculate total investment for new item
      const totalInvestment = (parseFloat(purchase_price) || 0) * quantity;
      
      // Subtract from lifetime_earnings (money spent)
      if (totalInvestment > 0) {
        await db.query(
          'UPDATE users SET lifetime_earnings = lifetime_earnings - $1 WHERE id = $2',
          [totalInvestment, req.user.userId]
        );
        
        // Log the lifetime earnings change
        await logStatChange(req.user.userId, 'lifetime_earnings', -totalInvestment);
        
        // Calculate and log profit/loss percentage
        await calculateAndLogProfitLoss(req.user.userId);
      }

      res.status(201).json({
        message: 'Product added to collection successfully',
        item: newItem.rows[0]
      });
    }
  } catch (error) {
    console.error('Add to collection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update collection item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      quantity, purchase_price, purchase_date, notes, is_for_sale, asking_price,
      grading_company, grade, condition,
      grading_status, raw_card_cost, grading_cost, predicted_grade
    } = req.body;

    // Check if item exists and belongs to user
    const existingItem = await db.query(
      'SELECT * FROM collections WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );

    if (existingItem.rows.length === 0) {
      return res.status(404).json({ error: 'Collection item not found' });
    }

    // Determine grading_status
    let finalGradingStatus = grading_status;
    if (!finalGradingStatus) {
      if (grade || grading_company) {
        finalGradingStatus = 'graded';
      } else {
        finalGradingStatus = existingItem.rows[0].grading_status || 'raw';
      }
    }
    if (grading_status === 'grading') {
      finalGradingStatus = 'grading';
    }

    // Update item
    const updatedItem = await db.query(`
      UPDATE collections 
      SET quantity = COALESCE($1, quantity),
          purchase_price = COALESCE($2, purchase_price),
          purchase_date = COALESCE($3, purchase_date),
          notes = COALESCE($4, notes),
          is_for_sale = COALESCE($5, is_for_sale),
          asking_price = COALESCE($6, asking_price),
          grading_company = COALESCE($7, grading_company),
          grade = COALESCE($8, grade),
          condition = COALESCE($9, condition),
          grading_status = COALESCE($10, grading_status),
          raw_card_cost = COALESCE($11, raw_card_cost),
          grading_cost = COALESCE($12, grading_cost),
          predicted_grade = COALESCE($13, predicted_grade),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $14 AND user_id = $15
      RETURNING *
    `, [
      quantity, purchase_price, purchase_date, notes, is_for_sale, asking_price,
      grading_company, grade, condition,
      finalGradingStatus, raw_card_cost, grading_cost, predicted_grade,
      id, req.user.userId
    ]);

    res.json({
      message: 'Collection item updated successfully',
      item: updatedItem.rows[0]
    });
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove product from collection
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { sold_price } = req.body; // Accept sold_price in request body

    // Check if item exists and belongs to user
    const existingItem = await db.query(
      'SELECT * FROM collections WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );

    if (existingItem.rows.length === 0) {
      return res.status(404).json({ error: 'Collection item not found' });
    }

    // Calculate the total investment for this item
    const investment = (parseFloat(existingItem.rows[0].purchase_price) || 0) * (existingItem.rows[0].quantity || 1);

    // If sold_price is provided, update user's lifetime_earnings with sale price only
    if (sold_price !== undefined && sold_price !== null && sold_price !== '') {
      const saleAmount = parseFloat(sold_price);
      await db.query(
        'UPDATE users SET lifetime_earnings = lifetime_earnings + $1 WHERE id = $2',
        [saleAmount, req.user.userId]
      );
      // Log the lifetime earnings change
      await logStatChange(req.user.userId, 'lifetime_earnings', saleAmount);
      // Log the new total lifetime_earnings value for history
      const newEarningsRes = await db.query('SELECT lifetime_earnings FROM users WHERE id = $1', [req.user.userId]);
      const newEarnings = parseFloat(newEarningsRes.rows[0]?.lifetime_earnings) || 0;
      await logStatChange(req.user.userId, 'lifetime_earnings', newEarnings);
      // Calculate and log profit/loss percentage
      await calculateAndLogProfitLoss(req.user.userId);
    } else {
      // No sold_price provided - item was added by mistake, add investment back to lifetime_earnings
      if (investment > 0) {
        await db.query(
          'UPDATE users SET lifetime_earnings = lifetime_earnings + $1 WHERE id = $2',
          [investment, req.user.userId]
        );
        // Log the lifetime earnings change (money returned)
        await logStatChange(req.user.userId, 'lifetime_earnings', investment);
        // Log the new total lifetime_earnings value for history
        const newEarningsRes = await db.query('SELECT lifetime_earnings FROM users WHERE id = $1', [req.user.userId]);
        const newEarnings = parseFloat(newEarningsRes.rows[0]?.lifetime_earnings) || 0;
        await logStatChange(req.user.userId, 'lifetime_earnings', newEarnings);
        // Calculate and log profit/loss percentage
        await calculateAndLogProfitLoss(req.user.userId);
      }
    }

    // Delete item
    await db.query('DELETE FROM collections WHERE id = $1 AND user_id = $2', [id, req.user.userId]);

    res.json({ message: 'Product removed from collection successfully' });
  } catch (error) {
    console.error('Remove from collection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get collection statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Total cards (sum of card quantities)
    const totalCardsRes = await db.query(`
      SELECT COALESCE(SUM(c.quantity), 0) AS total_cards
      FROM collections c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1 AND p.product_type = 'card'
    `, [req.user.userId]);

    // Total quantity (sum of sealed product quantities)
    const totalQuantityRes = await db.query(`
      SELECT COALESCE(SUM(c.quantity), 0) AS total_quantity
      FROM collections c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1 AND p.product_type = 'sealed_product'
    `, [req.user.userId]);

    // Total investment (all products)
    const totalInvestmentRes = await db.query(`
      SELECT COALESCE(SUM((COALESCE(c.purchase_price,0) + COALESCE(c.grading_cost,0)) * c.quantity), 0) AS total_investment
      FROM collections c
      WHERE c.user_id = $1
    `, [req.user.userId]);

    // Get user's lifetime earnings
    const userRes = await db.query(
      'SELECT lifetime_earnings FROM users WHERE id = $1',
      [req.user.userId]
    );

    // Average purchase price (all products)
    const avgPriceRes = await db.query(`
      SELECT AVG(c.purchase_price) AS avg_purchase_price
      FROM collections c
      WHERE c.user_id = $1
    `, [req.user.userId]);

    // Items for sale
    const itemsForSaleRes = await db.query(`
      SELECT COUNT(*) AS items_for_sale
      FROM collections c
      WHERE c.user_id = $1 AND c.is_for_sale = true
    `, [req.user.userId]);

    res.json({
      basicStats: {
        total_cards: parseInt(totalCardsRes.rows[0].total_cards, 10) || 0,
        total_quantity: parseInt(totalQuantityRes.rows[0].total_quantity, 10) || 0,
        total_investment: parseFloat(totalInvestmentRes.rows[0].total_investment) || 0,
        lifetime_earnings: parseFloat(userRes.rows[0]?.lifetime_earnings) || 0,
        avg_purchase_price: parseFloat(avgPriceRes.rows[0].avg_purchase_price) || 0,
        items_for_sale: parseInt(itemsForSaleRes.rows[0].items_for_sale, 10) || 0
      }
    });
  } catch (error) {
    console.error('Get collection stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user stat history for graphs
router.get('/stat-history', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        stat_type,
        value,
        created_at as date
      FROM user_stat_history 
      WHERE user_id = $1 
      ORDER BY created_at ASC
    `, [req.user.userId]);

    // Transform data for frontend charts
    const transformedData = result.rows.map(row => ({
      date: row.date,
      [row.stat_type]: parseFloat(row.value) || 0
    }));

    res.json(transformedData);
  } catch (error) {
    console.error('Get stat history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available sets from user's collection
router.get('/sets', authenticateToken, async (req, res) => {
  try {
    const setsQuery = `
      SELECT DISTINCT p.set_name
      FROM collections c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1 AND p.set_name IS NOT NULL AND p.set_name != ''
      ORDER BY p.set_name
    `;
    
    const sets = await db.query(setsQuery, [req.user.userId]);
    
    res.json({ sets: sets.rows });
  } catch (error) {
    console.error('Get sets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new trade
router.post('/trades', authenticateToken, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { traded_away, received, cash_delta } = req.body;
    if (!Array.isArray(traded_away) || !Array.isArray(received)) {
      return res.status(400).json({ error: 'traded_away and received must be arrays' });
    }
    
    await client.query('BEGIN');
    
    // Insert trade
    const result = await client.query(
      `INSERT INTO trades (user_id, traded_away, received, cash_delta)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.userId, JSON.stringify(traded_away), JSON.stringify(received), cash_delta || 0]
    );
    
    // Calculate total investment and market value of traded_away items
    const tradedAwayInvestment = traded_away.reduce((sum, item) => 
      sum + ((parseFloat(item.purchase_price) || 0) * (item.quantity || 1)), 0);
    const tradedAwayMarketValue = traded_away.reduce((sum, item) => 
      sum + ((parseFloat(item.market_price) || 0) * (item.quantity || 1)), 0);
    
    // Calculate total market value of received items
    const receivedMarketValue = received.reduce((sum, item) => 
      sum + ((parseFloat(item.market_price) || 0) * (item.quantity || 1)), 0);
    
    // Remove/decrement traded_away items
    for (const item of traded_away) {
      const { id, quantity = 1 } = item;
      const colRes = await client.query('SELECT quantity FROM collections WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
      if (colRes.rows.length > 0) {
        const currentQty = parseInt(colRes.rows[0].quantity, 10);
        if (currentQty > quantity) {
          await client.query('UPDATE collections SET quantity = quantity - $1 WHERE id = $2 AND user_id = $3', [quantity, id, req.user.userId]);
        } else {
          await client.query('DELETE FROM collections WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
        }
      }
    }
    
    // Calculate investment allocation for received items
    let totalInvestmentToAllocate = tradedAwayInvestment;
    let lifetimeEarningsDelta = 0;
    
    // Handle cash_delta logic
    if (cash_delta > 0) {
      // User is adding money to the trade
      totalInvestmentToAllocate += cash_delta;
      lifetimeEarningsDelta -= cash_delta; // Money spent, reduce lifetime earnings
    } else if (cash_delta < 0) {
      // User is receiving money from the trade
      const cashReceived = Math.abs(cash_delta);
      
      // Check if received items are worth more than traded away items
      if (receivedMarketValue > tradedAwayMarketValue) {
        // Received items are worth more - keep full investment allocation
        // All received cash goes to lifetime earnings
        lifetimeEarningsDelta += cashReceived;
      } else {
        // Received items are worth less - reduce investment allocation
        const reductionRatio = receivedMarketValue / tradedAwayMarketValue;
        totalInvestmentToAllocate = tradedAwayInvestment * reductionRatio;
        
        // Add excess cash to lifetime earnings
        const excessCash = cashReceived - (tradedAwayMarketValue - receivedMarketValue);
        if (excessCash > 0) {
          lifetimeEarningsDelta += excessCash;
        }
      }
    }
    
    // Add/increment received items with calculated investment allocation
    for (const item of received) {
      const { id: product_id, grading_company, grade, condition, quantity = 1, purchase_price } = item;
      
      // Use the purchase_price that was calculated on the client side
      const itemInvestment = parseFloat(purchase_price) || 0;
      
      // Check if already in collection
      const existing = await client.query(
        `SELECT * FROM collections WHERE user_id = $1 AND product_id = $2
         AND COALESCE(grading_company, '') = $3
         AND COALESCE(grade, '') = $4
         AND COALESCE(condition, '') = $5`,
        [req.user.userId, product_id, grading_company || '', grade || '', condition || '']
      );
      
      if (existing.rows.length > 0) {
        // Update quantity and weighted average purchase_price
        const oldQty = parseInt(existing.rows[0].quantity, 10);
        const oldPrice = parseFloat(existing.rows[0].purchase_price) || 0;
        const newQty = oldQty + quantity;
        const newPrice = ((oldPrice * oldQty) + (itemInvestment * quantity)) / newQty;
        
        await client.query(
          'UPDATE collections SET quantity = $1, purchase_price = $2 WHERE id = $3 AND user_id = $4',
          [newQty, newPrice, existing.rows[0].id, req.user.userId]
        );
      } else {
        await client.query(
          `INSERT INTO collections (user_id, product_id, quantity, grading_company, grade, condition, purchase_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.user.userId, product_id, quantity, grading_company || '', grade || '', condition || '', itemInvestment]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Log user transaction for trade
    const investmentAmount = tradedAwayInvestment;
    const marketAmount = receivedMarketValue;
    await db.query(
      `INSERT INTO user_transactions (user_id, action, details, investment_amount, market_amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.userId, 'trade', JSON.stringify({ traded_away, received, cash_delta }), investmentAmount, marketAmount]
    );
    
    // Update lifetime earnings if there's a delta
    if (lifetimeEarningsDelta !== 0) {
      await db.query(
        'UPDATE users SET lifetime_earnings = lifetime_earnings + $1 WHERE id = $2',
        [lifetimeEarningsDelta, req.user.userId]
      );
      
      // Log the lifetime earnings change
      await logStatChange(req.user.userId, 'lifetime_earnings', lifetimeEarningsDelta);
    }
    
    // Calculate and log profit/loss percentage after trade
    await calculateAndLogProfitLoss(req.user.userId);
    
    res.status(201).json({ 
      message: 'Trade recorded and collection updated', 
      trade: result.rows[0],
      investmentAllocated: totalInvestmentToAllocate,
      lifetimeEarningsChange: lifetimeEarningsDelta,
      tradedAwayMarketValue,
      receivedMarketValue
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create trade error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List user's trades
router.get('/trades', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ trades: result.rows });
  } catch (error) {
    console.error('List trades error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { 
  router,
  logStatChange,
  calculateAndLogProfitLoss
};