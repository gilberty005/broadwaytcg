const fs = require('fs');
const path = require('path');

console.log('🔍 Checking dependencies...');

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules directory exists');
} else {
  console.log('❌ node_modules directory not found');
}

// Check for Cloudinary packages
const cloudinaryPath = path.join(__dirname, 'node_modules/cloudinary');
const multerStoragePath = path.join(__dirname, 'node_modules/multer-storage-cloudinary');

if (fs.existsSync(cloudinaryPath)) {
  console.log('✅ cloudinary package found');
  const packageJson = JSON.parse(fs.readFileSync(path.join(cloudinaryPath, 'package.json'), 'utf8'));
  console.log('   Version:', packageJson.version);
} else {
  console.log('❌ cloudinary package not found');
}

if (fs.existsSync(multerStoragePath)) {
  console.log('✅ multer-storage-cloudinary package found');
  const packageJson = JSON.parse(fs.readFileSync(path.join(multerStoragePath, 'package.json'), 'utf8'));
  console.log('   Version:', packageJson.version);
} else {
  console.log('❌ multer-storage-cloudinary package not found');
}

// Check parent node_modules
const parentNodeModules = path.join(__dirname, '../node_modules');
if (fs.existsSync(parentNodeModules)) {
  console.log('✅ Parent node_modules directory exists');
  
  const parentCloudinaryPath = path.join(parentNodeModules, 'cloudinary');
  const parentMulterStoragePath = path.join(parentNodeModules, 'multer-storage-cloudinary');
  
  if (fs.existsSync(parentCloudinaryPath)) {
    console.log('✅ cloudinary package found in parent node_modules');
  }
  
  if (fs.existsSync(parentMulterStoragePath)) {
    console.log('✅ multer-storage-cloudinary package found in parent node_modules');
  }
} else {
  console.log('❌ Parent node_modules directory not found');
}

// Try to require the packages
try {
  const cloudinary = require('cloudinary');
  console.log('✅ cloudinary require successful');
} catch (error) {
  console.log('❌ cloudinary require failed:', error.message);
}

try {
  const multerStorage = require('multer-storage-cloudinary');
  console.log('✅ multer-storage-cloudinary require successful');
} catch (error) {
  console.log('❌ multer-storage-cloudinary require failed:', error.message);
}

console.log('🔍 Dependency check complete'); 