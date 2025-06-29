const { Pool } = require('pg');

// Database configuration - support both DATABASE_URL (Railway) and individual env vars
let pool;

if (process.env.DATABASE_URL) {
  // Use Railway's DATABASE_URL
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} else {
  // Fallback to individual environment variables
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'pokemon_collectr',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

// Migration function to add missing columns
const migrateDatabase = async () => {
  try {
    console.log('🔄 Starting database migration...');

    // Create extensions if needed
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ UUID extension created/verified');

    // Add missing columns to collections table
    const collectionsColumns = [
      'ADD COLUMN IF NOT EXISTS grading_company VARCHAR(50)',
      'ADD COLUMN IF NOT EXISTS grade VARCHAR(10)',
      'ADD COLUMN IF NOT EXISTS condition VARCHAR(50)',
      'ADD COLUMN IF NOT EXISTS grading_status VARCHAR(20) DEFAULT \'raw\'',
      'ADD COLUMN IF NOT EXISTS raw_card_cost DECIMAL(10,2)',
      'ADD COLUMN IF NOT EXISTS grading_cost DECIMAL(10,2)',
      'ADD COLUMN IF NOT EXISTS predicted_grade VARCHAR(10)'
    ];

    for (const column of collectionsColumns) {
      try {
        await pool.query(`ALTER TABLE collections ${column}`);
        console.log(`✅ Added column to collections: ${column.split(' ')[3]}`);
      } catch (error) {
        if (error.code === '42701') { // Column already exists
          console.log(`ℹ️  Column already exists in collections: ${column.split(' ')[3]}`);
        } else {
          console.error(`❌ Error adding column to collections: ${column.split(' ')[3]}`, error.message);
        }
      }
    }

    // Add missing columns to price_history table
    const priceHistoryColumns = [
      'ADD COLUMN IF NOT EXISTS grading_company VARCHAR(50)',
      'ADD COLUMN IF NOT EXISTS grade VARCHAR(10)'
    ];

    for (const column of priceHistoryColumns) {
      try {
        await pool.query(`ALTER TABLE price_history ${column}`);
        console.log(`✅ Added column to price_history: ${column.split(' ')[3]}`);
      } catch (error) {
        if (error.code === '42701') { // Column already exists
          console.log(`ℹ️  Column already exists in price_history: ${column.split(' ')[3]}`);
        } else {
          console.error(`❌ Error adding column to price_history: ${column.split(' ')[3]}`, error.message);
        }
      }
    }

    // Drop old unique constraint if it exists and add new one
    try {
      await pool.query('ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_user_id_product_id_key');
      console.log('✅ Dropped old unique constraint from collections');
    } catch (error) {
      console.log('ℹ️  No old unique constraint to drop');
    }

    // Add new unique constraint
    try {
      await pool.query(`
        ALTER TABLE collections 
        ADD CONSTRAINT collections_user_product_grading_unique 
        UNIQUE(user_id, product_id, grading_company, grade, condition, grading_status)
      `);
      console.log('✅ Added new unique constraint to collections');
    } catch (error) {
      if (error.code === '42710') { // Constraint already exists
        console.log('ℹ️  Unique constraint already exists');
      } else {
        console.error('❌ Error adding unique constraint:', error.message);
      }
    }

    // Create indexes if they don't exist
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_collections_product_id ON collections(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date_recorded)',
      'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
      'CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type)',
      'CREATE INDEX IF NOT EXISTS idx_products_set_code ON products(set_code)'
    ];

    for (const index of indexes) {
      try {
        await pool.query(index);
        console.log(`✅ Created/verified index: ${index.split(' ')[4]}`);
      } catch (error) {
        console.error(`❌ Error creating index: ${index.split(' ')[4]}`, error.message);
      }
    }

    console.log('✅ Database migration completed successfully!');
    
    // Verify the migration by checking table structure
    console.log('\n📋 Verifying table structure...');
    
    const collectionsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'collections' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nCollections table columns:');
    collectionsStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    const priceHistoryStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'price_history' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nPrice history table columns:');
    priceHistoryStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  migrateDatabase()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateDatabase }; 