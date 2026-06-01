import { Router } from 'express';
import {
  addCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryStats,
} from '../controllers/categoryController.js';
import { validateCategory, handleValidationErrors } from '../validators/validators.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All category routes require authentication
router.use(authenticate);

// Public routes (for authenticated users)
router.get('/', getCategories);
router.get('/stats', getCategoryStats);
router.get('/:id', getCategoryById);

// Admin only routes
router.post('/', authorize(['admin']), validateCategory, handleValidationErrors, addCategory);
router.put('/:id', authorize(['admin']), validateCategory, handleValidationErrors, updateCategory);
router.delete('/:id', authorize(['admin']), deleteCategory);

export default router;
