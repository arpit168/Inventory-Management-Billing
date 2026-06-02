import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Inventory from '../models/Inventory.js';
import Notification from '../models/Notification.js';
import { validationResult } from 'express-validator';

// ==================== HELPER FUNCTIONS ====================
const validateObjectId = (id) => {
  return id && id.match(/^[0-9a-fA-F]{24}$/);
};

const calculateProfitMargin = (sellingPrice, purchasePrice) => {
  if (purchasePrice === 0) return 100;
  return ((sellingPrice - purchasePrice) / sellingPrice) * 100;
};

// ==================== ADD PRODUCT ====================
export const addProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      name, 
      sku, 
      category, 
      description, 
      purchasePrice = 0, 
      sellingPrice = 0, 
      quantity = 0, 
      minimumStock = 0, 
      reorderQuantity = 0,
      unit,
      weight,
      barcode,
      taxRate = 0,
      image,
      location
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required',
      });
    }

    if (!sku || !sku.trim()) {
      return res.status(400).json({
        success: false,
        message: 'SKU is required',
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required',
      });
    }

    // ✅ FIX 1: Validate ObjectId
    if (!validateObjectId(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
      });
    }

    // Validate prices
    if (purchasePrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Purchase price cannot be negative',
      });
    }

    if (sellingPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Selling price cannot be negative',
      });
    }

    if (sellingPrice < purchasePrice) {
      return res.status(400).json({
        success: false,
        message: 'Selling price must be greater than or equal to purchase price',
      });
    }

    // Validate quantities
    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be negative',
      });
    }

    if (minimumStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Minimum stock cannot be negative',
      });
    }

    if (reorderQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Reorder quantity cannot be negative',
      });
    }

    if (minimumStock >= reorderQuantity && reorderQuantity > 0) {
      return res.status(400).json({
        success: false,
        message: 'Reorder quantity must be greater than minimum stock level',
      });
    }

    if (taxRate < 0 || taxRate > 100) {
      return res.status(400).json({
        success: false,
        message: 'Tax rate must be between 0 and 100',
      });
    }

    // Check if product with same SKU exists
    const existingProduct = await Product.findOne({ sku: sku.trim().toUpperCase() });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists',
      });
    }

    // Check if barcode is unique (if provided)
    if (barcode) {
      const existingBarcode = await Product.findOne({ barcode });
      if (existingBarcode) {
        return res.status(400).json({
          success: false,
          message: 'Product with this barcode already exists',
        });
      }
    }

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Determine initial status based on quantity
    let status = 'active';
    if (quantity === 0) {
      status = 'out_of_stock';
    } else if (quantity <= minimumStock) {
      status = 'low_stock';
    }

    const profitMargin = calculateProfitMargin(sellingPrice, purchasePrice);

    const product = await Product.create({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category,
      description: description?.trim(),
      purchasePrice,
      sellingPrice,
      quantity,
      minimumStock,
      reorderQuantity,
      unit: unit || 'piece',
      weight: weight || 0,
      barcode: barcode || null,
      taxRate,
      image: image || null,
      location: location?.trim() || null,
      status,
      profitMargin,
      createdBy: req.userId,
    });

    await product.populate('category', 'name');

    // ✅ FIX 2: Create initial inventory record
    if (quantity > 0) {
      await Inventory.create({
        product: product._id,
        actionType: 'stock_in',
        quantity: quantity,
        previousQuantity: 0,
        newQuantity: quantity,
        reason: 'Initial stock',
        notes: 'Product creation with initial stock',
        user: req.userId,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product,
    });
  } catch (error) {
    console.error('ADD PRODUCT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET ALL PRODUCTS ====================
export const getProducts = async (req, res, next) => {
  try {
    let { 
      page = 1, 
      limit = 10, 
      search, 
      category, 
      status,
      minPrice,
      maxPrice,
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
        { name: { $regex: searchTerm, $options: 'i' } },
        { sku: { $regex: searchTerm, $options: 'i' } },
        { barcode: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Category filter
    if (category && validateObjectId(category)) {
      filter.category = category;
    }

    // Status filter
    if (status) {
      const validStatuses = ['active', 'low_stock', 'out_of_stock', 'discontinued'];
      const statuses = status.split(',');
      const filteredStatuses = statuses.filter(s => validStatuses.includes(s));
      if (filteredStatuses.length) {
        filter.status = { $in: filteredStatuses };
      }
    }

    // ✅ FIX 3: Price range filter
    if (minPrice || maxPrice) {
      filter.sellingPrice = {};
      if (minPrice) filter.sellingPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.sellingPrice.$lte = parseFloat(maxPrice);
    }

    const skip = (page - 1) * limit;
    
    // Dynamic sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name icon')
        .select('-__v')
        .skip(skip)
        .limit(limit)
        .sort(sortOptions)
        .lean(),
      Product.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / limit);

    // ✅ FIX 4: Add summary
    const summary = {
      totalProducts: total,
      totalValue: products.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0),
      averagePrice: products.length > 0 
        ? products.reduce((sum, p) => sum + p.sellingPrice, 0) / products.length 
        : 0
    };

    res.status(200).json({
      success: true,
      products,
      summary,
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
    console.error('GET PRODUCTS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET PRODUCT BY ID ====================
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const [product, inventoryHistory, relatedProducts] = await Promise.all([
      Product.findById(id)
        .populate('category', 'name description')
        .populate('createdBy', 'fullName email')
        .lean(),
      Inventory.find({ product: id })
        .populate('user', 'fullName')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Product.find({ 
        category: { $ne: null },
        _id: { $ne: id },
        status: 'active'
      })
        .limit(5)
        .select('name sku sellingPrice quantity')
        .lean()
    ]);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      product,
      inventoryHistory,
      relatedProducts,
      stats: {
        totalSold: inventoryHistory
          .filter(i => i.actionType === 'stock_out')
          .reduce((sum, i) => sum + i.quantity, 0),
        totalPurchased: inventoryHistory
          .filter(i => i.actionType === 'stock_in')
          .reduce((sum, i) => sum + i.quantity, 0)
      }
    });
  } catch (error) {
    console.error('GET PRODUCT BY ID ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== UPDATE PRODUCT ====================
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      sku, 
      category, 
      description, 
      purchasePrice, 
      sellingPrice, 
      quantity, 
      minimumStock, 
      reorderQuantity, 
      status,
      barcode,
      taxRate,
      image,
      location,
      unit
    } = req.body;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    let product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if new SKU conflicts
    if (sku && sku.trim().toUpperCase() !== product.sku) {
      const existingProduct = await Product.findOne({ 
        sku: sku.trim().toUpperCase(),
        _id: { $ne: id }
      });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this SKU already exists',
        });
      }
    }

    // Check barcode uniqueness
    if (barcode && barcode !== product.barcode) {
      const existingBarcode = await Product.findOne({ 
        barcode,
        _id: { $ne: id }
      });
      if (existingBarcode) {
        return res.status(400).json({
          success: false,
          message: 'Product with this barcode already exists',
        });
      }
    }

    // Check if category exists
    if (category && validateObjectId(category)) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }
    }

    // ✅ FIX 5: Auto-update status based on quantity
    let newStatus = status || product.status;
    const newQuantity = quantity !== undefined ? quantity : product.quantity;
    
    if (newQuantity === 0) {
      newStatus = 'out_of_stock';
    } else if (newQuantity <= (minimumStock || product.minimumStock)) {
      newStatus = 'low_stock';
    } else if (newStatus === 'out_of_stock' || newStatus === 'low_stock') {
      newStatus = 'active';
    }

    // Calculate profit margin
    const newSellingPrice = sellingPrice !== undefined ? sellingPrice : product.sellingPrice;
    const newPurchasePrice = purchasePrice !== undefined ? purchasePrice : product.purchasePrice;
    const profitMargin = calculateProfitMargin(newSellingPrice, newPurchasePrice);

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sku !== undefined) updateData.sku = sku.trim().toUpperCase();
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description?.trim();
    if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice;
    if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (minimumStock !== undefined) updateData.minimumStock = minimumStock;
    if (reorderQuantity !== undefined) updateData.reorderQuantity = reorderQuantity;
    if (barcode !== undefined) updateData.barcode = barcode;
    if (taxRate !== undefined) updateData.taxRate = taxRate;
    if (image !== undefined) updateData.image = image;
    if (location !== undefined) updateData.location = location?.trim();
    if (unit !== undefined) updateData.unit = unit;
    updateData.status = newStatus;
    updateData.profitMargin = profitMargin;

    product = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name');

    // ✅ FIX 6: Create inventory record for quantity change
    if (quantity !== undefined && quantity !== product.quantity) {
      await Inventory.create({
        product: product._id,
        actionType: 'adjustment',
        quantity: Math.abs(quantity - product.quantity),
        previousQuantity: product.quantity,
        newQuantity: quantity,
        reason: 'Product update',
        notes: 'Quantity updated via product edit',
        user: req.userId,
      });
    }

    // ✅ FIX 7: Check and create low stock notification
    if (newStatus === 'low_stock' || newStatus === 'out_of_stock') {
      const existingNotification = await Notification.findOne({
        relatedProduct: product._id,
        type: newStatus === 'low_stock' ? 'low_stock' : 'out_of_stock',
        isResolved: false
      });
      
      if (!existingNotification) {
        await Notification.create({
          title: newStatus === 'low_stock' ? 'Low Stock Alert' : 'Out of Stock Alert',
          message: `Product ${product.name} (${product.sku}) is ${newStatus === 'low_stock' ? 'running low' : 'out of stock'}. Current stock: ${product.quantity}`,
          type: newStatus === 'low_stock' ? 'low_stock' : 'out_of_stock',
          priority: newStatus === 'out_of_stock' ? 'high' : 'medium',
          relatedProduct: product._id,
          recipient: req.userId,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    console.error('UPDATE PRODUCT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== DELETE PRODUCT ====================
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // ✅ FIX 8: Check if product is used in invoices
    const Invoice = (await import('../models/Invoice.js')).default;
    const invoiceItems = await Invoice.countDocuments({
      'items.product': id,
      status: { $ne: 'cancelled' }
    });

    if (invoiceItems > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product. It is used in ${invoiceItems} invoice(s). Consider marking as discontinued instead.`,
        invoiceCount: invoiceItems
      });
    }

    // Soft delete by updating status
    product.status = 'discontinued';
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product marked as discontinued',
      product: {
        id: product._id,
        name: product.name,
        status: product.status
      }
    });
  } catch (error) {
    console.error('DELETE PRODUCT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET LOW STOCK PRODUCTS ====================
export const getLowStockProducts = async (req, res, next) => {
  try {
    let { limit = 10, includeOutOfStock = 'false' } = req.query;

    limit = Math.max(1, Math.min(100, parseInt(limit) || 10));

    const filter = {
      status: { $in: ['active', 'low_stock'] },
      $expr: { $lte: ['$quantity', '$minimumStock'] }
    };

    if (includeOutOfStock !== 'true') {
      filter.quantity = { $gt: 0 };
    }

    const products = await Product.find(filter)
      .populate('category', 'name')
      .limit(limit)
      .sort({ quantity: 1 })
      .lean();

    const summary = {
      totalLowStock: products.length,
      criticalCount: products.filter(p => p.quantity === 0).length,
      reorderValue: products.reduce((sum, p) => {
        const needed = Math.max(0, p.minimumStock - p.quantity);
        return sum + (needed * p.purchasePrice);
      }, 0)
    };

    res.status(200).json({
      success: true,
      products,
      summary
    });
  } catch (error) {
    console.error('GET LOW STOCK ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET OUT OF STOCK PRODUCTS ====================
export const getOutOfStockProducts = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    const products = await Product.find({
      quantity: 0,
      status: 'active'
    })
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('GET OUT OF STOCK ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch out of stock products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET PRODUCT STATS ====================
export const getProductStats = async (req, res, next) => {
  try {
    const [
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalInventoryValue,
      categoryDistribution,
      profitStats
    ] = await Promise.all([
      Product.countDocuments({ status: { $ne: 'discontinued' } }),
      Product.countDocuments({
        $expr: { $lte: ['$quantity', '$minimumStock'] },
        quantity: { $gt: 0 },
        status: { $ne: 'discontinued' }
      }),
      Product.countDocuments({
        quantity: 0,
        status: { $ne: 'discontinued' }
      }),
      Product.aggregate([
        { $match: { status: { $ne: 'discontinued' } } },
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
            totalCost: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } }
          }
        }
      ]),
      Product.aggregate([
        { $match: { category: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: '$category' },
        { $project: { categoryName: '$category.name', count: 1 } }
      ]),
      Product.aggregate([
        {
          $group: {
            _id: null,
            avgProfitMargin: { $avg: '$profitMargin' },
            totalProfitPotential: {
              $sum: {
                $multiply: [
                  '$quantity',
                  { $subtract: ['$sellingPrice', '$purchasePrice'] }
                ]
              }
            }
          }
        }
      ])
    ]);

    const inventoryValue = totalInventoryValue[0] || { totalValue: 0, totalCost: 0 };

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        healthyStock: totalProducts - lowStockProducts - outOfStockProducts,
        totalInventoryValue: Math.round(inventoryValue.totalValue),
        totalInventoryCost: Math.round(inventoryValue.totalCost),
        potentialProfit: Math.round(inventoryValue.totalValue - inventoryValue.totalCost),
        avgProfitMargin: profitStats[0]?.avgProfitMargin?.toFixed(2) || 0,
        totalProfitPotential: Math.round(profitStats[0]?.totalProfitPotential || 0)
      },
      categoryDistribution
    });
  } catch (error) {
    console.error('PRODUCT STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== BULK PRODUCT IMPORT (NEW) ====================
export const bulkImportProducts = async (req, res, next) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of products'
      });
    }

    if (products.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 500 products per import'
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const productData of products) {
      try {
        const {
          name, sku, category, description, purchasePrice,
          sellingPrice, quantity, minimumStock, reorderQuantity
        } = productData;

        if (!name || !sku) {
          results.failed.push({ product: name || sku, error: 'Name and SKU are required' });
          continue;
        }

        const existingProduct = await Product.findOne({ sku: sku.toUpperCase() });
        if (existingProduct) {
          results.failed.push({ product: name, sku, error: 'SKU already exists' });
          continue;
        }

        let categoryId = null;
        if (category) {
          const cat = await Category.findOne({ name: category });
          if (cat) categoryId = cat._id;
        }

        const product = await Product.create({
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category: categoryId,
          description: description?.trim(),
          purchasePrice: purchasePrice || 0,
          sellingPrice: sellingPrice || 0,
          quantity: quantity || 0,
          minimumStock: minimumStock || 0,
          reorderQuantity: reorderQuantity || 0,
          createdBy: req.userId,
          status: (quantity || 0) === 0 ? 'out_of_stock' : 'active'
        });

        results.successful.push({
          id: product._id,
          name: product.name,
          sku: product.sku
        });
      } catch (error) {
        results.failed.push({
          product: productData.name || productData.sku,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Imported ${results.successful.length} products successfully`,
      results
    });
  } catch (error) {
    console.error('BULK IMPORT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET PRODUCT BY BARCODE (NEW) ====================
export const getProductByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: 'Barcode is required'
      });
    }

    const product = await Product.findOne({ barcode })
      .populate('category', 'name')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found with this barcode'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('GET PRODUCT BY BARCODE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};