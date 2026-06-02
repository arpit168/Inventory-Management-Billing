import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import Notification from '../models/Notification.js';
import { validationResult } from 'express-validator';

// ==================== HELPER FUNCTIONS ====================
const validateObjectId = (id) => {
  return id && id.match(/^[0-9a-fA-F]{24}$/);
};

const createInventoryRecord = async (productId, actionType, quantity, previousQuantity, newQuantity, reason, notes, userId) => {
  const inventory = await Inventory.create({
    product: productId,
    actionType,
    quantity,
    previousQuantity,
    newQuantity,
    reason: reason || (actionType === 'stock_in' ? 'Stock In' : actionType === 'stock_out' ? 'Stock Out' : 'Stock Adjustment'),
    notes,
    user: userId,
  });
  
  await inventory.populate('product', 'name sku sellingPrice');
  await inventory.populate('user', 'fullName email');
  
  return inventory;
};

const checkAndCreateLowStockNotification = async (product) => {
  // ✅ FIX 1: Auto-create notification when product becomes low stock
  if (product.quantity <= product.minimumStock && product.quantity > 0) {
    const existingNotification = await Notification.findOne({
      relatedProduct: product._id,
      type: 'low_stock',
      isResolved: false
    });
    
    if (!existingNotification) {
      await Notification.create({
        title: 'Low Stock Alert',
        message: `${product.name} (${product.sku}) is running low on stock. Current stock: ${product.quantity}, Minimum required: ${product.minimumStock}`,
        type: 'low_stock',
        priority: 'high',
        relatedProduct: product._id,
        recipient: null // Will be sent to all admins
      });
    }
  } else if (product.quantity > product.minimumStock) {
    // Resolve existing low stock notifications
    await Notification.updateMany(
      { relatedProduct: product._id, type: 'low_stock', isResolved: false },
      { isResolved: true, resolvedAt: new Date() }
    );
  }
};

// ==================== STOCK IN ====================
export const stockIn = async (req, res) => {
  try {
    // ✅ FIX 2: Add validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { productId, quantity, reason, notes, reference, costPrice } = req.body;

    // ✅ FIX 3: Validate ObjectId
    if (!validateObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required',
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer',
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const previousQuantity = product.quantity;
    
    // ✅ FIX 4: Update cost price if provided
    if (costPrice && costPrice > 0) {
      // Calculate new average cost price
      const totalCost = (product.costPrice * product.quantity) + (costPrice * quantity);
      const newQuantity = product.quantity + quantity;
      product.costPrice = Math.round(totalCost / newQuantity);
    }
    
    product.quantity += quantity;
    
    // ✅ FIX 5: Auto-update status if stock comes back
    if (product.status === 'out_of_stock' && product.quantity > 0) {
      product.status = 'active';
    }
    
    await product.save();

    const inventory = await createInventoryRecord(
      productId, 'stock_in', quantity, previousQuantity, 
      product.quantity, reason, notes, req.userId
    );

    // ✅ FIX 6: Add reference field
    if (reference) {
      inventory.reference = reference;
      await inventory.save();
    }

    res.status(201).json({
      success: true,
      message: 'Stock added successfully',
      inventory,
      product: {
        id: product._id,
        name: product.name,
        currentQuantity: product.quantity,
        costPrice: product.costPrice
      }
    });
  } catch (error) {
    console.error('STOCK IN ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record stock in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== STOCK OUT ====================
export const stockOut = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { productId, quantity, reason, notes, reference, customerInfo } = req.body;

    if (!validateObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required',
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer',
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.quantity}`,
        availableStock: product.quantity,
        requestedQuantity: quantity
      });
    }

    const previousQuantity = product.quantity;
    product.quantity -= quantity;
    
    // ✅ FIX 7: Update product status if out of stock
    if (product.quantity === 0) {
      product.status = 'out_of_stock';
    } else if (product.quantity <= product.minimumStock) {
      product.status = 'low_stock';
    }
    
    await product.save();

    const inventory = await createInventoryRecord(
      productId, 'stock_out', quantity, previousQuantity, 
      product.quantity, reason, notes, req.userId
    );

    if (reference) {
      inventory.reference = reference;
      await inventory.save();
    }
    
    // ✅ FIX 8: Store customer info if provided
    if (customerInfo) {
      inventory.metadata = { customerInfo };
      await inventory.save();
    }

    // ✅ FIX 9: Check low stock and create notification
    await checkAndCreateLowStockNotification(product);

    res.status(201).json({
      success: true,
      message: 'Stock removed successfully',
      inventory,
      product: {
        id: product._id,
        name: product.name,
        currentQuantity: product.quantity,
        status: product.status
      }
    });
  } catch (error) {
    console.error('STOCK OUT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record stock out',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== ADJUST STOCK ====================
export const adjustStock = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { productId, quantity, reason, notes, reference } = req.body;

    if (!validateObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required',
      });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a non-negative integer',
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const previousQuantity = product.quantity;
    const adjustedQuantity = Math.abs(previousQuantity - quantity);
    const actionType = quantity > previousQuantity ? 'stock_in' : 'stock_out';
    
    product.quantity = quantity;
    
    // Update status based on new quantity
    if (product.quantity === 0) {
      product.status = 'out_of_stock';
    } else if (product.quantity <= product.minimumStock) {
      product.status = 'low_stock';
    } else {
      product.status = 'active';
    }
    
    await product.save();

    const inventory = await createInventoryRecord(
      productId, 'adjustment', adjustedQuantity, previousQuantity, 
      quantity, reason, notes, req.userId
    );

    if (reference) {
      inventory.reference = reference;
      await inventory.save();
    }
    
    // ✅ FIX 10: Store adjustment details
    inventory.metadata = {
      adjustmentType: actionType,
      previousQuantity,
      newQuantity: quantity,
      difference: quantity - previousQuantity
    };
    await inventory.save();

    await checkAndCreateLowStockNotification(product);

    res.status(201).json({
      success: true,
      message: 'Stock adjusted successfully',
      inventory,
      product: {
        id: product._id,
        name: product.name,
        previousQuantity,
        currentQuantity: product.quantity,
        status: product.status
      }
    });
  } catch (error) {
    console.error('ADJUST STOCK ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to adjust stock',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== INVENTORY HISTORY ====================
export const getInventoryHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      productId,
      actionType,
      startDate,
      endDate,
      search
    } = req.query;

    const filter = {};

    if (productId && validateObjectId(productId)) {
      filter.product = productId;
    }

    if (actionType && ['stock_in', 'stock_out', 'adjustment'].includes(actionType)) {
      filter.actionType = actionType;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // ✅ FIX 11: Add search functionality
    if (search && search.trim()) {
      const products = await Product.find({
        $or: [
          { name: { $regex: search.trim(), $options: 'i' } },
          { sku: { $regex: search.trim(), $options: 'i' } }
        ]
      }).select('_id');
      
      const productIds = products.map(p => p._id);
      if (productIds.length > 0) {
        filter.product = { $in: productIds };
      }
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [inventoryRecords, total] = await Promise.all([
      Inventory.find(filter)
        .populate('product', 'name sku sellingPrice costPrice')
        .populate('user', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Inventory.countDocuments(filter)
    ]);

    // ✅ FIX 12: Add summary statistics
    const summary = {
      totalStockIn: inventoryRecords.filter(r => r.actionType === 'stock_in').reduce((sum, r) => sum + r.quantity, 0),
      totalStockOut: inventoryRecords.filter(r => r.actionType === 'stock_out').reduce((sum, r) => sum + r.quantity, 0),
      totalAdjustments: inventoryRecords.filter(r => r.actionType === 'adjustment').length
    };

    res.status(200).json({
      success: true,
      inventoryRecords,
      summary,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      },
      filters: { productId, actionType, startDate, endDate, search }
    });
  } catch (error) {
    console.error('INVENTORY HISTORY ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== PRODUCT INVENTORY HISTORY ====================
export const getProductInventoryHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 20, actionType, startDate, endDate } = req.query;

    if (!validateObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const filter = { product: productId };
    
    if (actionType && ['stock_in', 'stock_out', 'adjustment'].includes(actionType)) {
      filter.actionType = actionType;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [inventoryRecords, total] = await Promise.all([
      Inventory.find(filter)
        .populate('user', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Inventory.countDocuments(filter)
    ]);

    // ✅ FIX 13: Calculate stock movement summary
    const stockMovements = {
      totalStockIn: inventoryRecords
        .filter(r => r.actionType === 'stock_in')
        .reduce((sum, r) => sum + r.quantity, 0),
      totalStockOut: inventoryRecords
        .filter(r => r.actionType === 'stock_out')
        .reduce((sum, r) => sum + r.quantity, 0),
      netChange: inventoryRecords.reduce((sum, r) => {
        if (r.actionType === 'stock_in') return sum + r.quantity;
        if (r.actionType === 'stock_out') return sum - r.quantity;
        return sum;
      }, 0)
    };

    res.status(200).json({
      success: true,
      product: {
        id: product._id,
        name: product.name,
        sku: product.sku,
        currentQuantity: product.quantity,
        minimumStock: product.minimumStock,
        status: product.status,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice
      },
      stockMovements,
      inventoryRecords,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('PRODUCT INVENTORY HISTORY ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product inventory history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== INVENTORY STATISTICS ====================
export const getInventoryStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const [
      todayStats,
      weekStats,
      monthStats,
      yearStats,
      totalMovements,
      topAdjustedProducts,
      recentAlerts
    ] = await Promise.all([
      // Today's stats
      Promise.all([
        Inventory.countDocuments({ actionType: 'stock_in', createdAt: { $gte: today } }),
        Inventory.countDocuments({ actionType: 'stock_out', createdAt: { $gte: today } }),
        Inventory.aggregate([
          { $match: { actionType: 'stock_in', createdAt: { $gte: today } } },
          { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]),
        Inventory.aggregate([
          { $match: { actionType: 'stock_out', createdAt: { $gte: today } } },
          { $group: { _id: null, total: { $sum: '$quantity' } } }
        ])
      ]),
      
      // This week stats
      Promise.all([
        Inventory.countDocuments({ actionType: 'stock_in', createdAt: { $gte: weekStart } }),
        Inventory.countDocuments({ actionType: 'stock_out', createdAt: { $gte: weekStart } })
      ]),
      
      // This month stats
      Promise.all([
        Inventory.countDocuments({ actionType: 'stock_in', createdAt: { $gte: monthStart } }),
        Inventory.countDocuments({ actionType: 'stock_out', createdAt: { $gte: monthStart } })
      ]),
      
      // This year stats
      Promise.all([
        Inventory.countDocuments({ actionType: 'stock_in', createdAt: { $gte: yearStart } }),
        Inventory.countDocuments({ actionType: 'stock_out', createdAt: { $gte: yearStart } })
      ]),
      
      // Total movements
      Inventory.countDocuments(),
      
      // ✅ FIX 14: Top adjusted products
      Inventory.aggregate([
        { $match: { actionType: 'adjustment' } },
        { $group: { _id: '$product', adjustmentCount: { $sum: 1 } } },
        { $sort: { adjustmentCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        { $project: { productName: '$product.name', productSku: '$product.sku', adjustmentCount: 1 } }
      ]),
      
      // ✅ FIX 15: Recent low stock alerts
      Notification.find({ type: 'low_stock', isResolved: false })
        .populate('relatedProduct', 'name sku')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    const [todayStockInCount, todayStockOutCount, todayStockInQty, todayStockOutQty] = todayStats;
    const [weekStockInCount, weekStockOutCount] = weekStats;
    const [monthStockInCount, monthStockOutCount] = monthStats;
    const [yearStockInCount, yearStockOutCount] = yearStats;

    res.status(200).json({
      success: true,
      stats: {
        today: {
          stockIn: { count: todayStockInCount, quantity: todayStockInQty[0]?.total || 0 },
          stockOut: { count: todayStockOutCount, quantity: todayStockOutQty[0]?.total || 0 }
        },
        week: {
          stockIn: weekStockInCount,
          stockOut: weekStockOutCount
        },
        month: {
          stockIn: monthStockInCount,
          stockOut: monthStockOutCount
        },
        year: {
          stockIn: yearStockInCount,
          stockOut: yearStockOutCount
        },
        totalMovements
      },
      topAdjustedProducts,
      activeAlerts: recentAlerts
    });
  } catch (error) {
    console.error('INVENTORY STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET CURRENT STOCK LEVELS (NEW) ====================
export const getCurrentStockLevels = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    
    const filter = {};
    
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { sku: { $regex: search.trim(), $options: 'i' } }
      ];
    }
    
    if (status && ['active', 'low_stock', 'out_of_stock'].includes(status)) {
      filter.status = status;
    }
    
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('name sku quantity minimumStock maximumStock sellingPrice costPrice status category')
        .populate('category', 'name')
        .skip(skip)
        .limit(limitNum)
        .sort({ quantity: 1 })
        .lean(),
      Product.countDocuments(filter)
    ]);
    
    // Add stock status indicator
    const enrichedProducts = products.map(product => ({
      ...product,
      stockStatus: product.quantity === 0 ? 'out_of_stock' : 
                   product.quantity <= product.minimumStock ? 'low_stock' : 'healthy',
      stockPercentage: product.maximumStock ? 
        Math.min(100, (product.quantity / product.maximumStock) * 100) : 100
    }));
    
    res.status(200).json({
      success: true,
      products: enrichedProducts,
      summary: {
        totalProducts: total,
        lowStockCount: enrichedProducts.filter(p => p.stockStatus === 'low_stock').length,
        outOfStockCount: enrichedProducts.filter(p => p.stockStatus === 'out_of_stock').length,
        healthyStockCount: enrichedProducts.filter(p => p.stockStatus === 'healthy').length
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('CURRENT STOCK LEVELS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current stock levels',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== BULK STOCK UPDATE (NEW) ====================
export const bulkStockUpdate = async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of stock updates'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const update of updates) {
      try {
        const { productId, quantity, action, reason } = update;
        
        if (!validateObjectId(productId)) {
          errors.push({ productId, error: 'Invalid product ID format' });
          continue;
        }
        
        const product = await Product.findById(productId);
        if (!product) {
          errors.push({ productId, error: 'Product not found' });
          continue;
        }
        
        const previousQuantity = product.quantity;
        
        if (action === 'increase') {
          product.quantity += quantity;
        } else if (action === 'decrease') {
          if (product.quantity < quantity) {
            errors.push({ productId, error: `Insufficient stock. Available: ${product.quantity}` });
            continue;
          }
          product.quantity -= quantity;
        } else {
          errors.push({ productId, error: 'Invalid action. Use "increase" or "decrease"' });
          continue;
        }
        
        await product.save();
        
        const inventory = await createInventoryRecord(
          productId, 
          action === 'increase' ? 'stock_in' : 'stock_out', 
          quantity, 
          previousQuantity, 
          product.quantity, 
          reason || 'Bulk update', 
          null, 
          req.userId
        );
        
        results.push({
          productId,
          productName: product.name,
          previousQuantity,
          newQuantity: product.quantity,
          action,
          quantity
        });
      } catch (error) {
        errors.push({ productId: update.productId, error: error.message });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Processed ${results.length} updates successfully`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('BULK STOCK UPDATE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk stock update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};