const multer = require('multer');

// Check if Cloudinary dependencies are available
let cloudinary, CloudinaryStorage;
try {
  cloudinary = require('cloudinary').v2;
  console.log('✅ Cloudinary package loaded successfully');
} catch (error) {
  console.log('❌ Cloudinary package not available:', error.message);
  cloudinary = null;
}

try {
  const multerStorageCloudinary = require('multer-storage-cloudinary');
  console.log('✅ multer-storage-cloudinary package loaded successfully');
  console.log('📦 Available exports:', Object.keys(multerStorageCloudinary));
  console.log('📦 Full module:', multerStorageCloudinary);
  
  // Try different ways to access CloudinaryStorage
  CloudinaryStorage = multerStorageCloudinary.CloudinaryStorage || 
                     multerStorageCloudinary.default || 
                     multerStorageCloudinary;
  
  console.log('📦 CloudinaryStorage constructor:', typeof CloudinaryStorage);
  console.log('📦 CloudinaryStorage value:', CloudinaryStorage);
  
  if (typeof CloudinaryStorage !== 'function') {
    console.log('❌ CloudinaryStorage is not a constructor function');
    console.log('🔍 Trying alternative import method...');
    
    // Try alternative import
    try {
      const { CloudinaryStorage: AltCloudinaryStorage } = require('multer-storage-cloudinary');
      CloudinaryStorage = AltCloudinaryStorage;
      console.log('📦 Alternative CloudinaryStorage:', typeof CloudinaryStorage);
    } catch (altError) {
      console.log('❌ Alternative import also failed:', altError.message);
      CloudinaryStorage = null;
    }
  } else {
    console.log('✅ CloudinaryStorage constructor is available');
  }
} catch (error) {
  console.log('❌ CloudinaryStorage package not available:', error.message);
  CloudinaryStorage = null;
}

// Create storage and upload instances
let storage, upload;

if (cloudinary && CloudinaryStorage && typeof CloudinaryStorage === 'function') {
  try {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // Test Cloudinary configuration
    console.log('🔧 Testing Cloudinary configuration...');
    console.log('📦 Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('🔑 API Key:', process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set');
    console.log('🔐 API Secret:', process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set');

    // Configure Cloudinary storage
    console.log('🔧 Creating CloudinaryStorage instance...');
    storage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'pokemon-collectr',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
          { width: 800, height: 800, crop: 'limit' }, // Resize large images
          { quality: 'auto:good' } // Optimize quality
        ]
      }
    });
    console.log('✅ CloudinaryStorage instance created successfully');

    // Create multer upload instance
    upload = multer({ storage });
    console.log('✅ Cloudinary multer upload configured successfully');
  } catch (error) {
    console.error('❌ Error configuring Cloudinary storage:', error.message);
    console.error('❌ Error stack:', error.stack);
    cloudinary = null;
    CloudinaryStorage = null;
    storage = null;
    upload = null;
  }
} else {
  console.log('⚠️  Cloudinary dependencies not available');
  console.log('  - cloudinary available:', !!cloudinary);
  console.log('  - CloudinaryStorage available:', !!CloudinaryStorage);
  console.log('  - CloudinaryStorage type:', typeof CloudinaryStorage);
  upload = null;
}

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  if (!cloudinary) {
    console.log('⚠️  Cloudinary not available for image deletion');
    return;
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Helper function to get image URL from public ID
const getImageUrl = (publicId, options = {}) => {
  if (!cloudinary) {
    console.log('⚠️  Cloudinary not available for URL generation');
    return publicId; // Return as-is if Cloudinary not available
  }
  return cloudinary.url(publicId, {
    secure: true,
    ...options
  });
};

// Check if Cloudinary is properly configured
const isCloudinaryConfigured = () => {
  const hasDeps = cloudinary && CloudinaryStorage && typeof CloudinaryStorage === 'function';
  const hasEnvVars = process.env.CLOUDINARY_CLOUD_NAME && 
                    process.env.CLOUDINARY_API_KEY && 
                    process.env.CLOUDINARY_API_SECRET;
  const hasUpload = !!upload;
  
  console.log('🔍 Cloudinary configuration check:');
  console.log('  - Dependencies available:', hasDeps);
  console.log('  - Environment variables set:', hasEnvVars);
  console.log('  - Upload instance available:', hasUpload);
  console.log('  - cloudinary object:', !!cloudinary);
  console.log('  - CloudinaryStorage object:', !!CloudinaryStorage);
  console.log('  - CloudinaryStorage type:', typeof CloudinaryStorage);
  
  return hasDeps && hasEnvVars && hasUpload;
};

module.exports = {
  cloudinary,
  upload,
  deleteImage,
  getImageUrl,
  isCloudinaryConfigured
}; 