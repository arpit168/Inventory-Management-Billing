import { Router } from 'express';
import {
  getDashboardStats,
  getSalesChartData,
  getRevenueChartData,
  getInventoryChartData,
  getTopSellingProducts,
  getCategoryStats,
} from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Dashboard routes
router.get('/stats', getDashboardStats);
router.get('/sales-chart', getSalesChartData);
router.get('/revenue-chart', getRevenueChartData);
router.get('/inventory-chart', getInventoryChartData);
router.get('/top-products', getTopSellingProducts);
router.get('/category-stats', getCategoryStats);

export default router;
