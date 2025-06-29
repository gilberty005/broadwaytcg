import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  FolderOpen, 
  TrendingUp, 
  DollarSign, 
  Plus, 
  Search, 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown
} from 'lucide-react';

const Dashboard = () => {
  // Fetch collection stats
  const { data: stats, isLoading: statsLoading } = useQuery(
    'collectionStats',
    async () => {
      const response = await axios.get('/api/collections/stats');
      return response.data;
    }
  );

  // Fetch full collection data for accurate market price and profit/loss
  const { data: collectionData, isLoading: collectionLoading } = useQuery(
    'collection',
    async () => {
      const response = await axios.get('/api/collections?page=1&limit=10000');
      return response.data;
    }
  );

  // Fetch recent collection items
  const { data: recentCollection, isLoading: recentLoading } = useQuery(
    'recentCollection',
    async () => {
      const response = await axios.get('/api/collections?limit=6');
      return response.data;
    }
  );

  // Fetch price alerts
  const { data: priceAlerts, isLoading: alertsLoading } = useQuery(
    'priceAlerts',
    async () => {
      const response = await axios.get('/api/prices/alerts');
      return response.data;
    }
  );

  const quickActions = [
    {
      title: 'Add Product to Collection',
      description: 'Add a new Pokemon product to your collection',
      icon: Plus,
      href: '/products/add',
      color: 'bg-blue-500'
    },
    {
      title: 'Browse Products',
      description: 'Search and browse all available products',
      icon: Search,
      href: '/products',
      color: 'bg-green-500'
    },
    {
      title: 'Statistics',
      description: 'Monitor collection statistics',
      icon: TrendingUp,
      href: '/prices',
      color: 'bg-purple-500'
    },
    {
      title: 'View Collection',
      description: 'See your complete product collection',
      icon: FolderOpen,
      href: '/collection',
      color: 'bg-red-500'
    }
  ];

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

  // Helper to calculate total market price (copied from Statistics)
  const getTotalMarketPrice = () => {
    if (!collectionData?.collection) return 0;
    return collectionData.collection.reduce((sum, item) => {
      if (item.current_market_price) {
        return sum + (item.current_market_price * (item.quantity || 1));
      }
      return sum;
    }, 0);
  };

  // Helper to calculate profit/loss percentage (copied from Statistics)
  const getProfitLoss = () => {
    const investment = stats?.basicStats?.total_investment || 0;
    const market = getTotalMarketPrice();
    if (!investment) return 0;
    return ((market - investment) / investment) * 100;
  };

  if (statsLoading || recentLoading || alertsLoading || collectionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back!
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your Pokemon collection
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Investment</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats?.basicStats?.total_investment)}
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
                {stats?.basicStats?.total_cards || 0}
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
                {stats?.basicStats?.total_quantity || 0}
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
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">% Profit/Loss</p>
              <p className={`text-2xl font-bold ${getProfitLoss() >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercentage(getProfitLoss())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                to={action.href}
                className="card p-6 hover:shadow-lg transition-shadow duration-200"
              >
                <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{action.title}</h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Collection */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Additions</h2>
            <Link
              to="/collection"
              className="text-primary-600 hover:text-primary-500 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          
          {recentCollection?.collection?.length > 0 ? (
            <div className="space-y-4">
              {recentCollection.collection.slice(0, 5).map((item) => (
                <div key={item.collection_id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  <img
                    src={item.image_url || '/placeholder-card.png'}
                    alt={item.name}
                    className="w-12 h-16 object-cover rounded"
                    crossorigin="anonymous"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.set_name}</p>
                    <p className="text-sm text-gray-500">
                      Qty: {item.quantity} • {formatCurrency(item.purchase_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No cards in your collection yet</p>
              <Link
                to="/cards/add"
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                Add your first card
              </Link>
            </div>
          )}
        </div>

        {/* Price Alerts */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Price Changes</h2>
            <Link
              to="/prices"
              className="text-primary-600 hover:text-primary-500 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          
          {priceAlerts?.alerts?.length > 0 ? (
            <div className="space-y-4">
              {priceAlerts.alerts.slice(0, 5).map((alert) => (
                <div key={alert.collection_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <img
                      src={alert.image_url || '/placeholder-card.png'}
                      alt={alert.name}
                      className="w-10 h-14 object-cover rounded"
                      crossorigin="anonymous"
                    />
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{alert.name}</h3>
                      <p className="text-xs text-gray-600">{alert.set_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1">
                      {alert.isGain ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${alert.isGain ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(alert.priceChangePercent)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(alert.priceChange)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No price changes to show</p>
              <p className="text-sm text-gray-400">Add cards with purchase prices to track changes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 