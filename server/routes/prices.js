const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { fetchCollectionEbayPrices, saveEbayPricesToHistory } = require('../utils/ebay');

const router = express.Router();

// Rate limit for eBay price updates (more lenient since it's a bulk operation)
const ebayPriceUpdateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'development' ? 10 : 5, // allow 10 updates per 5 minutes in dev, 5 in prod
  message: {
    error: 'eBay price update rate limit exceeded. Please wait before trying again.',
    retryAfter: Math.ceil(5 * 60 / 1000) // retry after 5 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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

// Get current price for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    // Check if product exists
    const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get latest price from price history
    const latestPrice = await db.query(`
      SELECT * FROM price_history 
      WHERE product_id = $1 
      ORDER BY date_recorded DESC 
      LIMIT 1
    `, [productId]);

    let currentMarketPrice = latestPrice.rows[0]?.price || null;
    let lastUpdated = latestPrice.rows[0]?.date_recorded || null;
    let usedHistory = true;

    // If no price or price is stale, fetch from eBay and log if needed
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (!currentMarketPrice || (lastUpdated && new Date(lastUpdated) < oneHourAgo)) {
      // Fetch from eBay
      const prod = product.rows[0];
      const searchOptions = {
        name: prod.name,
        set: prod.set_name,
        card_number: prod.card_number,
        grading_company: prod.grading_company,
        grade: prod.grade
      };
      const prices = await require('../utils/ebay').fetchEbaySoldPrices(searchOptions);
      if (prices && prices.length > 0) {
        const meanPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
        currentMarketPrice = Math.round(meanPrice * 100) / 100;
        usedHistory = false;
        // Log to price history if > 1 hour since last log
        await saveEbayPricesToHistory(
          productId,
          currentMarketPrice,
          prices,
          prod.grading_company,
          prod.grade,
          prod.condition
        );
        lastUpdated = new Date();
      }
    }

    // Get price history for the last 30 days
    const priceHistory = await db.query(`
      SELECT * FROM price_history 
      WHERE product_id = $1 
      AND date_recorded >= NOW() - INTERVAL '30 days'
      ORDER BY date_recorded ASC
    `, [productId]);

    // Calculate price change
    let priceChange = 0;
    let percentageChange = 0;
    if (priceHistory.rows.length >= 2) {
      const oldestPrice = priceHistory.rows[0].price;
      const newestPrice = priceHistory.rows[priceHistory.rows.length - 1].price;
      priceChange = newestPrice - oldestPrice;
      percentageChange = oldestPrice > 0 ? (priceChange / oldestPrice) * 100 : 0;
    }

    res.json({
      product: product.rows[0],
      currentPrice: currentMarketPrice,
      priceChange,
      percentageChange,
      priceHistory: priceHistory.rows,
      marketPrices: {
        ebay: currentMarketPrice,
        lastUpdated: lastUpdated
      },
      usedHistory
    });
  } catch (error) {
    console.error('Get product price error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save price to history
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { product_id, price, source = 'manual', url, condition } = req.body;

    // Validation
    if (!product_id || !price) {
      return res.status(400).json({ error: 'Product ID and price are required' });
    }

    // Check if product exists
    const product = await db.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Save price to history
    const newPrice = await db.query(`
      INSERT INTO price_history (product_id, price, source, url, condition)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [product_id, price, source, url, condition]);

    // Calculate and log profit/loss percentage if this product is in user's collection
    try {
      const { calculateAndLogProfitLoss } = require('../routes/collections');
      await calculateAndLogProfitLoss(req.user.userId);
    } catch (error) {
      console.error('Error calculating profit/loss after price save:', error);
    }

    res.status(201).json({
      message: 'Price saved successfully',
      priceRecord: newPrice.rows[0]
    });
  } catch (error) {
    console.error('Save price error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get price history for a product
router.get('/history/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { days = 30 } = req.query;

    // Check if product exists
    const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get price history
    const priceHistory = await db.query(`
      SELECT * FROM price_history 
      WHERE product_id = $1 
      AND date_recorded >= NOW() - INTERVAL '${days} days'
      ORDER BY date_recorded ASC
    `, [productId]);

    res.json({
      product: product.rows[0],
      priceHistory: priceHistory.rows
    });
  } catch (error) {
    console.error('Get price history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get price alerts for user's collection
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    // Get user's collection with recent price changes
    const alerts = await db.query(`
      SELECT 
        c.id as collection_id,
        c.quantity,
        c.purchase_price,
        p.id as product_id,
        p.name,
        p.product_type,
        p.set_name,
        p.image_url,
        ph.price as new_price,
        ph.price - c.purchase_price as price_change,
        ph.date_recorded
      FROM collections c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) 
          product_id, price, date_recorded
        FROM price_history 
        ORDER BY product_id, date_recorded DESC
      ) ph ON p.id = ph.product_id
      WHERE c.user_id = $1 
      AND c.purchase_price IS NOT NULL
      AND ph.price IS NOT NULL
      AND ABS(ph.price - c.purchase_price) / c.purchase_price > 0.1
      ORDER BY ABS(ph.price - c.purchase_price) DESC
      LIMIT 10
    `, [req.user.userId]);

    res.json({ alerts: alerts.rows });
  } catch (error) {
    console.error('Get price alerts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk update prices (mock implementation)
router.post('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const { product_ids } = req.body;

    if (!product_ids || !Array.isArray(product_ids)) {
      return res.status(400).json({ error: 'Product IDs array is required' });
    }

    const updatedPrices = [];

    for (const productId of product_ids) {
      // Check if product exists
      const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
      if (product.rows.length === 0) continue;

      // Mock price update (in real app, you'd scrape actual prices)
      const mockPrice = Math.random() * 100 + 10;
      
      // Save to price history
      await db.query(`
        INSERT INTO price_history (product_id, price, source, condition)
        VALUES ($1, $2, $3, $4)
      `, [productId, mockPrice, 'auto_update', 'Near Mint']);

      updatedPrices.push({
        product_id: productId,
        name: product.rows[0].name,
        new_price: mockPrice
      });
    }

    // Calculate and log profit/loss percentage after bulk update
    try {
      const { calculateAndLogProfitLoss } = require('../routes/collections');
      await calculateAndLogProfitLoss(req.user.userId);
    } catch (error) {
      console.error('Error calculating profit/loss after bulk update:', error);
    }

    res.json({
      message: `Updated prices for ${updatedPrices.length} products`,
      updatedPrices
    });
  } catch (error) {
    console.error('Bulk update prices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent price updates
router.get('/recent', async (req, res) => {
  try {
    const recentUpdates = await db.query(`
      SELECT 
        ph.*,
        p.name as product_name,
        p.product_type,
        p.set_name,
        p.image_url
      FROM price_history ph
      JOIN products p ON ph.product_id = p.id
      WHERE ph.date_recorded >= NOW() - INTERVAL '7 days'
      ORDER BY ph.date_recorded DESC
      LIMIT 20
    `);

    res.json({ recentUpdates: recentUpdates.rows });
  } catch (error) {
    console.error('Get recent price updates error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update eBay prices for user's collection
router.post('/update-ebay-prices', ebayPriceUpdateLimiter, authenticateToken, async (req, res) => {
  try {
    console.log(`[eBay] /update-ebay-prices endpoint hit for user ${req.user.userId}`);
    // Fetch eBay prices for all products in user's collection
    const ebayPrices = await fetchCollectionEbayPrices(req.user.userId);
    console.log(`[eBay] fetchCollectionEbayPrices returned ${ebayPrices.length} products for user ${req.user.userId}`);
    if (ebayPrices.length === 0) {
      return res.json({
        message: 'No products found in collection or no eBay prices available',
        updatedCount: 0,
        products: []
      });
    }

    // Save prices to price history
    const savedPrices = [];
    for (const priceData of ebayPrices) {
      try {
        await saveEbayPricesToHistory(
          priceData.product_id, 
          priceData.mean_price, 
          priceData.prices
        );
        console.log(`[eBay] Saved price for product_id ${priceData.product_id} (${priceData.name})`);
        savedPrices.push({
          product_id: priceData.product_id,
          name: priceData.name,
          set_name: priceData.set_name,
          mean_price: priceData.mean_price,
          price_count: priceData.price_count,
          grading_info: priceData.grading_company && priceData.grade 
            ? `${priceData.grading_company} ${priceData.grade}` 
            : null
        });
      } catch (error) {
        console.error(`[eBay] Error saving price for ${priceData.name}:`, error);
        // Continue with other products
      }
    }

    console.log(`[eBay] Successfully updated ${savedPrices.length} product prices for user ${req.user.userId}`);

    // Calculate and log profit/loss percentage after price updates
    try {
      // Import the helper function from collections routes
      const { calculateAndLogProfitLoss } = require('../routes/collections');
      await calculateAndLogProfitLoss(req.user.userId);
      console.log(`[eBay] Updated profit/loss percentage for user ${req.user.userId}`);
    } catch (error) {
      console.error(`[eBay] Error calculating profit/loss for user ${req.user.userId}:`, error);
    }

    res.json({
      message: `Successfully updated eBay prices for ${savedPrices.length} products`,
      updatedCount: savedPrices.length,
      products: savedPrices
    });
  } catch (error) {
    console.error('[eBay] Update eBay prices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 