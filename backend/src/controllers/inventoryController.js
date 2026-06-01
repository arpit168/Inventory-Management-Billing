import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';

/**
 * Stock In
 */
export const stockIn = async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body;

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

    product.quantity += quantity;
    await product.save();

    const inventory = await Inventory.create({
      product: productId,
      actionType: 'stock_in',
      quantity,
      previousQuantity,
      newQuantity: product.quantity,
      reason: reason || 'Stock In',
      notes,
      user: req.userId,
    });

    await inventory.populate('product', 'name sku');
    await inventory.populate('user', 'fullName');

    res.status(201).json({
      success: true,
      message: 'Stock added successfully',
      inventory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to record stock in',
      error: error.message,
    });
  }
};

/**
 * Stock Out
 */
export const stockOut = async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body;

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
      });
    }

    const previousQuantity = product.quantity;

    product.quantity -= quantity;
    await product.save();

    const inventory = await Inventory.create({
      product: productId,
      actionType: 'stock_out',
      quantity,
      previousQuantity,
      newQuantity: product.quantity,
      reason: reason || 'Stock Out',
      notes,
      user: req.userId,
    });

    await inventory.populate('product', 'name sku');
    await inventory.populate('user', 'fullName');

    res.status(201).json({
      success: true,
      message: 'Stock removed successfully',
      inventory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to record stock out',
      error: error.message,
    });
  }
};

/**
 * Adjust Stock
 */
export const adjustStock = async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body;

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

    product.quantity = quantity;
    await product.save();

    const inventory = await Inventory.create({
      product: productId,
      actionType: 'adjustment',
      quantity: Math.abs(previousQuantity - quantity),
      previousQuantity,
      newQuantity: quantity,
      reason: reason || 'Stock Adjustment',
      notes,
      user: req.userId,
    });

    await inventory.populate('product', 'name sku');
    await inventory.populate('user', 'fullName');

    res.status(201).json({
      success: true,
      message: 'Stock adjusted successfully',
      inventory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to adjust stock',
      error: error.message,
    });
  }
};

/**
 * Inventory History
 */
export const getInventoryHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      productId,
      actionType,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    if (productId) filter.product = productId;
    if (actionType) filter.actionType = actionType;

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const inventoryRecords = await Inventory.find(filter)
      .populate('product', 'name sku')
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Inventory.countDocuments(filter);

    res.status(200).json({
      success: true,
      inventoryRecords,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory history',
      error: error.message,
    });
  }
};

/**
 * Product Inventory History
 */
export const getProductInventoryHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const inventoryRecords = await Inventory.find({
      product: productId,
    })
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Inventory.countDocuments({
      product: productId,
    });

    res.status(200).json({
      success: true,
      product: {
        id: product._id,
        name: product.name,
        sku: product.sku,
        currentQuantity: product.quantity,
      },
      inventoryRecords,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product inventory history',
      error: error.message,
    });
  }
};

/**
 * Inventory Statistics
 */
export const getInventoryStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      stockInToday,
      stockOutToday,
      stockInThisMonth,
      stockOutThisMonth,
      totalMovements,
    ] = await Promise.all([
      Inventory.countDocuments({
        actionType: 'stock_in',
        createdAt: { $gte: today },
      }),
      Inventory.countDocuments({
        actionType: 'stock_out',
        createdAt: { $gte: today },
      }),
      Inventory.countDocuments({
        actionType: 'stock_in',
        createdAt: { $gte: monthStart },
      }),
      Inventory.countDocuments({
        actionType: 'stock_out',
        createdAt: { $gte: monthStart },
      }),
      Inventory.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        stockInToday,
        stockOutToday,
        stockInThisMonth,
        stockOutThisMonth,
        totalMovements,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory statistics',
      error: error.message,
    });
  }
};