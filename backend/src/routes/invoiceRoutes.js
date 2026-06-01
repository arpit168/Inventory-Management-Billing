import { Router } from 'express';
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  getBillingStats,
  deleteInvoice,
} from '../controllers/invoiceController.js';
import { validateInvoice, handleValidationErrors } from '../validators/validators.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All invoice routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin']));

// Invoice routes
router.post('/', validateInvoice, handleValidationErrors, createInvoice);
router.get('/', getInvoices);
router.get('/stats', getBillingStats);
router.get('/:id', getInvoiceById);
router.put('/:id/status', updateInvoiceStatus);
router.delete('/:id', deleteInvoice);

export default router;
