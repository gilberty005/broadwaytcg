import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { Plus, X, Search } from 'lucide-react';

const Trade = () => {
  // Step state
  const [step, setStep] = useState(1);
  // Selected collection items (IDs)
  const [selectedCollection, setSelectedCollection] = useState([]);
  // Selected products to receive (product objects)
  const [selectedProducts, setSelectedProducts] = useState([]);
  // Filters and pagination for products
  const [productSearch, setProductSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  // Cash adjustment
  const [cashDelta, setCashDelta] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [modalForm, setModalForm] = useState({
    isGraded: false,
    grading_company: '',
    grade: '',
    condition: '',
    quantity: 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [fetchingPrices, setFetchingPrices] = useState(false);

  // Fetch user's collection
  const { data: collectionData, isLoading: collectionLoading } = useQuery(
    'collection',
    async () => {
      const response = await axios.get('/api/collections?page=1&limit=1000');
      return response.data;
    }
  );

  // Fetch product types, sets, rarities for filters
  const { data: typesData } = useQuery('productTypes', async () => {
    const response = await axios.get('/api/products/types/list');
    return response.data;
  });
  const { data: setsData } = useQuery('sets', async () => {
    const response = await axios.get('/api/products/sets/list');
    return response.data;
  });
  const { data: raritiesData } = useQuery('rarities', async () => {
    const response = await axios.get('/api/products/rarities/list');
    return response.data;
  });

  // Fetch products (for receiving)
  const { data: productsData, isLoading: productsLoading } = useQuery(
    ['products', currentPage, productSearch, selectedType, selectedSet, selectedRarity],
    async () => {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 12,
        search: productSearch,
        product_type: selectedType,
        set: selectedSet,
        rarity: selectedRarity
      });
      const response = await axios.get(`/api/products?${params}`);
      return response.data;
    }
  );

  // Helper: get selected collection items
  const selectedCollectionItems = collectionData?.collection?.filter(item => selectedCollection.includes(item.id)) || [];

  // Helper: sum investment cost
  const totalTradedInvestment = selectedCollectionItems.reduce((sum, item) => sum + (parseFloat(item.purchase_price) || 0), 0);
  const cash = parseFloat(cashDelta) || 0;
  const totalToAllocate = totalTradedInvestment + cash;

  // Calculate total market value of received items
  const totalMarketValue = selectedProducts.reduce(
    (sum, p) => sum + ((parseFloat(p.current_market_price) || 0) * (p.quantity || 1)),
    0
  );

  // Calculate investment allocation for each received item
  const getProductInvestment = (product) => {
    if (!totalMarketValue || !product.current_market_price) return totalToAllocate / (selectedProducts.length || 1);
    const itemMarketValue = (parseFloat(product.current_market_price) || 0) * (product.quantity || 1);
    return (totalToAllocate * itemMarketValue) / totalMarketValue;
  };

  // Open modal for product details
  const openProductModal = (product) => {
    setModalProduct(product);
    setModalForm({
      isGraded: false,
      grading_company: '',
      grade: '',
      condition: '',
      quantity: 1,
    });
    setShowProductModal(true);
  };

  // Close modal
  const closeProductModal = () => {
    setShowProductModal(false);
    setModalProduct(null);
    setModalForm({ isGraded: false, grading_company: '', grade: '', condition: '', quantity: 1 });
  };

  // Handle modal form input
  const handleModalInput = (e) => {
    const { name, value, type, checked } = e.target;
    setModalForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : (name === 'quantity' ? Math.max(1, parseInt(value) || 1) : value) }));
  };

  // Save product with details
  const handleModalSave = () => {
    let filtered = selectedProducts.filter(p => p.id !== modalProduct.id);
    filtered.push({
      ...modalProduct,
      isGraded: modalProduct.product_type === 'sealed_product' ? false : modalForm.isGraded,
      grading_company: modalProduct.product_type === 'sealed_product' ? '' : (modalForm.isGraded ? modalForm.grading_company : ''),
      grade: modalProduct.product_type === 'sealed_product' ? '' : (modalForm.isGraded ? modalForm.grade : ''),
      condition: modalProduct.product_type === 'sealed_product' ? '' : (!modalForm.isGraded ? modalForm.condition : ''),
      quantity: modalForm.quantity,
    });
    setSelectedProducts(filtered);
    closeProductModal();
  };

  // Remove product from selection
  const removeSelectedProduct = (id) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  // Helper: fetch missing market prices for selectedProducts
  const fetchMissingMarketPrices = async () => {
    setFetchingPrices(true);
    try {
      const updated = await Promise.all(selectedProducts.map(async (product) => {
        if (product.current_market_price == null) {
          // Fetch from backend
          const res = await axios.get(`/api/prices/product/${product.id}`);
          const price = res.data?.currentPrice;
          return { ...product, current_market_price: price };
        }
        return product;
      }));
      setSelectedProducts(updated);
    } catch (err) {
      alert('Failed to fetch market prices for some products.');
    } finally {
      setFetchingPrices(false);
    }
  };

  // Refresh all market prices before trade
  const refreshMarketPrices = async () => {
    setFetchingPrices(true);
    try {
      // First, refresh eBay prices for the user's collection
      await axios.post('/api/prices/update-ebay-prices');
      
      // Then fetch updated market prices for selected products
      const updated = await Promise.all(selectedProducts.map(async (product) => {
        try {
          const res = await axios.get(`/api/prices/product/${product.id}`);
          const price = res.data?.currentPrice;
          return { ...product, current_market_price: price };
        } catch (err) {
          console.error(`Failed to fetch price for ${product.name}:`, err);
          return product; // Keep original if fetch fails
        }
      }));
      setSelectedProducts(updated);
    } catch (err) {
      console.error('Failed to refresh market prices:', err);
      alert('Failed to refresh market prices. Please try again.');
    } finally {
      setFetchingPrices(false);
    }
  };

  // Step 1: Select from collection
  const renderStep1 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Select Cards to Trade Away</h2>
      {collectionLoading ? (
        <div>Loading collection...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {collectionData?.collection?.map(item => (
            <div key={item.id} className={`card p-4 flex items-center space-x-4 cursor-pointer border-2 ${selectedCollection.includes(item.id) ? 'border-blue-500' : 'border-transparent'}`} onClick={() => {
              setSelectedCollection(selectedCollection.includes(item.id)
                ? selectedCollection.filter(id => id !== item.id)
                : [...selectedCollection, item.id]);
            }}>
              <img src={item.image_url || '/placeholder-card.png'} alt={item.name} className="w-16 h-20 object-contain rounded" crossorigin="anonymous" />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-600">{item.set_name}</div>
                {item.grading_company && item.grade && (
                  <div className="text-xs text-gray-500">{item.grading_company} • Grade {item.grade}</div>
                )}
                <div className="text-xs text-gray-500">Investment: ${item.purchase_price}</div>
              </div>
              {selectedCollection.includes(item.id) && <X className="h-4 w-4 text-red-500" />}
            </div>
          ))}
        </div>
      )}
      <button className="btn-primary" disabled={selectedCollection.length === 0} onClick={() => setStep(2)}>Next: Select Cards to Receive</button>
    </div>
  );

  // Step 2: Select products to receive
  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Select Cards to Receive</h2>
      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={productSearch}
              onChange={e => { setProductSearch(e.target.value); setCurrentPage(1); }}
              className="input-field pl-10"
            />
          </div>
          <select
            value={selectedType}
            onChange={e => { setSelectedType(e.target.value); setCurrentPage(1); }}
            className="input-field"
          >
            <option value="">All Types</option>
            {typesData?.types?.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            value={selectedSet}
            onChange={e => { setSelectedSet(e.target.value); setCurrentPage(1); }}
            className="input-field"
          >
            <option value="">All Sets</option>
            {setsData?.sets?.map((set) => (
              <option key={set.set_code} value={set.set_code}>{set.set_name}</option>
            ))}
          </select>
          <select
            value={selectedRarity}
            onChange={e => { setSelectedRarity(e.target.value); setCurrentPage(1); }}
            className="input-field"
          >
            <option value="">All Rarities</option>
            {raritiesData?.rarities?.map((rarity) => (
              <option key={rarity} value={rarity}>{rarity}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end mt-2">
          <button
            className="btn-secondary"
            onClick={() => {
              setProductSearch('');
              setSelectedType('');
              setSelectedSet('');
              setSelectedRarity('');
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>
      {/* Products Grid */}
      {productsLoading ? (
        <div>Loading products...</div>
      ) : productsData?.products?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {productsData.products.map(product => {
            const isSelected = selectedProducts.some(p => p.id === product.id);
            return (
              <div key={product.id} className={`card p-4 flex items-center space-x-4 cursor-pointer border-2 ${isSelected ? 'border-green-500' : 'border-transparent'}`}
                onClick={() => {
                  if (isSelected) {
                    removeSelectedProduct(product.id);
                  } else {
                    openProductModal(product);
                  }
                }}
              >
                <img src={product.image_url || '/placeholder-card.png'} alt={product.name} className="w-16 h-20 object-contain rounded" crossorigin="anonymous" />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{product.name}</div>
                  <div className="text-xs text-gray-600">{product.set_name}</div>
                  {product.grading_company && product.grade && (
                    <div className="text-xs text-gray-500">{product.grading_company} • Grade {product.grade}</div>
                  )}
                  {product.rarity && (
                    <div className="text-xs text-gray-500">Rarity: {product.rarity}</div>
                  )}
                  {product.product_type && (
                    <div className="text-xs text-gray-500">Type: {product.product_type}</div>
                  )}
                  {isSelected && (
                    <div className="text-xs text-green-700 font-semibold mt-1">Selected</div>
                  )}
                </div>
                {isSelected && <X className="h-4 w-4 text-red-500" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600 mb-4">
            {productSearch || selectedType || selectedSet || selectedRarity
              ? 'Try adjusting your search criteria'
              : 'No products have been added to the database yet'}
          </p>
        </div>
      )}
      {/* Pagination */}
      {productsData?.pagination && productsData.pagination.totalPages > 1 && (
        <div className="flex justify-center mt-4">
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
      <div className="flex justify-between mt-6">
        <button className="btn-secondary mr-2" onClick={() => setStep(1)}>Back</button>
        <button className="btn-primary" disabled={selectedProducts.length === 0} onClick={() => setStep(3)}>Next: Add Cash</button>
      </div>
      {/* Product Details Modal */}
      {showProductModal && modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={closeProductModal}>
              <span className="text-2xl">&times;</span>
            </button>
            <h2 className="text-xl font-bold mb-4">Specify Product Details</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
              <input
                type="number"
                name="quantity"
                min="1"
                value={modalForm.quantity}
                onChange={handleModalInput}
                className="input-field"
              />
            </div>
            {modalProduct.product_type !== 'sealed_product' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Is this card graded?</label>
                  <input
                    type="checkbox"
                    name="isGraded"
                    checked={modalForm.isGraded}
                    onChange={handleModalInput}
                    className="mr-2"
                    id="isGraded"
                  />
                  <label htmlFor="isGraded" className="text-sm">Yes</label>
                </div>
                {modalForm.isGraded ? (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Grading Company</label>
                      <input
                        type="text"
                        name="grading_company"
                        value={modalForm.grading_company}
                        onChange={handleModalInput}
                        className="input-field"
                        placeholder="e.g. PSA, BGS, CGC"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
                      <input
                        type="text"
                        name="grade"
                        value={modalForm.grade}
                        onChange={handleModalInput}
                        className="input-field"
                        placeholder="e.g. 9, 10"
                      />
                    </div>
                  </>
                ) : (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Condition</label>
                    <select
                      name="condition"
                      value={modalForm.condition}
                      onChange={handleModalInput}
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
                )}
              </>
            )}
            <div className="flex justify-end space-x-2 mt-4">
              <button type="button" className="btn-secondary" onClick={closeProductModal}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleModalSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Step 3: Enter cash adjustment
  const renderStep3 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Add Cash Adjustment</h2>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Cash (positive: you add, negative: you receive)</label>
        <input
          type="number"
          value={cashDelta}
          onChange={e => setCashDelta(e.target.value)}
          className="input-field w-40"
        />
      </div>
      <button className="btn-secondary mr-2" onClick={() => setStep(2)}>Back</button>
      <button className="btn-primary" onClick={() => setStep(4)}>Next: Review & Confirm</button>
    </div>
  );

  // Submit trade to backend
  const handleConfirmTrade = async () => {
    setSubmitting(true);
    try {
      // Step 1: Refresh market prices first
      await refreshMarketPrices();
      
      // Step 2: Check for missing market prices after refresh
      const missing = selectedProducts.some(p => p.current_market_price == null);
      if (missing) {
        alert('Some products are still missing market prices after refresh. Please try again.');
        setSubmitting(false);
        return;
      }

      // Step 3: Prepare trade data with proper investment allocation
      const tradeData = {
        traded_away: selectedCollectionItems.map(item => ({
          id: item.id,
          product_id: item.product_id,
          purchase_price: parseFloat(item.purchase_price) || 0,
          market_price: parseFloat(item.current_market_price) || 0,
          grading_company: item.grading_company,
          grade: item.grade,
          condition: item.condition,
          quantity: item.quantity,
        })),
        received: selectedProducts.map(product => {
          const investment = getProductInvestment(product);
          return {
            id: product.id,
            name: product.name,
            product_type: product.product_type,
            set_name: product.set_name,
            grading_company: product.isGraded ? product.grading_company : '',
            grade: product.isGraded ? product.grade : '',
            condition: !product.isGraded ? product.condition : '',
            quantity: product.quantity,
            purchase_price: investment,
            market_price: parseFloat(product.current_market_price) || 0,
          };
        }),
        cash_delta: parseFloat(cashDelta) || 0,
      };

      console.log('Submitting trade data:', tradeData);

      // Step 4: Submit trade
      const response = await axios.post('/api/collections/trades', tradeData);
      
      console.log('Trade response:', response.data);
      
      alert('Trade submitted successfully!');
      // Reset state
      setStep(1);
      setSelectedCollection([]);
      setSelectedProducts([]);
      setCashDelta('');
    } catch (error) {
      console.error('Trade submission error:', error);
      alert('Failed to submit trade: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Step 4: Review summary
  const renderStep4 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Review Trade</h2>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold mb-2">You Trade Away</h3>
          {selectedCollectionItems.map(item => (
            <div key={item.id} className="flex items-center space-x-3 mb-2">
              <img src={item.image_url || '/placeholder-card.png'} alt={item.name} className="w-10 h-14 object-contain rounded" crossorigin="anonymous" />
              <div>
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-600">{item.set_name}</div>
                {item.grading_company && item.grade && (
                  <div className="text-xs text-gray-500">{item.grading_company} • Grade {item.grade}</div>
                )}
                <div className="text-xs text-gray-500">Investment: ${item.purchase_price}</div>
              </div>
            </div>
          ))}
          <div className="mt-2 text-sm text-gray-700">Total Investment: <span className="font-semibold">${totalTradedInvestment.toFixed(2)}</span></div>
        </div>
        <div>
          <h3 className="font-semibold mb-2">You Receive</h3>
          {selectedProducts.map(product => (
            <div key={product.id} className="flex items-center space-x-3 mb-2">
              <img src={product.image_url || '/placeholder-card.png'} alt={product.name} className="w-10 h-14 object-contain rounded" crossorigin="anonymous" />
              <div>
                <div className="font-medium text-gray-900">{product.name}</div>
                <div className="text-xs text-gray-600">{product.set_name}</div>
                {product.grading_company && product.grade && (
                  <div className="text-xs text-gray-500">{product.grading_company} • Grade {product.grade}</div>
                )}
                <div className="text-xs text-gray-500">Investment: ${getProductInvestment(product).toFixed(2)}</div>
              </div>
            </div>
          ))}
          <div className="mt-2 text-sm text-gray-700">Total Investment Allocated: <span className="font-semibold">${totalToAllocate.toFixed(2)}</span></div>
          <div className="text-xs text-gray-500">(Split evenly across received cards)</div>
        </div>
      </div>
      <div className="mb-4">
        <span className="font-medium">Cash Adjustment:</span> ${cash.toFixed(2)}
      </div>
      <button className="btn-secondary mr-2" onClick={() => setStep(3)}>Back</button>
      <button className="btn-primary" onClick={handleConfirmTrade} disabled={submitting || fetchingPrices}>
        {submitting ? 'Submitting...' : 'Confirm Trade'}
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Trade</h1>
      <div className="card p-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
};

export default Trade; 