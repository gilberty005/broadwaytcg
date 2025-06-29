import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  FolderOpen,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Collection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [selectedProductType, setSelectedProductType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [gradingItem, setGradingItem] = useState(null);
  const [gradingForm, setGradingForm] = useState({ grading_company: '', grade: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ purchase_price: '', raw_card_cost: '', grading_cost: '', inGrading: false });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteForm, setDeleteForm] = useState({ sold_price: '', wasSold: false });

  const queryClient = useQueryClient();

  // Fetch collection data
  const { data: collectionData, isLoading, error } = useQuery(
    ['collection', currentPage, searchTerm, selectedSet],
    async () => {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 12,
        search: searchTerm,
        set: selectedSet
      });
      
      const response = await axios.get(`/api/collections?${params}`);
      return response.data;
    }
  );

  // Fetch collection statistics
  const { data: stats } = useQuery(
    'collectionStats',
    async () => {
      const response = await axios.get('/api/collections/stats');
      return response.data;
    }
  );

  // Fetch available sets from user's collection
  const { data: setsData } = useQuery(
    'collectionSets',
    async () => {
      const response = await axios.get('/api/collections/sets');
      return response.data;
    }
  );

  // eBay price update mutation
  const updateEbayPricesMutation = useMutation(
    async () => {
      const response = await axios.post('/api/prices/update-ebay-prices');
      return response.data;
    },
    {
      onSuccess: (data) => {
        alert(`Successfully updated eBay prices for ${data.updatedCount} products!`);
        queryClient.invalidateQueries('collection');
        queryClient.invalidateQueries('collectionStats');
      },
      onError: (error) => {
        alert(`Failed to update eBay prices: ${error.response?.data?.error || error.message}`);
      }
    }
  );

  const deleteMutation = useMutation(
    async ({ collectionId, sold_price }) => {
      await axios.delete(`/api/collections/${collectionId}`, {
        data: { sold_price }
      });
    },
    {
      onSuccess: () => {
        setShowDeleteModal(false);
        setDeleteItem(null);
        setDeleteForm({ sold_price: '', wasSold: false });
        queryClient.invalidateQueries('collection');
        queryClient.invalidateQueries('collectionStats');
      },
      onError: () => {
        alert('Failed to delete item.');
      }
    }
  );

  const handleDelete = (item) => {
    setDeleteItem(item);
    setShowDeleteModal(true);
    setDeleteForm({ sold_price: '', wasSold: false });
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteItem(null);
    setDeleteForm({ sold_price: '', wasSold: false });
  };

  const handleDeleteInput = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'wasSold') {
      setDeleteForm((prev) => ({ ...prev, wasSold: checked }));
    } else {
      setDeleteForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleDeleteSubmit = (e) => {
    e.preventDefault();
    if (!deleteItem) return;
    
    const sold_price = deleteForm.wasSold ? deleteForm.sold_price : null;
    deleteMutation.mutate({ collectionId: deleteItem.id, sold_price });
  };

  const handleUpdateEbayPrices = () => {
    if (window.confirm('This will fetch current eBay prices for all products in your collection. This may take a few minutes. Continue?')) {
      updateEbayPricesMutation.mutate();
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatPercentage = (value) => {
    // Handle null, undefined, or non-numeric values
    if (value === null || value === undefined || isNaN(value) || typeof value !== 'number') {
      return '0%';
    }
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Helper to calculate total market price
  const getTotalMarketPrice = () => {
    if (!collectionData?.collection) return 0;
    return collectionData.collection.reduce((sum, item) => {
      if (item.current_market_price) {
        return sum + (item.current_market_price * (item.quantity || 1));
      }
      return sum;
    }, 0);
  };

  const handleOpenGradingModal = (item) => {
    setGradingItem(item);
    setGradingForm({ grading_company: '', grade: '' });
    setShowGradingModal(true);
  };

  const handleCloseGradingModal = () => {
    setShowGradingModal(false);
    setGradingItem(null);
  };

  const handleGradingInput = (e) => {
    const { name, value } = e.target;
    setGradingForm((prev) => ({ ...prev, [name]: value }));
  };

  const gradingMutation = useMutation(
    async ({ id, data }) => {
      await axios.put(`/api/collections/${id}`, data);
    },
    {
      onSuccess: () => {
        setShowGradingModal(false);
        setGradingItem(null);
        queryClient.invalidateQueries('collection');
        queryClient.invalidateQueries('collectionStats');
        alert('Updated to graded!');
      },
      onError: () => {
        alert('Failed to update grading info.');
      }
    }
  );

  const handleGradingSubmit = (e) => {
    e.preventDefault();
    if (!gradingItem) return;
    gradingMutation.mutate({
      id: gradingItem.id,
      data: {
        grading_company: gradingForm.grading_company,
        grade: gradingForm.grade,
        grading_status: 'graded'
      }
    });
  };

  // Grouping logic before rendering the collection grid
  const groupCollection = (items) => {
    const groups = {};
    for (const item of items) {
      let key;
      if (item.grading_company && item.grade) {
        // Graded card: group by product_id, grading_company, grade
        key = [
          item.product_id,
          (item.grading_company || '').trim().toLowerCase(),
          (item.grade || '').trim().toLowerCase()
        ].join('|');
      } else if (item.product_type === 'sealed_product') {
        // Sealed product: group by product_id
        key = [item.product_id].join('|');
      } else {
        // Raw card: group by product_id, condition
        key = [
          item.product_id,
          (item.condition || '').trim().toLowerCase()
        ].join('|');
      }
      if (!groups[key]) {
        groups[key] = {
          ...item,
          quantity: 0,
          total_investment: 0,
          items: []
        };
      }
      groups[key].quantity += item.quantity || 1;
      groups[key].total_investment += (parseFloat(item.purchase_price) || 0) * (item.quantity || 1);
      groups[key].items.push(item);
    }
    // Calculate mean investment for each group
    return Object.values(groups).map(group => {
      const totalCards = group.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
      return {
        ...group,
        mean_investment: totalCards > 0 ? group.total_investment / totalCards : 0,
        quantity: totalCards
      };
    });
  };

  // Edit mutation
  const editMutation = useMutation(
    async ({ id, data }) => {
      await axios.put(`/api/collections/${id}`, data);
    },
    {
      onSuccess: () => {
        setShowEditModal(false);
        setEditItem(null);
        setEditForm({ purchase_price: '', raw_card_cost: '', grading_cost: '', inGrading: false });
        queryClient.invalidateQueries('collection');
        queryClient.invalidateQueries('collectionStats');
        alert('Updated!');
      },
      onError: () => {
        alert('Failed to update item.');
      }
    }
  );

  const handleOpenEditModal = (item) => {
    setEditItem(item);
    setShowEditModal(true);
    setEditForm({
      purchase_price: item.purchase_price || '',
      raw_card_cost: item.raw_card_cost || '',
      grading_cost: item.grading_cost || '',
      inGrading: item.grading_status === 'grading',
    });
  };

  const handleEditInput = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'inGrading') {
      setEditForm((prev) => ({ ...prev, inGrading: checked }));
    } else {
      setEditForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Auto-calculate purchase_price if inGrading is checked
  React.useEffect(() => {
    if (editForm.inGrading) {
      const raw = parseFloat(editForm.raw_card_cost) || 0;
      const grading = parseFloat(editForm.grading_cost) || 0;
      setEditForm((prev) => ({ ...prev, purchase_price: (raw + grading).toFixed(2) }));
    }
  }, [editForm.inGrading, editForm.raw_card_cost, editForm.grading_cost]);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editItem) return;
    const data = { purchase_price: editForm.purchase_price };
    if (editForm.inGrading) {
      if (!editForm.raw_card_cost || !editForm.grading_cost) {
        alert('Please fill out all grading fields.');
        return;
      }
      data.grading_status = 'grading';
      data.raw_card_cost = editForm.raw_card_cost;
      data.grading_cost = editForm.grading_cost;
    }
    editMutation.mutate({ id: editItem.id, data });
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
          <p className="text-red-600 mb-4">Error loading collection</p>
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

  // Only run filtering and grouping if data is loaded
  let groupedCollection = [];
  if (collectionData && Array.isArray(collectionData.collection)) {
    // Apply frontend filtering for product type BEFORE grouping
    const filteredRawCollection = collectionData.collection.filter(item => {
      if (!selectedProductType || selectedProductType === '') return true;
      if (selectedProductType === 'raw_card') {
        // Raw Card: no grading_company and no grade, not sealed, not in grading
        return !item.grading_company && !item.grade && item.product_type !== 'sealed_product' && item.grading_status !== 'grading';
      }
      if (selectedProductType === 'graded_card') {
        // Graded Card: has both grading_company and grade
        return !!item.grading_company && !!item.grade;
      }
      if (selectedProductType === 'grading') {
        // In Grading: grading_status === 'grading'
        return item.grading_status === 'grading';
      }
      if (selectedProductType === 'sealed_product') {
        return item.product_type === 'sealed_product';
      }
      return true;
    });
    // Now group the filtered collection
    groupedCollection = groupCollection(filteredRawCollection);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Collection</h1>
            <p className="text-gray-600">Manage your Pokemon card collection</p>
          </div>
          <button
            onClick={handleUpdateEbayPrices}
            disabled={updateEbayPricesMutation.isLoading}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${updateEbayPricesMutation.isLoading ? 'animate-spin' : ''}`} />
            {updateEbayPricesMutation.isLoading ? 'Updating...' : 'Update eBay Prices'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Investment</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.basicStats?.total_investment)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Cards</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.basicStats?.total_cards || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sealed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.basicStats?.total_quantity || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Market Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(getTotalMarketPrice())}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="card p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search your collection..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <select
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
            className="input-field"
          >
            <option value="">All Sets</option>
            {setsData?.sets?.map((set) => (
              <option key={set.set_name} value={set.set_name}>
                {set.set_name}
              </option>
            ))}
          </select>

          <select
            value={selectedProductType}
            onChange={(e) => setSelectedProductType(e.target.value)}
            className="input-field"
          >
            <option value="">All Types</option>
            <option value="graded_card">Graded Card</option>
            <option value="raw_card">Raw Card</option>
            <option value="grading">In Grading</option>
            <option value="sealed_product">Sealed Product</option>
          </select>
        </div>
      </div>

      {/* Collection Grid */}
      {groupedCollection.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {groupedCollection.map((item) => (
            <div key={[
              item.product_id,
              item.grading_status,
              item.grade,
              item.grading_company,
              item.condition
            ].join('|')} className="card overflow-hidden">
              <div className="relative">
                <img
                  src={item.image_url || '/placeholder-card.png'}
                  alt={item.name}
                  className="w-full h-40 object-contain bg-white rounded"
                  crossOrigin="anonymous"
                />
                <div className="absolute top-2 right-2 flex space-x-1">
                  <button className="p-1 bg-white rounded-full shadow-md hover:bg-gray-100" onClick={() => handleOpenEditModal(item)}>
                    <Edit className="h-4 w-4 text-gray-600" />
                  </button>
                  <button className="p-1 bg-white rounded-full shadow-md hover:bg-red-100" onClick={() => handleDelete(item)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{item.set_name}</p>
                
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Qty: {item.quantity}</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.mean_investment)}
                    </span>
                  </div>
                  
                  {/* Current Market Price */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Market Price:</span>
                    <span className="font-medium text-green-600">
                      {item.current_market_price ? formatCurrency(item.current_market_price) : 'N/A'}
                    </span>
                  </div>
                  
                  {/* Price Change */}
                  {item.current_market_price && item.mean_investment && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Change:</span>
                      <span className={`font-medium ${
                        (item.current_market_price - item.mean_investment) >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {formatCurrency(item.current_market_price - item.mean_investment)}
                        {' '}
                        ({formatPercentage(
                          ((item.current_market_price - item.mean_investment) / item.mean_investment) * 100
                        )})
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Grading/Condition/Sealed Product Info */}
                {item.product_type === 'sealed_product' ? (
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="font-medium">Sealed Product</span>
                  </div>
                ) : item.grading_company && item.grade ? (
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="font-medium">{item.grading_company}</span>
                    <span className="mx-1">•</span>
                    <span className="font-medium">Grade {item.grade}</span>
                  </div>
                ) : item.condition ? (
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="font-medium">Condition: {item.condition}</span>
                  </div>
                ) : null}
                
                {item.grading_status === 'grading' && (
                  <div className="mt-2 text-xs text-blue-600 font-semibold flex items-center">
                    <span>Being Graded</span>
                    {item.predicted_grade && (
                      <span className="ml-2">(Predicted Grade: {item.predicted_grade})</span>
                    )}
                    <button
                      className="ml-2 btn-xs btn-primary"
                      onClick={() => handleOpenGradingModal(item)}
                    >
                      Update to Graded
                    </button>
                  </div>
                )}
                
                {item.purchase_date && (
                  <p className="text-xs text-gray-500 mt-1">
                    Purchased: {new Date(item.purchase_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <FolderOpen className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">No products in your collection</h3>
          <p className="text-gray-600 mb-6">Start building your collection by adding your first Pokemon product!</p>
          <Link to="/products/add" className="btn-primary flex items-center justify-center text-lg px-8 py-3">
            <Plus className="h-5 w-5 mr-2" />
            Add Your First Product
          </Link>
        </div>
      )}

      {/* Pagination */}
      {collectionData?.pagination && collectionData.pagination.totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <nav className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            
            {Array.from({ length: collectionData.pagination.totalPages }, (_, i) => i + 1).map((page) => (
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
              disabled={currentPage === collectionData.pagination.totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </div>
      )}

      {showGradingModal && gradingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={handleCloseGradingModal}>
              <span className="text-2xl">&times;</span>
            </button>
            <h2 className="text-xl font-bold mb-4">Update to Graded</h2>
            <form onSubmit={handleGradingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grading Company</label>
                <input
                  type="text"
                  name="grading_company"
                  value={gradingForm.grading_company}
                  onChange={handleGradingInput}
                  className="input-field"
                  placeholder="e.g. PSA, BGS, CGC"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
                <input
                  type="text"
                  name="grade"
                  value={gradingForm.grade}
                  onChange={handleGradingInput}
                  className="input-field"
                  placeholder="e.g. 9, 10"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" className="btn-secondary" onClick={handleCloseGradingModal}>Cancel</button>
                <button type="submit" className="btn-primary">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={() => setShowEditModal(false)}>
              <span className="text-2xl">&times;</span>
            </button>
            <h2 className="text-xl font-bold mb-4">Edit Collection Item</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Investment Price *</label>
                <input
                  type="number"
                  name="purchase_price"
                  value={editForm.purchase_price}
                  onChange={handleEditInput}
                  className="input-field"
                  min="0"
                  step="0.01"
                  required
                  disabled={editForm.inGrading}
                />
              </div>
              {/* Only allow grading workflow for raw cards */}
              {!editItem.grading_company && !editItem.grade && editItem.product_type !== 'sealed_product' && editItem.grading_status !== 'grading' && (
                <>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="inGradingEdit"
                      name="inGrading"
                      checked={editForm.inGrading}
                      onChange={handleEditInput}
                      className="mr-2"
                    />
                    <label htmlFor="inGradingEdit" className="text-sm font-medium text-gray-700">
                      Send this card for grading
                    </label>
                  </div>
                  {editForm.inGrading && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Raw Card Cost *</label>
                        <input
                          type="number"
                          name="raw_card_cost"
                          value={editForm.raw_card_cost}
                          onChange={handleEditInput}
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
                          value={editForm.grading_cost}
                          onChange={handleEditInput}
                          className="input-field"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={handleCloseDeleteModal}>
              <span className="text-2xl">&times;</span>
            </button>
            <h2 className="text-xl font-bold mb-4">Remove from Collection</h2>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">{deleteItem.name}</h3>
              <p className="text-sm text-gray-600">{deleteItem.set_name}</p>
              {deleteItem.grading_company && deleteItem.grade && (
                <p className="text-sm text-gray-600">{deleteItem.grading_company} {deleteItem.grade}</p>
              )}
              <p className="text-sm text-gray-600">Investment: {formatCurrency(deleteItem.purchase_price || 0)}</p>
            </div>
            <form onSubmit={handleDeleteSubmit} className="space-y-4">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="wasSold"
                  name="wasSold"
                  checked={deleteForm.wasSold}
                  onChange={handleDeleteInput}
                  className="mr-2"
                />
                <label htmlFor="wasSold" className="text-sm font-medium text-gray-700">
                  I sold this item
                </label>
              </div>
              {deleteForm.wasSold && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sold Price *</label>
                  <input
                    type="number"
                    name="sold_price"
                    value={deleteForm.sold_price}
                    onChange={handleDeleteInput}
                    className="input-field"
                    min="0"
                    step="0.01"
                    required
                    placeholder="Enter the price you sold it for"
                  />
                </div>
              )}
              <div className="text-sm text-gray-600">
                {deleteForm.wasSold ? (
                  <p>This will record the sale and update your lifetime earnings with the profit/loss.</p>
                ) : (
                  <p>This will remove the item and add your investment back to lifetime earnings (assuming it was added by mistake).</p>
                )}
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" className="btn-secondary" onClick={handleCloseDeleteModal}>Cancel</button>
                <button type="submit" className="btn-primary">Remove Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collection; 