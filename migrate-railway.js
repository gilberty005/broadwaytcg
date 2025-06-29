#!/usr/bin/env node

require('dotenv').config();
const { migrateDatabase } = require('./server/migrate-database');

console.log('🚀 Starting Railway database migration...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');

migrateDatabase()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 