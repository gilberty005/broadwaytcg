import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { Upload, Save, X } from 'lucide-react';

const AddProduct = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    product_type: 'card', // card, sealed_product
    set_name: '',
    card_number: '',
    rarity: '',
    misc_info: '',
    product_description: '',
    image_url: ''
  });

  const productTypes = [
    { value: 'card', label: 'Card' },
    { value: 'sealed_product', label: 'Sealed Product' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
    setIsUploading(true);
    try {
      const formDataImg = new FormData();
      formDataImg.append('image', file);
      const response = await axios.post('/api/products/upload-image', formDataImg, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, image_url: response.data.imageUrl }));
    } catch (error) {
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const createProductMutation = useMutation(
    async (productData) => {
      const response = await axios.post('/api/products', productData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('products');
        navigate('/products');
      },
      onError: () => {
        alert('Failed to create product. Please try again.');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    // Clean up empty fields
    const cleanedData = Object.fromEntries(
      Object.entries(formData).filter(([_, value]) => value !== '')
    );
    createProductMutation.mutate(cleanedData);
  };

  const isFormValid = () => {
    if (!formData.name || !formData.product_type || !formData.set_name || !formData.image_url) return false;
    if (formData.product_type === 'sealed_product') {
      return formData.product_description;
    }
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Add New Product</h1>
        <p className="text-gray-600">Add a new Pokemon product to the database</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Type *</label>
              <select name="product_type" value={formData.product_type} onChange={handleInputChange} className="input-field" required>
                {productTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Set Name *</label>
              <input type="text" name="set_name" value={formData.set_name} onChange={handleInputChange} className="input-field" required />
            </div>
            {formData.product_type === 'card' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                  <input type="text" name="card_number" value={formData.card_number} onChange={handleInputChange} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rarity</label>
                  <input type="text" name="rarity" value={formData.rarity} onChange={handleInputChange} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Misc Information</label>
                  <input type="text" name="misc_info" value={formData.misc_info} onChange={handleInputChange} className="input-field" placeholder="Any extra info (e.g. language, error, etc.)" />
                </div>
              </>
            )}
            {formData.product_type === 'sealed_product' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Description *</label>
                <textarea name="product_description" value={formData.product_description} onChange={handleInputChange} className="input-field" rows={3} required />
              </div>
            )}
          </div>
        </div>
        {/* Image Upload */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Image *</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Image</label>
              <div className="flex items-center space-x-4">
                <label className="cursor-pointer">
                  <div className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    <Upload className="h-5 w-5 mr-2" />
                    Choose File
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                </label>
                {isUploading && (
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                    Uploading...
                  </div>
                )}
              </div>
            </div>
            {(imagePreview || formData.image_url) && (
              <div className="relative">
                <img src={imagePreview || formData.image_url} alt="Product preview" className="w-48 h-48 object-cover rounded-lg border" />
                <button type="button" onClick={() => { setImagePreview(null); setFormData(prev => ({ ...prev, image_url: '' })); }} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Or enter image URL</label>
              <input type="url" name="image_url" value={formData.image_url} onChange={handleInputChange} className="input-field" placeholder="https://example.com/image.jpg" required />
            </div>
          </div>
        </div>
        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate('/products')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={!isFormValid() || createProductMutation.isLoading} className="btn-primary flex items-center">
            {createProductMutation.isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Create Product
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProduct; 