import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Invoice from '../models/Invoice.js';
import Inventory from '../models/Inventory.js';
import Notification from '../models/Notification.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Total products
    const totalProducts = await Product.countDocuments({ status: 'active' });

    // Total categories
    const totalCategories = await Category.countDocuments({ status: 'active' });

    // Low stock products
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lte: ['$quantity', '$minimumStock'] },
      status: 'active',
    });

    // Out of stock products
    const outOfStockProducts = await Product.countDocuments({
      quantity: 0,
      status: 'active',
    });

    // Today's sales
    const todaySalesData = await Invoice.aggregate([
      { $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);

    const todaySales = todaySalesData[0]?.totalSales || 0;
    const todayInvoices = todaySalesData[0]?.count || 0;

    // This month's revenue
    const monthRevenueData = await Invoice.aggregate([
      { $match: { createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
    ]);

    const monthRevenue = monthRevenueData[0]?.totalRevenue || 0;

    // Total inventory value
    const inventoryValueData = await Product.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
        },
      },
    ]);

    const totalInventoryValue = inventoryValueData[0]?.totalValue || 0;

    // Recent activities (inventory movements)
    const recentActivities = await Inventory.find()
      .populate('product', 'name sku')
      .populate('user', 'fullName')
      .sort({ createdAt: -1 })
      .limit(10);

    // Recent notifications
    const recentNotifications = await Notification.find({ recipient: req.userId })
      .populate('relatedProduct', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        totalCategories,
        lowStockProducts,
        outOfStockProducts,
        totalInventoryValue,
        todaySales,
        todayInvoices,
        monthRevenue,
      },
      recentActivities,
      recentNotifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message,
    });
  }
};

export const getSalesChartData = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    const salesData = await Invoice.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          totalSales: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: salesData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales chart data',
      error: error.message,
    });
  }
};

export const getRevenueChartData = async (req, res, next) => {
  try {
    const { months = 12 } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const revenueData = await Invoice.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' },
          },
          totalRevenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: revenueData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue chart data',
      error: error.message,
    });
  }
};

export const getInventoryChartData = async (req, res, next) => {
  try {
    const inventoryData = await Category.aggregate([
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
          totalQuantity: { $sum: '$products.quantity' },
          productCount: { $size: '$products' },
        },
      },
      { $sort: { totalQuantity: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: inventoryData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory chart data',
      error: error.message,
    });
  }
};

export const getTopSellingProducts = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const topProducts = await Invoice.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
        },
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      {
        $project: {
          productId: '$_id',
          productName: { $arrayElemAt: ['$product.name', 0] },
          productSku: { $arrayElemAt: ['$product.sku', 0] },
          totalQuantitySold: 1,
          totalRevenue: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: topProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top selling products',
      error: error.message,
    });
  }
};

export const getCategoryStats = async (req, res, next) => {
  try {
    const categoryStats = await Category.aggregate([
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
          totalQuantity: { $sum: '$products.quantity' },
        },
      },
      { $sort: { productCount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: categoryStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category statistics',
      error: error.message,
    });
  }
};
