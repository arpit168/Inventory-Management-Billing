import Product from '../models/Product.js';
import Category from '../models/Category.js';

export const addProduct = async (req, res, next) => {
  try {
    const { name, sku, category, description, purchasePrice, sellingPrice, quantity, minimumStock, reorderQuantity } = req.body;

    // Validate required fields
    if (!name || !sku || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, SKU, and category are required',
      });
    }

    // Validate prices
    if (purchasePrice < 0 || sellingPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Prices cannot be negative',
      });
    }

    if (sellingPrice < purchasePrice) {
      return res.status(400).json({
        success: false,
        message: 'Selling price must be greater than or equal to purchase price',
      });
    }

    // Validate quantities
    if (quantity < 0 || minimumStock < 0 || reorderQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantities cannot be negative',
      });
    }

    if (minimumStock >= reorderQuantity) {
      return res.status(400).json({
        success: false,
        message: 'Reorder quantity must be greater than minimum stock level',
      });
    }

    // Check if product with same SKU exists
    const existingProduct = await Product.findOne({ sku: sku.toUpperCase() });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists',
      });
    }

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const product = await Product.create({
      name,
      sku: sku.toUpperCase(),
      category,
      description,
      purchasePrice,
      sellingPrice,
      quantity,
      minimumStock,
      reorderQuantity,
      createdBy: req.userId,
    });

    await product.populate('category', 'name');

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getProducts = async (req, res, next) => {
  try {
    let { page = 1, limit = 10, search, category, status } = req.query;

    // Validate and sanitize pagination parameters
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.max(1, Math.min(100, parseInt(limit) || 10)); // Max 100 items per page to prevent DoS

    const filter = {};

    if (search && search.trim()) {
      const searchTerm = search.trim();
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { sku: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (category && category.trim()) {
      filter.category = category;
    }

    if (status && status.trim()) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .populate('category', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      products,
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
      message: 'Failed to fetch products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).populate('category', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sku, category, description, purchasePrice, sellingPrice, quantity, minimumStock, reorderQuantity, status } = req.body;

    let product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if new SKU conflicts with existing product
    if (sku && sku.toUpperCase() !== product.sku) {
      const existingProduct = await Product.findOne({ sku: sku.toUpperCase() });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this SKU already exists',
        });
      }
    }

    // Check if category exists
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }
    }

    product = await Product.findByIdAndUpdate(
      id,
      {
        name,
        sku: sku?.toUpperCase(),
        category,
        description,
        purchasePrice,
        sellingPrice,
        quantity,
        minimumStock,
        reorderQuantity,
        status,
      },
      { new: true, runValidators: true }
    ).populate('category', 'name');

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getLowStockProducts = async (req, res, next) => {
  try {
    let { limit = 10 } = req.query;

    // Validate limit parameter
    limit = Math.max(1, Math.min(100, parseInt(limit) || 10));

    const products = await Product.find({
      $expr: { $lte: ['$quantity', '$minimumStock'] },
      status: 'active',
    })
      .populate('category', 'name')
      .limit(limit)
      .sort({ quantity: 1 });

    res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getOutOfStockProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      quantity: 0,
      status: 'active',
    })
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch out of stock products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getProductStats = async (req, res, next) => {
  try {
    const totalProducts = await Product.countDocuments({ status: 'active' });
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lte: ['$quantity', '$minimumStock'] },
      status: 'active',
    });
    const outOfStockProducts = await Product.countDocuments({
      quantity: 0,
      status: 'active',
    });

    const totalInventoryValue = await Product.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        totalInventoryValue: totalInventoryValue[0]?.totalValue || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
