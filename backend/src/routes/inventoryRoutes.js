import { Router } from 'express';
import {
  stockIn,
  stockOut,
  adjustStock,
  getInventoryHistory,
  getProductInventoryHistory,
  getInventoryStats,
} from '../controllers/inventoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All inventory routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin']));

// Inventory routes
router.post('/stock-in', stockIn);
router.post('/stock-out', stockOut);
router.post('/adjustment', adjustStock);
router.get('/history', getInventoryHistory);
router.get('/product/:productId', getProductInventoryHistory);
router.get('/stats', getInventoryStats);

export default router;
