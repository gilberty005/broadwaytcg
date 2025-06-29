const multer = require('multer');

// Check if Cloudinary dependencies are available
let cloudinary, CloudinaryStorage;
try {
  cloudinary = require('cloudinary').v2;
  CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage;
} catch (error) {
  console.log('⚠️  Cloudinary dependencies not installed. Using local storage only.');
  cloudinary = null;
  CloudinaryStorage = null;
}

// Create storage and upload instances
let storage, upload;

if (cloudinary && CloudinaryStorage) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  // Configure Cloudinary storage
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

  // Create multer upload instance
  upload = multer({ storage });
} else {
  // Fallback: create a dummy upload that will be handled by the route
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
  return cloudinary && 
         CloudinaryStorage &&
         process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

module.exports = {
  cloudinary,
  upload,
  deleteImage,
  getImageUrl,
  isCloudinaryConfigured
}; 