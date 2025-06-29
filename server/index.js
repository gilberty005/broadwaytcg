const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Run dependency check
require('./check-dependencies');

const db = require('./db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const { router: collectionRoutes } = require('./routes/collections');
const priceRoutes = require('./routes/prices');

const app = express();
const PORT = process.env.PORT || 5001;

// Trust proxy for rate limiting (needed when behind a proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 500 : 200, // allow more requests per minute for development
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: Math.ceil(60 / 1000) // retry after 1 minute
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// More lenient rate limit for API endpoints
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 1000 : 500, // even more lenient for API calls
  message: {
    error: 'API rate limit exceeded, please try again later.',
    retryAfter: Math.ceil(60 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/products', apiLimiter, productRoutes);
app.use('/api/collections', apiLimiter, collectionRoutes);
app.use('/api/prices', apiLimiter, priceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Pokemon Collectr API is running' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  const indexPath = path.join(buildPath, 'index.html');
  
  // Check if build directory exists
  const fs = require('fs');
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    
    app.get('/:any*', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ 
          error: 'Frontend not built', 
          message: 'React build files not found. Please ensure the build process completed successfully.' 
        });
      }
    });
  } else {
    console.log('⚠️  Warning: Client build directory not found. Serving API only.');
    app.get('/', (req, res) => {
      res.json({ 
        message: 'Pokemon Collectr API is running',
        note: 'Frontend build files not found. Please check the build process.',
        apiEndpoints: {
          health: '/api/health',
          auth: '/api/auth',
          products: '/api/products',
          collections: '/api/collections',
          prices: '/api/prices'
        }
      });
    });
  }
}

// Serve uploaded images with CORS headers
app.use('/uploads', cors(), express.static(path.join(__dirname, '../uploads')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Pokemon Collectr server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; 