import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Notification from '../models/Notification.js';
import mongoose from 'mongoose';
import { invoiceEmailTemplate, sendEmail } from '../services/emailService.js';

/**
 * Generate unique invoice number using atomic counter
 * @returns {Promise<string>} Unique invoice number
 */
const generateInvoiceNumber = async () => {
  const InvoiceCounter = mongoose.model('InvoiceCounter') || 
    mongoose.model('InvoiceCounter', new mongoose.Schema({
      _id: String,
      sequence: { type: Number, default: 0 }
    }, { collection: 'invoiceCounters' }));

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const counterId = `INV-${year}${month}`;

  try {
    const counter = await InvoiceCounter.findByIdAndUpdate(
      counterId,
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    return `${counterId}-${String(counter.sequence).padStart(5, '0')}`;
  } catch (error) {
    throw new Error(`Failed to generate invoice number: ${error.message}`);
  }
};

/**
 * Create a new invoice with stock updates and notifications
 * Uses transactions to ensure data consistency
 */
export const createInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer, items, discount = 0, tax = 0, paymentMethod = 'cash', notes = '' } = req.body;

    // Validate items array
    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invoice must have at least one item',
      });
    }

    // Validate and process items
    let subTotal = 0;
    const processedItems = [];

    for (const item of items) {
      if (!item.product || !item.quantity || !item.unitPrice) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Each item must have product, quantity, and unitPrice',
        });
      }

      // Validate quantity
      if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Item quantity must be a positive integer',
        });
      }

      // Validate unit price
      if (item.unitPrice < 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Unit price cannot be negative',
        });
      }

      // Validate discount
      const itemDiscount = item.discount || 0;
      if (itemDiscount < 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Item discount cannot be negative',
        });
      }

      const product = await Product.findById(item.product).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product with ID ${item.product} not found`,
        });
      }

      // Check stock availability (atomic with findByIdAndUpdate below)
      if (product.quantity < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`,
        });
      }

      const itemTotal = item.quantity * item.unitPrice - itemDiscount;
      subTotal += itemTotal;

      processedItems.push({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: itemDiscount,
        total: itemTotal,
      });
    }

    // Validate discount and tax
    if (discount < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Discount cannot be negative',
      });
    }

    if (tax < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Tax cannot be negative',
      });
    }

    const totalAmount = subTotal - discount + tax;

    if (totalAmount < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Total amount cannot be negative. Check discount value.',
      });
    }

    // Generate unique invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      customer,
      items: processedItems,
      subTotal,
      discount,
      tax,
      totalAmount,
      paymentMethod,
      notes,
      createdBy: req.userId,
      status: 'issued',
      paymentStatus: paymentMethod === 'cash' ? 'completed' : 'pending',
    });

    await invoice.save({ session });

    // Update product quantities and create inventory records (atomic)
    const notificationsToCreate = [];

    for (const item of processedItems) {
      const product = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } },
        { new: true, session }
      );

      const previousQuantity = product.quantity + item.quantity;
      const newQuantity = product.quantity;

      // Create inventory record
      await Inventory.create([{
        product: item.product,
        actionType: 'stock_out',
        quantity: item.quantity,
        previousQuantity,
        newQuantity,
        reason: `Invoice: ${invoice._id}`,
        reference: invoice._id,
        referenceModel: 'Invoice',
        user: req.userId,
        notes: `Sold via Invoice ${invoice.invoiceNumber}`,
      }], { session });

      // Queue notifications (create after transaction commits)
      if (newQuantity === 0) {
        notificationsToCreate.push({
          type: 'out_of_stock',
          title: `Out of Stock: ${product.name}`,
          message: `Product ${product.name} is now out of stock`,
          recipient: req.userId,
          relatedProduct: product._id,
          relatedInvoice: invoice._id,
        });
      } else if (newQuantity <= product.minimumStock) {
        notificationsToCreate.push({
          type: 'low_stock',
          title: `Low Stock: ${product.name}`,
          message: `Product ${product.name} stock level is below minimum (${newQuantity} units)`,
          recipient: req.userId,
          relatedProduct: product._id,
          relatedInvoice: invoice._id,
        });
      }
    }

    // Commit transaction before email send (email is not critical for data consistency)
    await session.commitTransaction();

    // Create notifications after transaction succeeds
    for (const notification of notificationsToCreate) {
      try {
        await Notification.create(notification);
      } catch (notifError) {
        console.error('Failed to create notification:', notifError.message);
        // Don't fail the whole operation if notification creation fails
      }
    }

    // Send invoice email to customer (non-blocking failure)
    const invoiceLink = `${process.env.FRONTEND_URL}/invoices/${invoice._id}`;
    try {
      await sendEmail(
        customer.email,
        `Invoice ${invoice.invoiceNumber} - Inventory Management System`,
        invoiceEmailTemplate(customer.name, invoice.invoiceNumber, invoice.totalAmount, invoiceLink)
      );
    } catch (emailError) {
      console.error('Email sending failed:', emailError.message);
      // Create a notification about email failure
      try {
        await Notification.create({
          type: 'email_failed',
          title: 'Invoice Email Failed',
          message: `Failed to send invoice ${invoice.invoiceNumber} to ${customer.email}. Please send manually.`,
          recipient: req.userId,
          relatedInvoice: invoice._id,
        });
      } catch (notifError) {
        console.error('Failed to create email failure notification:', notifError.message);
      }
    }

    // Create invoice generation notification
    try {
      await Notification.create({
        type: 'invoice_generated',
        title: 'Invoice Generated',
        message: `Invoice ${invoice.invoiceNumber} has been generated for ${customer.name}`,
        recipient: req.userId,
        relatedInvoice: invoice._id,
      });
    } catch (notifError) {
      console.error('Failed to create invoice notification:', notifError.message);
    }

    await invoice.populate('createdBy', 'fullName email').populate('items.product', 'name sku');

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Invoice creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    await session.endSession();
  }
};

export const getInvoices = async (req, res, next) => {
  try {
    let { page = 1, limit = 10, search, status, paymentStatus, startDate, endDate } = req.query;

    // Validate and sanitize pagination parameters
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.max(1, Math.min(100, parseInt(limit) || 10)); // Max 100 items per page

    const filter = {};

    if (search && search.trim()) {
      const searchTerm = search.trim();
      filter.$or = [
        { invoiceNumber: { $regex: searchTerm, $options: 'i' } },
        { 'customer.name': { $regex: searchTerm, $options: 'i' } },
        { 'customer.email': { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (status && ['draft', 'issued', 'paid', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    if (paymentStatus && ['pending', 'completed', 'failed', 'refunded'].includes(paymentStatus)) {
      filter.paymentStatus = paymentStatus;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      try {
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      } catch (dateError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use ISO 8601 format.',
        });
      }
    }

    const skip = (page - 1) * limit;

    const invoices = await Invoice.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('items.product', 'name sku sellingPrice')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Invoice.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      invoices,
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNextPage: page < pages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('items.product', 'name sku sellingPrice');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    res.status(200).json({
      success: true,
      invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, status } = req.body;

    // Validate enum values
    const validStatuses = ['draft', 'issued', 'paid', 'cancelled'];
    const validPaymentStatuses = ['pending', 'completed', 'failed', 'refunded'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`,
      });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { ...(status && { status }), ...(paymentStatus && { paymentStatus }) },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'fullName email')
      .populate('items.product', 'name sku');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Invoice status updated successfully',
      invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getBillingStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisYear = new Date();
    thisYear.setMonth(0);
    thisYear.setDate(1);
    thisYear.setHours(0, 0, 0, 0);

    // Today's sales
    const todaySales = await Invoice.aggregate([
      { $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);

    // This month's sales
    const monthSales = await Invoice.aggregate([
      { $match: { createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);

    // This year's sales
    const yearSales = await Invoice.aggregate([
      { $match: { createdAt: { $gte: thisYear }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);

    // Pending payments
    const pendingPayments = await Invoice.aggregate([
      { $match: { paymentStatus: 'pending' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        todaySales: todaySales[0] || { total: 0, count: 0 },
        monthSales: monthSales[0] || { total: 0, count: 0 },
        yearSales: yearSales[0] || { total: 0, count: 0 },
        pendingPayments: pendingPayments[0] || { total: 0, count: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { status: 'cancelled' },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Invoice cancelled successfully',
      invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
