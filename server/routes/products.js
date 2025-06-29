const express = require('express');
const db = require('../db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Import Cloudinary utilities
const { upload: cloudinaryUpload, deleteImage, isCloudinaryConfigured } = require('../utils/cloudinary');

const router = express.Router();

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Fallback local storage setup (if Cloudinary not configured)
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const localUpload = multer({ storage: localStorage });

// Get all products with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', product_type = '', set = '', rarity = '' } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR set_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (product_type) {
      whereClause += ` AND product_type = $${paramIndex}`;
      params.push(product_type);
      paramIndex++;
    }

    if (set) {
      whereClause += ` AND set_code = $${paramIndex}`;
      params.push(set);
      paramIndex++;
    }

    if (rarity) {
      whereClause += ` AND rarity = $${paramIndex}`;
      params.push(rarity);
      paramIndex++;
    }

    // Get products with pagination
    const productsQuery = `
      SELECT * FROM products 
      ${whereClause}
      ORDER BY name ASC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const products = await db.query(productsQuery, [...params, limit, offset]);

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM products ${whereClause}`;
    const totalCount = await db.query(countQuery, params);

    res.json({
      products: products.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount.rows[0].count / limit),
        totalItems: parseInt(totalCount.rows[0].count),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get product types (for filtering) - MUST come before /:id route
router.get('/types/list', async (req, res) => {
  try {
    const types = await db.query(`
      SELECT DISTINCT product_type 
      FROM products 
      WHERE product_type IS NOT NULL 
      ORDER BY product_type ASC
    `);

    res.json({ types: types.rows.map(row => row.product_type) });
  } catch (error) {
    console.error('Get product types error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get product sets (for filtering) - MUST come before /:id route
router.get('/sets/list', async (req, res) => {
  try {
    const sets = await db.query(`
      SELECT DISTINCT set_code, set_name 
      FROM products 
      WHERE set_code IS NOT NULL 
      ORDER BY set_name ASC
    `);

    res.json({ sets: sets.rows });
  } catch (error) {
    console.error('Get sets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get product rarities (for filtering) - MUST come before /:id route
router.get('/rarities/list', async (req, res) => {
  try {
    const rarities = await db.query(`
      SELECT DISTINCT rarity 
      FROM products 
      WHERE rarity IS NOT NULL 
      ORDER BY rarity ASC
    `);

    res.json({ rarities: rarities.rows.map(row => row.rarity) });
  } catch (error) {
    console.error('Get rarities error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get product by ID - MUST come after specific routes
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: product.rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new product (manual entry)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      product_type,
      set_name,
      set_code,
      card_number,
      rarity,
      condition = 'Near Mint',
      grade,
      grading_company,
      image_url,
      description,
      card_type,
      pokemon_type,
      hp,
      artist,
      release_date,
      sealed = false,
      box_type,
      pack_count
    } = req.body;

    // Validation
    if (!name || !product_type) {
      return res.status(400).json({ error: 'Product name and type are required' });
    }

    // Check if product already exists (basic check)
    const existingProduct = await db.query(
      'SELECT * FROM products WHERE name = $1 AND product_type = $2 AND set_code = $3',
      [name, product_type, set_code]
    );

    if (existingProduct.rows.length > 0) {
      return res.status(400).json({ error: 'Product already exists in database' });
    }

    // Insert new product
    const newProduct = await db.query(`
      INSERT INTO products (
        name, product_type, set_name, set_code, card_number, rarity, condition,
        grade, grading_company, image_url, description, card_type, pokemon_type, 
        hp, artist, release_date, sealed, box_type, pack_count, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      name, product_type, set_name, set_code, card_number, rarity, condition,
      grade, grading_company, image_url, description, card_type, pokemon_type, 
      hp, artist, release_date, sealed, box_type, pack_count, req.user.userId
    ]);

    res.status(201).json({
      message: 'Product added successfully',
      product: newProduct.rows[0]
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      product_type,
      set_name,
      set_code,
      card_number,
      rarity,
      condition,
      grade,
      grading_company,
      image_url,
      description,
      card_type,
      pokemon_type,
      hp,
      artist,
      release_date,
      sealed,
      box_type,
      pack_count
    } = req.body;

    // Check if product exists
    const existingProduct = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product
    const updatedProduct = await db.query(`
      UPDATE products SET 
        name = COALESCE($1, name),
        product_type = COALESCE($2, product_type),
        set_name = COALESCE($3, set_name),
        set_code = COALESCE($4, set_code),
        card_number = COALESCE($5, card_number),
        rarity = COALESCE($6, rarity),
        condition = COALESCE($7, condition),
        grade = COALESCE($8, grade),
        grading_company = COALESCE($9, grading_company),
        image_url = COALESCE($10, image_url),
        description = COALESCE($11, description),
        card_type = COALESCE($12, card_type),
        pokemon_type = COALESCE($13, pokemon_type),
        hp = COALESCE($14, hp),
        artist = COALESCE($15, artist),
        release_date = COALESCE($16, release_date),
        sealed = COALESCE($17, sealed),
        box_type = COALESCE($18, box_type),
        pack_count = COALESCE($19, pack_count),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *
    `, [
      name, product_type, set_name, set_code, card_number, rarity, condition,
      grade, grading_company, image_url, description, card_type, pokemon_type, 
      hp, artist, release_date, sealed, box_type, pack_count, id
    ]);

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct.rows[0]
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete product
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const existingProduct = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete product
    await db.query('DELETE FROM products WHERE id = $1', [id]);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Image upload endpoint - uses Cloudinary if configured, otherwise local storage
router.post('/upload-image', (req, res, next) => {
  // Check if Cloudinary is properly configured
  if (isCloudinaryConfigured() && cloudinaryUpload) {
    // Use Cloudinary
    cloudinaryUpload.single('image')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: 'Upload failed' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Cloudinary returns the full URL directly
      const imageUrl = req.file.path;
      res.json({ imageUrl });
    });
  } else {
    // Use local storage as fallback
    localUpload.single('image')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: 'Upload failed' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Return a full URL that the client can use
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      res.json({ imageUrl });
    });
  }
});

module.exports = router; 