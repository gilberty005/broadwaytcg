import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Statistics = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');

  // Fetch price tracking data
  const { data: priceData, isLoading, error, refetch } = useQuery(
    ['priceTracking', searchTerm, selectedCard, timeRange],
    async () => {
      if (!selectedCard) return null;
      
      const params = new URLSearchParams({
        card_id: selectedCard,
        time_range: timeRange
      });
      
      const response = await axios.get(`/api/prices/tracking?${params}`);
      return response.data;
    },
    {
      enabled: !!selectedCard
    }
  );

  // Fetch cards for search
  const { data: cardsData } = useQuery(
    ['cards', 'search', searchTerm],
    async () => {
      if (!searchTerm.trim()) return { cards: [] };
      
      const params = new URLSearchParams({
        search: searchTerm,
        limit: 10
      });
      
      const response = await axios.get(`/api/cards?${params}`);
      return response.data;
    },
    {
      enabled: searchTerm.trim().length > 0
    }
  );

  // Fetch recent price updates
  const { data: recentUpdates } = useQuery(
    'recentPriceUpdates',
    async () => {
      const response = await axios.get('/api/prices/recent');
      return response.data;
    }
  );

  const { data: stats } = useQuery(
    'collectionStats',
    async () => {
      const response = await axios.get('/api/collections/stats');
      return response.data;
    }
  );

  const { data: collectionData } = useQuery(
    'collection',
    async () => {
      const response = await axios.get('/api/collections?page=1&limit=10000');
      return response.data;
    }
  );

  // Fetch user stat history
  const { data: statHistory } = useQuery(
    'userStatHistory',
    async () => {
      const response = await axios.get('/api/collections/stat-history');
      return response.data;
    }
  );

  // Filter out 0% profit/loss points and -100% (missing market price) for the graph
  const filteredStatHistory = statHistory ? statHistory.filter(dataPoint => {
    if (dataPoint.profit_loss_pct !== undefined) {
      const profitLossValue = parseFloat(dataPoint.profit_loss_pct);
      // Filter out points that are very close to 0 or exactly -100%
      if (Math.abs(profitLossValue) <= 0.01 || profitLossValue === -100) {
        return false;
      }
    }
    return true;
  }) : [];

  console.log('Original statHistory length:', statHistory?.length);
  console.log('Filtered statHistory length:', filteredStatHistory?.length);

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTotalMarketPrice = () => {
    if (!collectionData?.collection) return 0;
    return collectionData.collection.reduce((sum, item) => {
      if (item.current_market_price) {
        return sum + (item.current_market_price * (item.quantity || 1));
      }
      return sum;
    }, 0);
  };

  const getProfitLoss = () => {
    const investment = stats?.basicStats?.total_investment || 0;
    const market = getTotalMarketPrice();
    if (!investment) return 0;
    return ((market - investment) / investment) * 100;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Statistics</h1>
        <p className="text-gray-600">A summary of your Pokemon collection's value and performance</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Investment */}
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
          {/* Total Cards */}
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
          {/* Total Sealed */}
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
          {/* Total Market Price */}
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

      {/* Lifetime Earnings and Profit/Loss Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* % Profit/Loss */}
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
          {/* Lifetime Earnings */}
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Lifetime Earnings</p>
                <p className={`text-2xl font-bold ${((stats.basicStats?.lifetime_earnings ?? 0) >= 0) ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(stats.basicStats?.lifetime_earnings ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Profit/Loss Graph (left, shows % profit/loss) */}
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-bold mb-4">Profit/Loss % Over Time</h2>
          {filteredStatHistory && filteredStatHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={filteredStatHistory} margin={{ top: 40, right: 40, left: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  minTickGap={30}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                  interval="preserveStartEnd"
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis
                  // label removed for cleaner look
                  tickFormatter={formatPercentage}
                  domain={['auto', 'auto']}
                  allowDecimals={true}
                  tickCount={6}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip formatter={(value) => formatPercentage(value)} labelFormatter={formatDate} />
                <Line 
                  type="monotone" 
                  dataKey="profit_loss_pct" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Profit/Loss %" 
                  dot={{ fill: '#10b981', strokeWidth: 1, r: 4 }}
                  activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No profit/loss data available yet</p>
                <p className="text-sm">Add cards to your collection to track performance</p>
              </div>
            </div>
          )}
        </div>

        {/* Lifetime Earnings Graph (right, shows history of lifetime earnings) */}
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-bold mb-4">Lifetime Earnings Over Time</h2>
          {statHistory && statHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={statHistory} margin={{ top: 40, right: 40, left: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  minTickGap={30}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                  interval="preserveStartEnd"
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis
                  // label removed for cleaner look
                  tickFormatter={formatCurrency}
                  domain={['auto', 'auto']}
                  allowDecimals={true}
                  tickCount={6}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={formatDate} />
                <Line 
                  type="monotone" 
                  dataKey="lifetime_earnings" 
                  stroke="#f59e42" 
                  strokeWidth={2}
                  name="Lifetime Earnings" 
                  dot={{ fill: '#f59e42', strokeWidth: 1, r: 4 }}
                  activeDot={{ r: 7, stroke: '#f59e42', strokeWidth: 2, fill: '#fff' }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No earnings data available yet</p>
                <p className="text-sm">Start trading or selling cards to see your earnings history</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Statistics; 