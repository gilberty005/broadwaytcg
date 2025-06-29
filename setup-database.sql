-- Pokemon Collectr Database Setup Script
-- Use this script to initialize the schema on a fresh database (non-destructive)

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  lifetime_earnings DECIMAL(12,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  product_type VARCHAR(100) NOT NULL,
  set_name VARCHAR(255),
  set_code VARCHAR(50),
  card_number VARCHAR(50),
  rarity VARCHAR(100),
  condition VARCHAR(50) DEFAULT 'Near Mint',
  grade VARCHAR(10),
  grading_company VARCHAR(50),
  image_url TEXT,
  description TEXT,
  card_type VARCHAR(100),
  pokemon_type VARCHAR(50),
  hp INTEGER,
  artist VARCHAR(255),
  release_date DATE,
  sealed BOOLEAN DEFAULT FALSE,
  box_type VARCHAR(100),
  pack_count INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  purchase_price DECIMAL(10,2),
  purchase_date DATE,
  notes TEXT,
  is_for_sale BOOLEAN DEFAULT FALSE,
  asking_price DECIMAL(10,2),
  grading_company VARCHAR(50),
  grade VARCHAR(10),
  condition VARCHAR(50),
  grading_status VARCHAR(20) DEFAULT 'raw',
  raw_card_cost DECIMAL(10,2),
  grading_cost DECIMAL(10,2),
  predicted_grade VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id, grading_company, grade, condition, grading_status)
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  source VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  date_recorded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  url TEXT,
  condition VARCHAR(50),
  grading_company VARCHAR(50),
  grade VARCHAR(10)
);

-- Wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  max_price DECIMAL(10,2),
  priority INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  traded_away JSONB NOT NULL,
  received JSONB NOT NULL,
  cash_delta DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User transactions table
CREATE TABLE IF NOT EXISTS user_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  investment_amount DECIMAL(12,2),
  market_amount DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User stat history table
CREATE TABLE IF NOT EXISTS user_stat_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stat_type VARCHAR(50) NOT NULL, -- e.g. 'lifetime_earnings', 'profit_loss_pct'
  value DECIMAL(16,6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_product_id ON collections(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date_recorded);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_set_code ON products(set_code);

-- Verify the database was created
SELECT current_database(); 