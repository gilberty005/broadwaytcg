const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
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
const upload = multer({ storage });

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
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
  return cloudinary.url(publicId, {
    secure: true,
    ...options
  });
};

module.exports = {
  cloudinary,
  upload,
  deleteImage,
  getImageUrl
}; 