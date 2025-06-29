import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Search, 
  Plus, 
  Eye,
  Heart,
  Edit,
  Upload,
  X
} from 'lucide-react';

const Products = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inGrading, setInGrading] = useState(false);
  const [collectionForm, setCollectionForm] = useState({
    purchase_price: '',
    grading_company: '',
    grade: '',
    condition: '',
    raw_card_cost: '',
    grading_cost: '',
    predicted_grade: '',
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);

  // Fetch products data
  const { data: productsData, isLoading, error } = useQuery(
    ['products', currentPage, searchTerm, selectedType, selectedSet],
    async () => {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 12,
        search: searchTerm,
        product_type: selectedType,
        set: selectedSet,
      });
      
      const response = await axios.get(`/api/products?${params}`);
      return response.data;
    }
  );

  // Fetch product types and sets for filters
  const { data: typesData } = useQuery('productTypes', async () => {
    const response = await axios.get('/api/products/types/list');
    return response.data;
  });

  const { data: setsData } = useQuery('sets', async () => {
    const response = await axios.get('/api/products/sets/list');
    return response.data;
  });

  const collectionMutation = useMutation(
    async ({ productId, data }) => {
      await axios.post(`/api/collections`, { product_id: productId, ...data });
    },
    {
      onSuccess: () => {
        setShowModal(false);
        setSelectedProduct(null);
        setCollectionForm({ purchase_price: '', grading_company: '', grade: '', condition: '', raw_card_cost: '', grading_cost: '', predicted_grade: '' });
        queryClient.invalidateQueries({ queryKey: ['collection'] });
        alert('Added to collection!');
      },
      onError: () => {
        alert('Failed to add to collection.');
      }
    }
  );

  const editMutation = useMutation(
    async ({ productId, data }) => {
      await axios.put(`/api/products/${productId}`, data);
    },
    {
      onSuccess: () => {
        setShowEditModal(false);
        setSelectedProduct(null);
        setEditForm({});
        queryClient.invalidateQueries(['products']);
        alert('Product updated!');
      },
      onError: () => {
        alert('Failed to update product.');
      }
    }
  );

  const openCollectionModal = (product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const closeCollectionModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
    setCollectionForm({ purchase_price: '', grading_company: '', grade: '', condition: '', raw_card_cost: '', grading_cost: '', predicted_grade: '' });
  };

  const handleCollectionInput = (e) => {
    const { name, value, checked } = e.target;
    if (name === 'inGrading') {
      setInGrading(checked);
    } else {
      setCollectionForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Update purchase_price automatically if inGrading is checked
  useEffect(() => {
    if (inGrading) {
      const raw = parseFloat(collectionForm.raw_card_cost) || 0;
      const grading = parseFloat(collectionForm.grading_cost) || 0;
      setCollectionForm((prev) => ({
        ...prev,
        purchase_price: (raw + grading).toFixed(2)
      }));
    }
  }, [inGrading, collectionForm.raw_card_cost, collectionForm.grading_cost]);

  const handleCollectionSubmit = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const data = { purchase_price: collectionForm.purchase_price };
    if (selectedProduct.product_type !== 'sealed_product') {
      if (inGrading) {
        // In grading workflow
        if (!collectionForm.raw_card_cost || !collectionForm.grading_cost) {
          alert('Please fill out all grading fields.');
          return;
        }
        data.grading_status = 'grading';
        data.raw_card_cost = collectionForm.raw_card_cost;
        data.grading_cost = collectionForm.grading_cost;
        // purchase_price is already set to sum
      } else if (collectionForm.grading_company && collectionForm.grade) {
        data.grading_company = collectionForm.grading_company;
        data.grade = collectionForm.grade;
      } else if (collectionForm.condition) {
        data.condition = collectionForm.condition;
      } else {
        alert('Please specify either grading company + grade, card condition, or use the grading workflow.');
        return;
      }
    }
    collectionMutation.mutate({ productId: selectedProduct.id, data });
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setEditForm({ ...product });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedProduct(null);
    setEditForm({});
  };

  const handleEditInput = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    editMutation.mutate({ productId: selectedProduct.id, data: editForm });
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
    setImageUploading(true);
    setImageUploadError('');
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await axios.post('/api/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditForm((prev) => ({ ...prev, image_url: response.data.imageUrl }));
    } catch (err) {
      setImageUploadError('Failed to upload image.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageUrlChange = (e) => {
    setEditForm((prev) => ({ ...prev, image_url: e.target.value }));
    setImagePreview(null);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setEditForm((prev) => ({ ...prev, image_url: '' }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading products</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pokemon Products</h1>
            <p className="text-gray-600">Browse and search all available Pokemon products</p>
          </div>
          <Link to="/products/add" className="btn-primary flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Add New Product
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="input-field"
          >
            <option value="">All Types</option>
            {typesData?.types?.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
            className="input-field"
          >
            <option value="">All Sets</option>
            {setsData?.sets?.map((set) => (
              <option key={set.set_code} value={set.set_code}>
                {set.set_name}
              </option>
            ))}
          </select>

          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedType('');
              setSelectedSet('');
              setCurrentPage(1);
            }}
            className="btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Products Grid */}
      {productsData?.products?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {productsData.products.map((product) => (
            <div key={product.id} className="card overflow-hidden hover:shadow-lg transition-shadow duration-200">
              <div className="relative">
                <img
                  src={product.image_url || '/placeholder-card.png'}
                  alt={product.name}
                  className="w-full h-40 object-contain bg-white rounded"
                  crossOrigin="anonymous"
                />
                <div className="absolute top-2 right-2 flex space-x-1">
                  <button className="p-1 bg-white rounded-full shadow-md hover:bg-gray-100">
                    <Eye className="h-4 w-4 text-gray-600" />
                  </button>
                  <button className="p-1 bg-white rounded-full shadow-md hover:bg-red-100">
                    <Heart className="h-4 w-4 text-red-600" />
                  </button>
                  <button className="p-1 bg-white rounded-full shadow-md hover:bg-yellow-100" onClick={() => openEditModal(product)}>
                    <Edit className="h-4 w-4 text-yellow-600" />
                  </button>
                </div>
                {product.rarity && (
                  <div className="absolute bottom-2 left-2">
                    <span className="px-2 py-1 text-xs font-medium bg-black bg-opacity-75 text-white rounded">
                      {product.rarity}
                    </span>
                  </div>
                )}
                {product.product_type && (
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded">
                      {product.product_type}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{product.set_name}</p>
                
                <div className="flex justify-between items-center text-sm mb-3 min-h-[1.5rem]">
                  <span className="text-gray-500">
                    {product.card_number ? `#${product.card_number}` : ''}
                  </span>
                  {product.pokemon_type && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {product.pokemon_type}
                    </span>
                  )}
                </div>
                
                {product.hp && (
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <span className="font-medium">HP:</span>
                    <span className="ml-1">{product.hp}</span>
                  </div>
                )}
                
                {product.grade && (
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <span className="font-medium">Grade:</span>
                    <span className="ml-1">{product.grade} ({product.grading_company})</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <button className="btn-secondary text-sm py-1 px-3">
                    View Details
                  </button>
                  <button
                    className="btn-primary text-sm py-1 px-3"
                    onClick={() => openCollectionModal(product)}
                  >
                    Add to Collection
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Search className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || selectedType || selectedSet 
              ? 'Try adjusting your search criteria'
              : 'No products have been added to the database yet'
            }
          </p>
          {!searchTerm && !selectedType && !selectedSet && (
            <Link to="/products/add" className="btn-primary flex items-center justify-center text-lg px-8 py-3">
              <Plus className="h-5 w-5 mr-2" />
              Add First Product
            </Link>
          )}
        </div>
      )}

      {/* Pagination */}
      {productsData?.pagination && productsData.pagination.totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <nav className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            
            {Array.from({ length: productsData.pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  page === currentPage
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === productsData.pagination.totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </div>
      )}

      {/* Results Summary */}
      {productsData?.pagination && (
        <div className="text-center mt-4 text-sm text-gray-600">
          Showing {((currentPage - 1) * productsData.pagination.itemsPerPage) + 1} to{' '}
          {Math.min(currentPage * productsData.pagination.itemsPerPage, productsData.pagination.totalItems)} of{' '}
          {productsData.pagination.totalItems} products
        </div>
      )}

      {/* Add to Collection Modal */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={closeCollectionModal}>
              <span className="text-2xl">&times;</span>
            </button>
            <h2 className="text-xl font-bold mb-4">Add to Collection</h2>
            <form onSubmit={handleCollectionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price Paid *</label>
                <input
                  type="number"
                  name="purchase_price"
                  value={collectionForm.purchase_price}
                  onChange={handleCollectionInput}
                  className="input-field"
                  min="0"
                  step="0.01"
                  required
                  disabled={inGrading}
                />
              </div>
              {selectedProduct.product_type !== 'sealed_product' && (
                <>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="inGrading"
                      name="inGrading"
                      checked={inGrading}
                      onChange={handleCollectionInput}
                      className="mr-2"
                    />
                    <label htmlFor="inGrading" className="text-sm font-medium text-gray-700">
                      This card is being sent for grading
                    </label>
                  </div>
                  {inGrading ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Raw Card Cost *</label>
                        <input
                          type="number"
                          name="raw_card_cost"
                          value={collectionForm.raw_card_cost}
                          onChange={handleCollectionInput}
                          className="input-field"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Grading Cost *</label>
                        <input
                          type="number"
                          name="grading_cost"
                          value={collectionForm.grading_cost}
                          onChange={handleCollectionInput}
                          className="input-field"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Grading Company (if graded)</label>
                        <input
                          type="text"
                          name="grading_company"
                          value={collectionForm.grading_company}
                          onChange={handleCollectionInput}
                          className="input-field"
                          placeholder="e.g. PSA, BGS, CGC"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Grade (if graded)</label>
                        <input
                          type="text"
                          name="grade"
                          value={collectionForm.grade}
                          onChange={handleCollectionInput}
                          className="input-field"
                          placeholder="e.g. 9, 10"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Card Condition (if raw)</label>
                        <select
                          name="condition"
                          value={collectionForm.condition}
                          onChange={handleCollectionInput}
                          className="input-field"
                        >
                          <option value="">Select Condition</option>
                          <option value="Near Mint">Near Mint</option>
                          <option value="Lightly Played">Lightly Played</option>
                          <option value="Moderately Played">Moderately Played</option>
                          <option value="Heavily Played">Heavily Played</option>
                          <option value="Damaged">Damaged</option>
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" className="btn-secondary" onClick={closeCollectionModal}>Cancel</button>
                <button type="submit" className="btn-primary">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-lg relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={closeEditModal}>
              <span className="text-2xl">&times;</span>
            </button>
            <h2 className="text-xl font-bold mb-4">Edit Product</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name || ''}
                  onChange={handleEditInput}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Set Name</label>
                <input
                  type="text"
                  name="set_name"
                  value={editForm.set_name || ''}
                  onChange={handleEditInput}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                <input
                  type="text"
                  name="card_number"
                  value={editForm.card_number || ''}
                  onChange={handleEditInput}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rarity</label>
                <input
                  type="text"
                  name="rarity"
                  value={editForm.rarity || ''}
                  onChange={handleEditInput}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
                <div className="space-y-4">
                  <div>
                    <label className="cursor-pointer">
                      <div className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <Upload className="h-5 w-5 mr-2" />
                        Choose File
                      </div>
                      <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" disabled={imageUploading} />
                    </label>
                    {imageUploading && (
                      <div className="flex items-center text-sm text-gray-600 mt-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                        Uploading...
                      </div>
                    )}
                  </div>
                  {(imagePreview || editForm.image_url) && (
                    <div className="relative">
                      <img src={imagePreview || editForm.image_url} alt="Product preview" className="w-32 h-32 object-contain rounded-lg border" />
                      <button type="button" onClick={handleRemoveImage} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Or enter image URL</label>
                    <input type="url" name="image_url" value={editForm.image_url} onChange={handleImageUrlChange} className="input-field" placeholder="https://example.com/image.jpg" />
                  </div>
                  {imageUploadError && <div className="text-xs text-red-600 mt-1">{imageUploadError}</div>}
                </div>
              </div>
              <button type="submit" className="btn-primary w-full">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products; 