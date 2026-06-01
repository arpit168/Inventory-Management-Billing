import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api.js';
import { Card, Badge, Alert } from '../components/UI.jsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, BarChart3, AlertCircle, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, salesRes, revenueRes, categoryRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getSalesChartData({ days: 30 }),
        dashboardAPI.getRevenueChartData({ months: 12 }),
        dashboardAPI.getCategoryStats(),
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
      if (salesRes.data.success) {
        setSalesData(salesRes.data.data);
      }
      if (revenueRes.data.success) {
        setRevenueData(revenueRes.data.data);
      }
      if (categoryRes.data.success) {
        setCategoryData(categoryRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-dark-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <Card className="hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-400 text-sm">Total Products</p>
              <h3 className="text-3xl font-bold mt-2">{stats.totalProducts}</h3>
            </div>
            <Package className="w-12 h-12 text-primary-400 opacity-50" />
          </div>
        </Card>

        {/* Low Stock */}
        <Card className="hover:shadow-lg transition-shadow border-warning border-l-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-400 text-sm">Low Stock</p>
              <h3 className="text-3xl font-bold mt-2 text-warning">{stats.lowStockProducts}</h3>
            </div>
            <AlertCircle className="w-12 h-12 text-warning opacity-50" />
          </div>
        </Card>

        {/* Out of Stock */}
        <Card className="hover:shadow-lg transition-shadow border-error border-l-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-400 text-sm">Out of Stock</p>
              <h3 className="text-3xl font-bold mt-2 text-error">{stats.outOfStockProducts}</h3>
            </div>
            <ShoppingCart className="w-12 h-12 text-error opacity-50" />
          </div>
        </Card>

        {/* Today's Sales */}
        <Card className="hover:shadow-lg transition-shadow border-success border-l-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-400 text-sm">Today's Sales</p>
              <h3 className="text-3xl font-bold mt-2 text-success">${stats.todaySales.toFixed(0)}</h3>
            </div>
            <DollarSign className="w-12 h-12 text-success opacity-50" />
          </div>
        </Card>
      </div>

      {stats.lowStockProducts > 0 && (
        <Alert variant="warning" title="Attention">
          You have {stats.lowStockProducts} products running low on stock. Please reorder soon.
        </Alert>
      )}

      {stats.outOfStockProducts > 0 && (
        <Alert variant="error" title="Urgent">
          You have {stats.outOfStockProducts} products out of stock. Please reorder immediately.
        </Alert>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Sales Trend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="_id" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Legend />
              <Line
                type="monotone"
                dataKey="totalSales"
                stroke="#0ea5e9"
                dot={false}
                strokeWidth={2}
                name="Sales"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Revenue Chart */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="_id" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="totalRevenue" fill="#10b981" radius={[8, 8, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Category Distribution */}
      {categoryData.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="productCount"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
