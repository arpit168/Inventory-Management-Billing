import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { validationResult } from 'express-validator';

// ==================== ADD CATEGORY ====================
export const addCategory = async (req, res, next) => {
  try {
    // ✅ FIX 1: Add validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, icon, image } = req.body;

    // ✅ FIX 2: Check required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    // Check if category already exists (case-insensitive)
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists',
      });
    }

    // ✅ FIX 3: Sanitize inputs
    const category = await Category.create({
      name: name.trim(),
      description: description?.trim(),
      icon: icon?.trim(),
      image: image?.trim(),
      createdBy: req.userId,
      status: 'active', // Default status
    });

    // ✅ FIX 4: Populate createdBy before sending response
    const populatedCategory = await Category.findById(category._id)
      .populate('createdBy', 'fullName email');

    res.status(201).json({
      success: true,
      message: 'Category added successfully',
      category: populatedCategory,
    });
  } catch (error) {
    console.error('ADD CATEGORY ERROR:', error);
    
    // ✅ FIX 5: Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category name already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET ALL CATEGORIES ====================
export const getCategories = async (req, res, next) => {
  try {
    let { page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Validate pagination
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const filter = {};

    // ✅ FIX 6: Improve search functionality
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    
    // ✅ FIX 7: Dynamic sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .populate('createdBy', 'fullName email')
        .skip(skip)
        .limit(limit)
        .sort(sortOptions),
      Category.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      categories,
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNextPage: page < pages,
        hasPrevPage: page > 1,
        startIndex: skip + 1,
        endIndex: Math.min(skip + limit, total)
      },
    });
  } catch (error) {
    console.error('GET CATEGORIES ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET CATEGORY BY ID ====================
export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ✅ FIX 8: Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
      });
    }

    const category = await Category.findById(id)
      .populate('createdBy', 'fullName email');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // ✅ FIX 9: Optimize product query with pagination
    const productPage = parseInt(req.query.productPage) || 1;
    const productLimit = parseInt(req.query.productLimit) || 5;
    
    const [products, productCount] = await Promise.all([
      Product.find({ category: id })
        .select('name sku quantity sellingPrice image')
        .skip((productPage - 1) * productLimit)
        .limit(productLimit)
        .sort({ createdAt: -1 }),
      Product.countDocuments({ category: id })
    ]);

    res.status(200).json({
      success: true,
      category,
      products: {
        data: products,
        total: productCount,
        page: productPage,
        limit: productLimit,
        pages: Math.ceil(productCount / productLimit)
      }
    });
  } catch (error) {
    console.error('GET CATEGORY BY ID ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== UPDATE CATEGORY ====================
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, icon, image, status } = req.body;

    // ✅ FIX 10: Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // ✅ FIX 11: Build update object dynamically
    const updateData = {};
    
    if (name && name.trim() !== '') {
      // Check if new name conflicts with existing category
      if (name.trim().toLowerCase() !== category.name.toLowerCase()) {
        const existingCategory = await Category.findOne({ 
          name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
          _id: { $ne: id }
        });
        
        if (existingCategory) {
          return res.status(400).json({
            success: false,
            message: 'Category with this name already exists',
          });
        }
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) updateData.description = description.trim();
    if (icon !== undefined) updateData.icon = icon.trim();
    if (image !== undefined) updateData.image = image.trim();
    if (status && ['active', 'inactive'].includes(status)) {
      updateData.status = status;
    }

    // ✅ FIX 12: Check if anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category: updatedCategory,
    });
  } catch (error) {
    console.error('UPDATE CATEGORY ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== DELETE CATEGORY ====================
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ✅ FIX 13: Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // ✅ FIX 14: Check if category has products (with better error message)
    const productCount = await Product.countDocuments({ category: id });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}" because it has ${productCount} associated product(s)`,
        productCount,
        suggestion: 'Move products to another category or delete them first'
      });
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Category "${category.name}" deleted successfully`,
    });
  } catch (error) {
    console.error('DELETE CATEGORY ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET CATEGORY STATS ====================
export const getCategoryStats = async (req, res, next) => {
  try {
    const stats = await Category.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          status: 1,
          productCount: { $size: '$products' },
          totalValue: {
            $sum: {
              $map: {
                input: '$products',
                as: 'product',
                in: {
                  $multiply: ['$$product.quantity', '$$product.sellingPrice'],
                },
              },
            },
          },
          // ✅ FIX 15: Add low stock count
          lowStockCount: {
            $size: {
              $filter: {
                input: '$products',
                as: 'product',
                cond: { $lte: ['$$product.quantity', '$$product.lowStockThreshold'] }
              }
            }
          },
          // ✅ FIX 16: Add average price
          averagePrice: {
            $cond: {
              if: { $gt: [{ $size: '$products' }, 0] },
              then: {
                $avg: {
                  $map: {
                    input: '$products',
                    as: 'product',
                    in: '$$product.sellingPrice'
                  }
                }
              },
              else: 0
            }
          }
        },
      },
      { $sort: { productCount: -1 } } // Sort by most products first
    ]);

    // ✅ FIX 17: Calculate overall stats
    const totalCategories = stats.length;
    const totalProducts = stats.reduce((sum, cat) => sum + cat.productCount, 0);
    const totalInventoryValue = stats.reduce((sum, cat) => sum + cat.totalValue, 0);
    const activeCategories = await Category.countDocuments({ status: 'active' });
    const inactiveCategories = await Category.countDocuments({ status: 'inactive' });

    res.status(200).json({
      success: true,
      summary: {
        totalCategories,
        activeCategories,
        inactiveCategories,
        totalProducts,
        totalInventoryValue,
      },
      categoryStats: stats,
    });
  } catch (error) {
    console.error('GET CATEGORY STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== BULK DELETE CATEGORIES (NEW) ====================
export const bulkDeleteCategories = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of category IDs',
      });
    }

    // ✅ Check for products in these categories
    const categoriesWithProducts = await Category.aggregate([
      { $match: { _id: { $in: ids } } },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products',
        },
      },
      {
        $project: {
          name: 1,
          productCount: { $size: '$products' },
        },
      },
      { $match: { productCount: { $gt: 0 } } }
    ]);

    if (categoriesWithProducts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete categories with products',
        categoriesWithProducts: categoriesWithProducts.map(c => ({
          name: c.name,
          productCount: c.productCount
        }))
      });
    }

    const result = await Category.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} category(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('BULK DELETE CATEGORIES ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== UPDATE CATEGORY STATUS (NEW) ====================
export const updateCategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
      });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "inactive"',
      });
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.status(200).json({
      success: true,
      message: `Category status updated to ${status}`,
      category,
    });
  } catch (error) {
    console.error('UPDATE CATEGORY STATUS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};