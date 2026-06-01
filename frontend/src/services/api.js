import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Track if we're currently handling a 401 to prevent redirect loops
let isHandling401 = false;

// Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle responses with proper 401 redirect
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Prevent redirect loop - only redirect if we're not already on login page
      const currentPath = window.location.pathname;
      const isLoginPage = currentPath === '/login' || currentPath === '/register';
      
      // Clear token and redirect only if not already handling 401 and not on auth pages
      if (!isHandling401 && !isLoginPage) {
        isHandling401 = true;
        localStorage.removeItem('token');
        
        // Use history state to prevent browser back button issues
        window.location.replace('/login');
        
        // Reset flag after a delay to allow page reload
        setTimeout(() => {
          isHandling401 = false;
        }, 1000);
      } else if (isLoginPage && localStorage.getItem('token')) {
        // If we're on login page but token exists, clear it
        localStorage.removeItem('token');
      }
    }
    
    // Handle other HTTP errors
    if (error.response?.status === 403) {
      console.error('Access denied:', error.response.data?.message);
    }
    
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response.data?.message || 'Internal server error');
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  verifyEmail: (token) => apiClient.post(`/auth/verify-email/${token}`),
  login: (data) => apiClient.post('/auth/login', data),
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (token, data) => apiClient.post(`/auth/reset-password/${token}`, data),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  changePassword: (data) => apiClient.post('/auth/change-password', data),
};

// Product API
export const productAPI = {
  getProducts: (params) => apiClient.get('/products', { params }),
  getProductById: (id) => apiClient.get(`/products/${id}`),
  addProduct: (data) => apiClient.post('/products', data),
  updateProduct: (id, data) => apiClient.put(`/products/${id}`, data),
  deleteProduct: (id) => apiClient.delete(`/products/${id}`),
  getLowStockProducts: (params) => apiClient.get('/products/low-stock', { params }),
  getOutOfStockProducts: (params) => apiClient.get('/products/out-of-stock', { params }),
  getProductStats: () => apiClient.get('/products/stats'),
};

// Category API
export const categoryAPI = {
  getCategories: (params) => apiClient.get('/categories', { params }),
  getCategoryById: (id) => apiClient.get(`/categories/${id}`),
  addCategory: (data) => apiClient.post('/categories', data),
  updateCategory: (id, data) => apiClient.put(`/categories/${id}`, data),
  deleteCategory: (id) => apiClient.delete(`/categories/${id}`),
  getCategoryStats: () => apiClient.get('/categories/stats'),
};

// Inventory API
export const inventoryAPI = {
  stockIn: (data) => apiClient.post('/inventory/stock-in', data),
  stockOut: (data) => apiClient.post('/inventory/stock-out', data),
  adjustStock: (data) => apiClient.post('/inventory/adjustment', data),
  getHistory: (params) => apiClient.get('/inventory/history', { params }),
  getProductHistory: (productId, params) => apiClient.get(`/inventory/product/${productId}`, { params }),
  getStats: () => apiClient.get('/inventory/stats'),
};

// Invoice API
export const invoiceAPI = {
  createInvoice: (data) => apiClient.post('/invoices', data),
  getInvoices: (params) => apiClient.get('/invoices', { params }),
  getInvoiceById: (id) => apiClient.get(`/invoices/${id}`),
  updateInvoiceStatus: (id, data) => apiClient.put(`/invoices/${id}/status`, data),
  deleteInvoice: (id) => apiClient.delete(`/invoices/${id}`),
  getBillingStats: () => apiClient.get('/invoices/stats'),
};

// Notification API
export const notificationAPI = {
  getNotifications: (params) => apiClient.get('/notifications', { params }),
  markAsRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.put('/notifications/mark-all-read'),
  deleteNotification: (id) => apiClient.delete(`/notifications/${id}`),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
  deleteAllNotifications: () => apiClient.delete('/notifications'),
  getStats: () => apiClient.get('/notifications/stats'),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => apiClient.get('/dashboard/stats'),
  getSalesChartData: (params) => apiClient.get('/dashboard/sales-chart', { params }),
  getRevenueChartData: (params) => apiClient.get('/dashboard/revenue-chart', { params }),
  getInventoryChartData: () => apiClient.get('/dashboard/inventory-chart'),
  getTopProducts: (params) => apiClient.get('/dashboard/top-products', { params }),
  getCategoryStats: () => apiClient.get('/dashboard/category-stats'),
};

export default apiClient;
