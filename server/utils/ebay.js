const axios = require('axios');
const qs = require('qs');
const db = require('../db');

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID || 'YOUR_CLIENT_ID';
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const EBAY_API_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_OAUTH_ENDPOINT = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';

// In-memory token cache
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get a valid eBay OAuth access token (auto-refreshes if expired)
 */
async function getEbayAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) { // 1 min buffer
    return cachedToken;
  }
  const basicAuth = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
  const data = qs.stringify({ grant_type: 'client_credentials', scope: EBAY_SCOPE });
  const response = await axios.post(
    EBAY_OAUTH_ENDPOINT,
    data,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
    }
  );
  cachedToken = response.data.access_token;
  tokenExpiresAt = now + (response.data.expires_in * 1000);
  return cachedToken;
}

/**
 * Fetch sold prices for a card from eBay (last 90 days)
 * @param {Object} options
 * @param {string} options.name - Card name
 * @param {string} [options.set] - Set name
 * @param {string} [options.card_number] - Card number
 * @param {string} [options.grading_company] - Grading company (e.g., PSA)
 * @param {string} [options.grade] - Grade (e.g., 10)
 * @returns {Promise<Array>} Array of sold price objects
 */
async function fetchEbaySoldPrices({ name, set, card_number, grading_company, grade }) {
  let keywords = name;
  if (set) keywords += ` ${set}`;
  if (card_number) keywords += ` ${card_number}`;
  if (grading_company && grade) {
    keywords += ` ${grading_company} ${grade}`;
  } else if (grading_company) {
    keywords += ` ${grading_company}`;
  }

  const params = {
    q: keywords,
    limit: 50,
    sort: 'price asc', // Sort by price ascending for easier trimming
  };

  try {
    const token = await getEbayAccessToken();
    const response = await axios.get(EBAY_API_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      params,
    });
    const items = response.data.itemSummaries || [];
    const filtered = items
      .filter(item => item.price && item.price.value)
      .map(item => ({
        title: item.title,
        price: parseFloat(item.price.value),
        currency: item.price.currency,
        itemWebUrl: item.itemWebUrl,
        condition: item.condition,
      }));
    if (filtered.length === 0) return [];
    // Sort by price ascending
    const sorted = filtered.sort((a, b) => a.price - b.price);
    // Remove bottom 15% and top 15%
    const trimCount = Math.floor(sorted.length * 0.15);
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    return trimmed;
  } catch (error) {
    console.error('eBay API error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Fetch eBay prices for all unique products in a user's collection
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of products with their mean eBay prices
 */
async function fetchCollectionEbayPrices(userId) {
  try {
    console.log(`[eBay] Fetching collection for userId:`, userId);
    // Get all unique products in user's collection
    const collectionQuery = `
      SELECT DISTINCT 
        p.id,
        p.name,
        p.product_type,
        p.set_name,
        p.card_number,
        c.grading_company,
        c.grade,
        c.condition
      FROM collections c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
      ORDER BY p.name, p.set_name
    `;
    
    const collection = await db.query(collectionQuery, [userId]);
    console.log(`[eBay] Found ${collection.rows.length} products in collection for user ${userId}`);
    if (collection.rows.length === 0) {
      console.log(`[eBay] No products found in collection for user ${userId}`);
    } else {
      collection.rows.forEach((item, idx) => {
        console.log(`[eBay] Product ${idx + 1}:`, {
          id: item.id,
          name: item.name,
          set: item.set_name,
          grading_company: item.grading_company,
          grade: item.grade,
          condition: item.condition
        });
      });
    }
    const results = [];

    for (const item of collection.rows) {
      try {
        // Build search options based on product type and grading info
        const searchOptions = {
          name: item.name,
          set: item.set_name,
          card_number: item.card_number
        };

        // Add grading info if available
        if (item.grading_company && item.grade) {
          searchOptions.grading_company = item.grading_company;
          searchOptions.grade = item.grade;
        }

        console.log(`[eBay] Fetching prices for:`, searchOptions);

        const prices = await fetchEbaySoldPrices(searchOptions);
        
        if (prices && prices.length > 0) {
          // Calculate mean price
          const meanPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
          console.log(`[eBay] Found ${prices.length} prices for ${item.name} (mean: $${meanPrice.toFixed(2)})`);
          results.push({
            product_id: item.id,
            name: item.name,
            product_type: item.product_type,
            set_name: item.set_name,
            grading_company: item.grading_company,
            grade: item.grade,
            condition: item.condition,
            mean_price: Math.round(meanPrice * 100) / 100, // Round to 2 decimal places
            price_count: prices.length,
            prices: prices,
            last_updated: new Date()
          });
          // Save to price history with grading/condition info
          await saveEbayPricesToHistory(
            item.id,
            Math.round(meanPrice * 100) / 100,
            prices,
            item.grading_company,
            item.grade,
            item.condition
          );
        } else {
          console.log(`[eBay] No prices found for: ${item.name} ${item.set_name}`);
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[eBay] Error fetching prices for ${item.name}:`, error.message);
        // Continue with next item
      }
    }

    console.log(`[eBay] Successfully fetched prices for ${results.length} products for user ${userId}`);
    return results;
  } catch (error) {
    console.error('[eBay] Error fetching collection eBay prices:', error);
    throw error;
  }
}

/**
 * Save eBay prices to price history for a product
 * @param {number} productId - Product ID
 * @param {number} meanPrice - Mean price from eBay
 * @param {Array} prices - Array of individual prices
 */
async function saveEbayPricesToHistory(productId, meanPrice, prices, grading_company, grade, condition) {
  try {
    // Only log if last log for this product (with same grading/condition) was more than 1 hour ago
    const lastLog = await db.query(`
      SELECT date_recorded FROM price_history
      WHERE product_id = $1
        AND COALESCE(grading_company, '') = COALESCE($2, '')
        AND COALESCE(grade, '') = COALESCE($3, '')
        AND COALESCE(condition, '') = COALESCE($4, '')
      ORDER BY date_recorded DESC
      LIMIT 1
    `, [productId, grading_company || '', grade || '', condition || '']);
    if (lastLog.rows.length > 0) {
      const lastDate = new Date(lastLog.rows[0].date_recorded);
      const now = new Date();
      if ((now - lastDate) < 10 * 60 * 60 * 1000) {
        // Less than 1 hour ago, skip logging
        return;
      }
    }
    await db.query(`
      INSERT INTO price_history (product_id, price, source, url, condition, grading_company, grade)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [productId, meanPrice, 'ebay_api', 'eBay Market Data', condition || null, grading_company || null, grade || null]);
    console.log(`Saved eBay price $${meanPrice} for product ${productId}`);
  } catch (error) {
    console.error(`Error saving eBay prices for product ${productId}:`, error);
    throw error;
  }
}

module.exports = { 
  fetchEbaySoldPrices, 
  getEbayAccessToken, 
  fetchCollectionEbayPrices,
  saveEbayPricesToHistory
}; 