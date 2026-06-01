import { Router } from 'express';
import {
  addProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getOutOfStockProducts,
  getProductStats,
} from '../controllers/productController.js';
import { validateProduct, handleValidationErrors } from '../validators/validators.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All product routes require authentication
router.use(authenticate);

// Public routes (for authenticated users)
router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/out-of-stock', getOutOfStockProducts);
router.get('/stats', getProductStats);
router.get('/:id', getProductById);

// Admin only routes
router.post('/', authorize(['admin']), validateProduct, handleValidationErrors, addProduct);
router.put('/:id', authorize(['admin']), validateProduct, handleValidationErrors, updateProduct);
router.delete('/:id', authorize(['admin']), deleteProduct);

export default router;
