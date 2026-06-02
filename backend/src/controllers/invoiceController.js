import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Notification from '../models/Notification.js';
import mongoose from 'mongoose';
import { invoiceEmailTemplate, sendEmail } from '../services/emailService.js';
import { validationResult } from 'express-validator';

// ==================== HELPER FUNCTIONS ====================
/**
 * Generate unique invoice number using atomic counter
 * @returns {Promise<string>} Unique invoice number
 */
const generateInvoiceNumber = async () => {
  // ✅ FIX 1: Create counter model only if not exists
  let InvoiceCounter;
  try {
    InvoiceCounter = mongoose.model('InvoiceCounter');
  } catch {
    const counterSchema = new mongoose.Schema({
      _id: String,
      sequence: { type: Number, default: 0 }
    }, { collection: 'invoiceCounters' });
    InvoiceCounter = mongoose.model('InvoiceCounter', counterSchema);
  }

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const counterId = `INV-${year}${month}`;

  const counter = await InvoiceCounter.findByIdAndUpdate(
    counterId,
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );
  return `${counterId}-${String(counter.sequence).padStart(5, '0')}`;
};

/**
 * Validate invoice items
 */
const validateInvoiceItems = async (items, session) => {
  const processedItems = [];
  let subTotal = 0;

  for (const item of items) {
    if (!item.product || !item.quantity) {
      throw new Error('Each item must have product and quantity');
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Item quantity must be a positive integer');
    }

    const unitPrice = item.unitPrice || 0;
    if (unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }

    const itemDiscount = item.discount || 0;
    if (itemDiscount < 0) {
      throw new Error('Item discount cannot be negative');
    }

    const product = await Product.findById(item.product).session(session);
    if (!product) {
      throw new Error(`Product with ID ${item.product} not found`);
    }

    if (product.quantity < item.quantity) {
      throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
    }

    const itemTotal = (item.quantity * unitPrice) - itemDiscount;
    subTotal += itemTotal;

    processedItems.push({
      product: item.product,
      productName: product.name,
      productSku: product.sku,
      quantity: item.quantity,
      unitPrice: unitPrice,
      discount: itemDiscount,
      total: itemTotal,
      costPrice: product.costPrice // ✅ FIX 2: Store cost price for profit calculation
    });
  }

  return { processedItems, subTotal };
};

// ==================== CREATE INVOICE ====================
export const createInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ FIX 3: Add validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      customer, 
      items, 
      discount = 0, 
      tax = 0, 
      taxRate = 0,
      shippingCost = 0,
      paymentMethod = 'cash', 
      notes = '',
      dueDate
    } = req.body;

    // Validate customer info
    if (!customer || !customer.name) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Customer name is required',
      });
    }

    if (!customer.email) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Customer email is required',
      });
    }

    // Validate items
    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invoice must have at least one item',
      });
    }

    // Process items
    const { processedItems, subTotal } = await validateInvoiceItems(items, session);

    // Validate discount and tax
    if (discount < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Discount cannot be negative',
      });
    }

    if (discount > subTotal) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Discount cannot exceed subtotal',
      });
    }

    if (tax < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Tax cannot be negative',
      });
    }

    if (shippingCost < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Shipping cost cannot be negative',
      });
    }

    // ✅ FIX 4: Calculate tax if taxRate is provided
    let calculatedTax = tax;
    if (taxRate > 0) {
      calculatedTax = (subTotal - discount) * (taxRate / 100);
    }

    const totalAmount = subTotal - discount + calculatedTax + shippingCost;

    if (totalAmount < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Total amount cannot be negative',
      });
    }

    // Calculate profit
    const totalCost = processedItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    const profit = totalAmount - totalCost - shippingCost;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: customer.phone || '',
        address: customer.address || '',
        gst: customer.gst || '' // ✅ FIX 5: Add GST field
      },
      items: processedItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.total
      })),
      subTotal,
      discount,
      tax: calculatedTax,
      taxRate,
      shippingCost,
      totalAmount,
      paymentMethod,
      notes: notes?.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: req.userId,
      status: 'issued',
      paymentStatus: paymentMethod === 'cash' ? 'completed' : 'pending',
      profit
    });

    await invoice.save({ session });

    // Update product quantities and create inventory records
    const notificationsToCreate = [];
    const stockUpdates = [];

    for (let i = 0; i < processedItems.length; i++) {
      const item = processedItems[i];
      const product = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } },
        { new: true, session }
      );

      const previousQuantity = product.quantity + item.quantity;

      // Create inventory record
      await Inventory.create([{
        product: item.product,
        actionType: 'stock_out',
        quantity: item.quantity,
        previousQuantity,
        newQuantity: product.quantity,
        reason: `Invoice Sale: ${invoiceNumber}`,
        reference: invoice._id,
        referenceModel: 'Invoice',
        user: req.userId,
        notes: `Sold to ${customer.name} via Invoice ${invoiceNumber}`,
      }], { session });

      stockUpdates.push({
        product: item.product,
        name: product.name,
        oldStock: previousQuantity,
        newStock: product.quantity
      });

      // Check stock alerts
      if (product.quantity === 0) {
        notificationsToCreate.push({
          type: 'out_of_stock',
          title: `Out of Stock: ${product.name}`,
          message: `Product ${product.name} (${product.sku}) is now out of stock`,
          priority: 'high',
          relatedProduct: product._id,
          relatedInvoice: invoice._id,
        });
      } else if (product.quantity <= product.minimumStock) {
        notificationsToCreate.push({
          type: 'low_stock',
          title: `Low Stock Alert: ${product.name}`,
          message: `Product ${product.name} stock is at ${product.quantity} units (Min: ${product.minimumStock})`,
          priority: 'medium',
          relatedProduct: product._id,
          relatedInvoice: invoice._id,
        });
      }
    }

    await session.commitTransaction();

    // Create notifications after transaction (non-blocking)
    for (const notification of notificationsToCreate) {
      try {
        await Notification.create({ ...notification, recipient: req.userId });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError.message);
      }
    }

    // Send invoice email (non-blocking)
    const invoiceLink = `${process.env.FRONTEND_URL}/invoices/${invoice._id}`;
    const pdfLink = `${process.env.FRONTEND_URL}/invoices/${invoice._id}/pdf`;
    
    sendEmail(
      customer.email,
      `Invoice ${invoiceNumber} from Inventory Management System`,
      invoiceEmailTemplate(customer.name, invoiceNumber, totalAmount, invoiceLink, pdfLink)
    ).catch(emailError => {
      console.error('Email sending failed:', emailError.message);
      Notification.create({
        type: 'email_failed',
        title: 'Invoice Email Failed',
        message: `Failed to send invoice ${invoiceNumber} to ${customer.email}`,
        priority: 'low',
        recipient: req.userId,
        relatedInvoice: invoice._id,
      }).catch(console.error);
    });

    await invoice.populate('createdBy', 'fullName email');
    await invoice.populate('items.product', 'name sku sellingPrice');

    // ✅ FIX 6: Return stock updates in response
    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice,
      stockUpdates,
      summary: {
        subTotal,
        discount,
        tax: calculatedTax,
        shippingCost,
        totalAmount,
        profit
      }
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

// ==================== GET ALL INVOICES ====================
export const getInvoices = async (req, res, next) => {
  try {
    let { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      paymentStatus, 
      startDate, 
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const filter = {};

    // Search functionality
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filter.$or = [
        { invoiceNumber: { $regex: searchTerm, $options: 'i' } },
        { 'customer.name': { $regex: searchTerm, $options: 'i' } },
        { 'customer.email': { $regex: searchTerm, $options: 'i' } },
        { 'customer.phone': { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Status filters
    if (status) {
      const statuses = status.split(',');
      const validStatuses = statuses.filter(s => ['draft', 'issued', 'paid', 'cancelled'].includes(s));
      if (validStatuses.length) filter.status = { $in: validStatuses };
    }

    if (paymentStatus) {
      const paymentStatuses = paymentStatus.split(',');
      const validPaymentStatuses = paymentStatuses.filter(ps => ['pending', 'completed', 'failed', 'refunded', 'partial'].includes(ps));
      if (validPaymentStatuses.length) filter.paymentStatus = { $in: validPaymentStatuses };
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.totalAmount = {};
      if (minAmount) filter.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.totalAmount.$lte = parseFloat(maxAmount);
    }

    const skip = (page - 1) * limit;
    
    // Dynamic sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('createdBy', 'fullName email')
        .populate('items.product', 'name sku sellingPrice')
        .skip(skip)
        .limit(limit)
        .sort(sortOptions)
        .lean(),
      Invoice.countDocuments(filter)
    ]);

    // ✅ FIX 7: Add summary statistics
    const summary = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' },
          averageOrderValue: { $avg: '$totalAmount' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      invoices,
      summary: summary[0] || {
        totalRevenue: 0,
        totalProfit: 0,
        averageOrderValue: 0,
        totalOrders: 0
      },
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNextPage: page < pages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('GET INVOICES ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET INVOICE BY ID ====================
export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ✅ FIX 8: Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID format',
      });
    }

    const invoice = await Invoice.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('items.product', 'name sku sellingPrice costPrice category')
      .populate('items.product.category', 'name')
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // ✅ FIX 9: Get related inventory movements
    const inventoryMovements = await Inventory.find({ reference: id })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      invoice,
      inventoryMovements,
      canCancel: invoice.status !== 'cancelled' && invoice.status !== 'paid'
    });
  } catch (error) {
    console.error('GET INVOICE BY ID ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== UPDATE INVOICE STATUS ====================
export const updateInvoiceStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { paymentStatus, status, paymentAmount = null } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID format',
      });
    }

    const validStatuses = ['draft', 'issued', 'paid', 'cancelled'];
    const validPaymentStatuses = ['pending', 'completed', 'failed', 'refunded', 'partial'];

    if (status && !validStatuses.includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`,
      });
    }

    const invoice = await Invoice.findById(id).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // ✅ FIX 10: Handle partial payments
    let updateData = {};
    if (status) updateData.status = status;
    
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
      if (paymentAmount && paymentAmount > 0) {
        updateData.amountPaid = (invoice.amountPaid || 0) + paymentAmount;
        updateData.remainingBalance = invoice.totalAmount - updateData.amountPaid;
      }
    }

    // ✅ FIX 11: Handle cancellation - restore stock
    if (status === 'cancelled' && invoice.status !== 'cancelled') {
      for (const item of invoice.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.quantity } },
          { session }
        );
      }
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = req.userId;
      
      // Create cancellation record
      await Inventory.create([{
        product: null,
        actionType: 'adjustment',
        quantity: 0,
        reason: `Invoice Cancelled: ${invoice.invoiceNumber}`,
        reference: invoice._id,
        referenceModel: 'Invoice',
        user: req.userId,
        notes: `Invoice ${invoice.invoiceNumber} was cancelled`,
        metadata: { cancelledInvoice: true }
      }], { session });
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true, session }
    )
      .populate('createdBy', 'fullName email')
      .populate('items.product', 'name sku');

    await session.commitTransaction();

    // Create notification for status change
    await Notification.create({
      type: 'invoice_status_changed',
      title: `Invoice ${invoice.invoiceNumber} ${status ? status : 'updated'}`,
      message: `Invoice status changed to ${status || paymentStatus}`,
      recipient: req.userId,
      relatedInvoice: invoice._id,
    }).catch(console.error);

    res.status(200).json({
      success: true,
      message: 'Invoice status updated successfully',
      invoice: updatedInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('UPDATE INVOICE STATUS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    await session.endSession();
  }
};

// ==================== GET BILLING STATS ====================
export const getBillingStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
    thisWeek.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisYear = new Date();
    thisYear.setMonth(0, 1);
    thisYear.setHours(0, 0, 0, 0);

    const [
      todaySales,
      weekSales,
      monthSales,
      yearSales,
      pendingPayments,
      paymentMethodStats,
      topCustomer
    ] = await Promise.all([
      // Today's sales
      Invoice.aggregate([
        { $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 }, profit: { $sum: '$profit' } } }
      ]),
      
      // This week's sales
      Invoice.aggregate([
        { $match: { createdAt: { $gte: thisWeek }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      
      // This month's sales
      Invoice.aggregate([
        { $match: { createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      
      // This year's sales
      Invoice.aggregate([
        { $match: { createdAt: { $gte: thisYear }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      
      // Pending payments
      Invoice.aggregate([
        { $match: { paymentStatus: 'pending' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      
      // ✅ FIX 12: Payment method distribution
      Invoice.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      
      // ✅ FIX 13: Top customer
      Invoice.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: '$customer.email', name: { $first: '$customer.name' }, totalSpent: { $sum: '$totalAmount' }, orderCount: { $sum: 1 } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 1 }
      ])
    ]);

    res.status(200).json({
      success: true,
      stats: {
        today: {
          revenue: todaySales[0]?.total || 0,
          orders: todaySales[0]?.count || 0,
          profit: todaySales[0]?.profit || 0
        },
        week: {
          revenue: weekSales[0]?.total || 0,
          orders: weekSales[0]?.count || 0
        },
        month: {
          revenue: monthSales[0]?.total || 0,
          orders: monthSales[0]?.count || 0
        },
        year: {
          revenue: yearSales[0]?.total || 0,
          orders: yearSales[0]?.count || 0
        },
        pendingPayments: {
          total: pendingPayments[0]?.total || 0,
          count: pendingPayments[0]?.count || 0
        },
        paymentMethods: paymentMethodStats,
        topCustomer: topCustomer[0] || null
      }
    });
  } catch (error) {
    console.error('BILLING STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== CANCEL INVOICE ====================
export const deleteInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID format',
      });
    }

    const invoice = await Invoice.findById(id).session(session);
    
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    if (invoice.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invoice is already cancelled',
      });
    }

    if (invoice.status === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a paid invoice. Please process a refund instead.',
      });
    }

    // Restore product quantities
    for (const item of invoice.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: item.quantity } },
        { session }
      );
    }

    // Update invoice status
    invoice.status = 'cancelled';
    invoice.cancelledAt = new Date();
    invoice.cancelledBy = req.userId;
    invoice.cancellationReason = reason || 'No reason provided';
    await invoice.save({ session });

    // Create cancellation record
    await Inventory.create([{
      product: null,
      actionType: 'adjustment',
      quantity: 0,
      reason: `Invoice Cancelled: ${invoice.invoiceNumber}`,
      reference: invoice._id,
      referenceModel: 'Invoice',
      user: req.userId,
      notes: `Invoice cancelled. Reason: ${reason || 'Not specified'}`,
    }], { session });

    await session.commitTransaction();

    // Create notification
    await Notification.create({
      type: 'invoice_cancelled',
      title: `Invoice ${invoice.invoiceNumber} Cancelled`,
      message: `Invoice has been cancelled. Reason: ${reason || 'No reason provided'}`,
      recipient: req.userId,
      relatedInvoice: invoice._id,
    }).catch(console.error);

    res.status(200).json({
      success: true,
      message: 'Invoice cancelled successfully',
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        cancelledAt: invoice.cancelledAt
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('CANCEL INVOICE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    await session.endSession();
  }
};

// ==================== GET INVOICE SUMMARY (NEW) ====================
export const getInvoiceSummary = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch(period) {
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
    }
    
    startDate.setHours(0, 0, 0, 0);
    
    const summary = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' },
          uniqueCustomers: { $addToSet: '$customer.email' }
        }
      },
      {
        $project: {
          totalRevenue: 1,
          totalProfit: 1,
          totalOrders: 1,
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          uniqueCustomers: { $size: '$uniqueCustomers' },
          profitMargin: {
            $round: [
              { $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] },
              2
            ]
          }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      period,
      startDate,
      endDate,
      summary: summary[0] || {
        totalRevenue: 0,
        totalProfit: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        uniqueCustomers: 0,
        profitMargin: 0
      }
    });
  } catch (error) {
    console.error('INVOICE SUMMARY ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== DOWNLOAD INVOICE PDF (NEW) ====================
export const downloadInvoicePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID format',
      });
    }
    
    const invoice = await Invoice.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('items.product', 'name sku')
      .lean();
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }
    
    // Generate PDF (implementation depends on your PDF library)
    // This endpoint would typically use a library like pdfkit, puppeteer, or similar
    
    res.status(200).json({
      success: true,
      message: 'PDF generation endpoint',
      invoice,
      pdfUrl: `${process.env.BACKEND_URL}/api/invoices/${id}/pdf-generate`
    });
  } catch (error) {
    console.error('DOWNLOAD PDF ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};