import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Invoice from '../models/Invoice.js';
import Inventory from '../models/Inventory.js';
import Notification from '../models/Notification.js';

// ==================== HELPER FUNCTIONS ====================
const getStartOfDay = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getStartOfMonth = (date) => {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
};

// ✅ FIX 1: Cache helper (optional, for performance)
const cacheResponse = (res, data, duration = 300) => {
  res.set('Cache-Control', `public, max-age=${duration}`);
  return res.json(data);
};

// ==================== GET DASHBOARD STATS ====================
export const getDashboardStats = async (req, res, next) => {
  try {
    const today = getStartOfDay(new Date());
    const thisMonth = getStartOfMonth(new Date());
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    lastWeek.setHours(0, 0, 0, 0);

    // ✅ FIX 2: Run all queries in parallel for better performance
    const [
      totalProducts,
      totalCategories,
      lowStockData,
      outOfStockData,
      todaySalesData,
      monthRevenueData,
      inventoryValueData,
      recentActivities,
      recentNotifications,
      previousWeekSalesData,
      pendingOrders
    ] = await Promise.all([
      // Total products
      Product.countDocuments({ status: 'active' }),
      
      // Total categories
      Category.countDocuments({ status: 'active' }),
      
      // Low stock products (with proper threshold check)
      Product.countDocuments({
        $expr: { $lte: ['$quantity', '$minimumStock'] },
        status: 'active',
        quantity: { $gt: 0 } // ✅ FIX 3: Exclude out of stock from low stock
      }),
      
      // Out of stock products
      Product.countDocuments({
        quantity: 0,
        status: 'active'
      }),
      
      // Today's sales
      Invoice.aggregate([
        { 
          $match: { 
            createdAt: { $gte: today }, 
            status: { $ne: 'cancelled' } 
          } 
        },
        { 
          $group: { 
            _id: null, 
            totalSales: { $sum: '$totalAmount' }, 
            count: { $sum: 1 } 
          } 
        }
      ]),
      
      // This month's revenue
      Invoice.aggregate([
        { 
          $match: { 
            createdAt: { $gte: thisMonth }, 
            status: { $ne: 'cancelled' } 
          } 
        },
        { 
          $group: { 
            _id: null, 
            totalRevenue: { $sum: '$totalAmount' } 
          } 
        }
      ]),
      
      // Total inventory value
      Product.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            totalValue: { 
              $sum: { 
                $multiply: ['$quantity', '$sellingPrice'] 
              } 
            }
          }
        }
      ]),
      
      // Recent activities (with pagination and proper population)
      Inventory.find()
        .populate('product', 'name sku sellingPrice')
        .populate('user', 'fullName email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(), // ✅ FIX 4: Use lean() for better performance
      
      // Recent notifications (unread first)
      Notification.find({ recipient: req.userId })
        .populate('relatedProduct', 'name sku')
        .sort({ isRead: 1, createdAt: -1 }) // ✅ FIX 5: Unread first
        .limit(10)
        .lean(),
      
      // Previous week sales for comparison
      Invoice.aggregate([
        { 
          $match: { 
            createdAt: { $gte: lastWeek, $lt: today }, 
            status: { $ne: 'cancelled' } 
          } 
        },
        { 
          $group: { 
            _id: null, 
            totalSales: { $sum: '$totalAmount' } 
          } 
        }
      ]),
      
      // Pending orders count
      Invoice.countDocuments({ 
        status: 'pending',
        createdAt: { $gte: getStartOfDay(new Date()) }
      })
    ]);

    const todaySales = todaySalesData[0]?.totalSales || 0;
    const todayInvoices = todaySalesData[0]?.count || 0;
    const monthRevenue = monthRevenueData[0]?.totalRevenue || 0;
    const totalInventoryValue = inventoryValueData[0]?.totalValue || 0;
    const previousWeekSales = previousWeekSalesData[0]?.totalSales || 0;

    // ✅ FIX 6: Calculate percentage changes
    const salesGrowth = previousWeekSales === 0 
      ? 100 
      : ((todaySales - previousWeekSales) / previousWeekSales) * 100;

    // ✅ FIX 7: Get low stock products list (for alerts)
    const lowStockProductsList = await Product.find({
      $expr: { $lte: ['$quantity', '$minimumStock'] },
      status: 'active',
      quantity: { $gt: 0 }
    })
    .select('name sku quantity minimumStock')
    .limit(5)
    .lean();

    // ✅ FIX 8: Get top performing category
    const topCategory = await Category.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
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
                in: { $multiply: ['$$product.quantity', '$$product.sellingPrice'] }
              }
            }
          }
        }
      },
      { $sort: { totalValue: -1 } },
      { $limit: 1 }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        totalCategories,
        lowStockProducts: lowStockData,
        outOfStockProducts: outOfStockData,
        totalInventoryValue: Math.round(totalInventoryValue), // ✅ FIX 9: Round to integer
        todaySales: Math.round(todaySales),
        todayInvoices,
        monthRevenue: Math.round(monthRevenue),
        pendingOrders,
        salesGrowth: Math.round(salesGrowth),
      },
      alerts: {
        lowStockCount: lowStockData,
        outOfStockCount: outOfStockData,
        lowStockProducts: lowStockProductsList,
        hasCriticalAlerts: lowStockData > 0 || outOfStockData > 0
      },
      recentActivities,
      recentNotifications: recentNotifications.map(notif => ({
        ...notif,
        isNew: !notif.isRead && new Date(notif.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      })),
      insights: {
        topCategory: topCategory[0] || null,
        averageOrderValue: todayInvoices > 0 ? Math.round(todaySales / todayInvoices) : 0
      }
    });
  } catch (error) {
    console.error('DASHBOARD STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET SALES CHART DATA ====================
export const getSalesChartData = async (req, res, next) => {
  try {
    const { days = 30, includeCancelled = 'false' } = req.query;
    const numDays = Math.min(365, Math.max(1, parseInt(days) || 30)); // ✅ FIX 10: Limit days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays);
    startDate.setHours(0, 0, 0, 0);

    const matchCondition = {
      createdAt: { $gte: startDate },
    };
    
    if (includeCancelled !== 'true') {
      matchCondition.status = { $ne: 'cancelled' };
    }

    const salesData = await Invoice.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          totalSales: { $sum: '$totalAmount' },
          count: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' } // ✅ FIX 11: Add average
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ✅ FIX 12: Fill missing dates with zeros
    const dateMap = new Map();
    salesData.forEach(item => {
      dateMap.set(item._id, item);
    });

    const filledData = [];
    for (let i = 0; i < numDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (dateMap.has(dateStr)) {
        filledData.push(dateMap.get(dateStr));
      } else {
        filledData.push({
          _id: dateStr,
          totalSales: 0,
          count: 0,
          averageOrderValue: 0
        });
      }
    }

    // ✅ FIX 13: Calculate totals
    const totals = {
      totalSales: filledData.reduce((sum, day) => sum + day.totalSales, 0),
      totalOrders: filledData.reduce((sum, day) => sum + day.count, 0),
      averageDailySales: Math.round(filledData.reduce((sum, day) => sum + day.totalSales, 0) / numDays)
    };

    res.status(200).json({
      success: true,
      data: filledData,
      summary: totals,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        days: numDays
      }
    });
  } catch (error) {
    console.error('SALES CHART ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales chart data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET REVENUE CHART DATA ====================
export const getRevenueChartData = async (req, res, next) => {
  try {
    const { months = 12 } = req.query;
    const numMonths = Math.min(24, Math.max(1, parseInt(months) || 12));

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - numMonths);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const revenueData = await Invoice.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate }, 
          status: { $ne: 'cancelled' } 
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' },
          },
          totalRevenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
          // ✅ FIX 14: Add profit calculation (if cost price exists)
          totalCost: { 
            $sum: {
              $sum: {
                $map: {
                  input: '$items',
                  as: 'item',
                  in: { $multiply: ['$$item.quantity', '$$item.costPrice'] }
                }
              }
            }
          }
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ✅ FIX 15: Calculate profit
    const enhancedData = revenueData.map(month => ({
      ...month,
      profit: month.totalRevenue - (month.totalCost || 0),
      margin: month.totalRevenue > 0 
        ? ((month.totalRevenue - (month.totalCost || 0)) / month.totalRevenue * 100).toFixed(2)
        : 0
    }));

    res.status(200).json({
      success: true,
      data: enhancedData,
      summary: {
        totalRevenue: enhancedData.reduce((sum, m) => sum + m.totalRevenue, 0),
        totalProfit: enhancedData.reduce((sum, m) => sum + m.profit, 0),
        averageMargin: enhancedData.length > 0 
          ? (enhancedData.reduce((sum, m) => sum + parseFloat(m.margin), 0) / enhancedData.length).toFixed(2)
          : 0
      }
    });
  } catch (error) {
    console.error('REVENUE CHART ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue chart data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET INVENTORY CHART DATA ====================
export const getInventoryChartData = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const maxLimit = Math.min(20, parseInt(limit) || 10);

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
        $match: {
          'products.status': 'active' // ✅ FIX 16: Only active products
        }
      },
      {
        $project: {
          name: 1,
          totalQuantity: { $sum: '$products.quantity' },
          productCount: {
            $size: {
              $filter: {
                input: '$products',
                as: 'p',
                cond: { $eq: ['$$p.status', 'active'] }
              }
            }
          },
          totalValue: {
            $sum: {
              $map: {
                input: '$products',
                as: 'product',
                in: {
                  $multiply: ['$$product.quantity', '$$product.sellingPrice']
                }
              }
            }
          }
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: maxLimit },
    ]);

    // ✅ FIX 17: Calculate percentages
    const grandTotal = inventoryData.reduce((sum, cat) => sum + cat.totalValue, 0);
    
    const enhancedData = inventoryData.map(cat => ({
      ...cat,
      percentage: grandTotal > 0 ? ((cat.totalValue / grandTotal) * 100).toFixed(2) : 0,
      averageValuePerProduct: cat.productCount > 0 ? Math.round(cat.totalValue / cat.productCount) : 0
    }));

    res.status(200).json({
      success: true,
      data: enhancedData,
      summary: {
        totalCategories: inventoryData.length,
        totalInventoryValue: Math.round(grandTotal),
        totalProducts: inventoryData.reduce((sum, cat) => sum + cat.productCount, 0)
      }
    });
  } catch (error) {
    console.error('INVENTORY CHART ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory chart data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET TOP SELLING PRODUCTS ====================
export const getTopSellingProducts = async (req, res, next) => {
  try {
    const { limit = 10, period = 'all' } = req.query;
    const maxLimit = Math.min(50, parseInt(limit) || 10);
    
    // ✅ FIX 18: Add time period filter
    let dateFilter = {};
    if (period !== 'all') {
      const startDate = new Date();
      if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (period === 'year') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }
      startDate.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startDate } };
    }

    const topProducts = await Invoice.aggregate([
      { $match: { status: { $ne: 'cancelled' }, ...dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
          totalCost: { $sum: { $multiply: ['$items.quantity', '$items.costPrice'] } },
          numberOfTransactions: { $sum: 1 }
        },
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: maxLimit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      {
        $unwind: '$product'
      },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          productSku: '$product.sku',
          currentStock: '$product.quantity',
          sellingPrice: '$product.sellingPrice',
          totalQuantitySold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalProfit: { $round: [{ $subtract: ['$totalRevenue', '$totalCost'] }, 2] },
          profitMargin: {
            $round: [
              {
                $multiply: [
                  { $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] },
                  100
                ]
              },
              2
            ]
          },
          numberOfTransactions: 1
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: topProducts,
      summary: {
        totalProducts: topProducts.length,
        totalRevenue: topProducts.reduce((sum, p) => sum + p.totalRevenue, 0),
        totalProfit: topProducts.reduce((sum, p) => sum + p.totalProfit, 0),
        period: period === 'all' ? 'All time' : `Last ${period}`
      }
    });
  } catch (error) {
    console.error('TOP PRODUCTS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top selling products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET CATEGORY STATS ====================
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
        $match: {
          'products.status': 'active'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          status: 1,
          productCount: {
            $size: {
              $filter: {
                input: '$products',
                as: 'p',
                cond: { $eq: ['$$p.status', 'active'] }
              }
            }
          },
          totalValue: {
            $round: [{
              $sum: {
                $map: {
                  input: '$products',
                  as: 'product',
                  in: {
                    $multiply: ['$$product.quantity', '$$product.sellingPrice']
                  }
                }
              }
            }, 2]
          },
          totalQuantity: { $sum: '$products.quantity' },
          // ✅ FIX 19: Add low stock products count per category
          lowStockCount: {
            $size: {
              $filter: {
                input: '$products',
                as: 'product',
                cond: {
                  $and: [
                    { $lte: ['$$product.quantity', '$$product.minimumStock'] },
                    { $gt: ['$$product.quantity', 0] }
                  ]
                }
              }
            }
          },
          outOfStockCount: {
            $size: {
              $filter: {
                input: '$products',
                as: 'product',
                cond: { $eq: ['$$product.quantity', 0] }
              }
            }
          }
        },
      },
      { $sort: { totalValue: -1 } },
    ]);

    const totalInventoryValue = categoryStats.reduce((sum, cat) => sum + cat.totalValue, 0);
    const totalProducts = categoryStats.reduce((sum, cat) => sum + cat.productCount, 0);

    res.status(200).json({
      success: true,
      data: categoryStats,
      summary: {
        totalCategories: categoryStats.length,
        totalProducts,
        totalInventoryValue: Math.round(totalInventoryValue),
        activeCategories: categoryStats.filter(c => c.status === 'active').length
      }
    });
  } catch (error) {
    console.error('CATEGORY STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET RECENT ACTIVITIES (NEW) ====================
export const getRecentActivities = async (req, res, next) => {
  try {
    const { limit = 20, type } = req.query;
    const maxLimit = Math.min(100, parseInt(limit) || 20);

    let filter = {};
    if (type && ['sale', 'purchase', 'adjustment'].includes(type)) {
      filter.type = type;
    }

    const activities = await Inventory.find(filter)
      .populate('product', 'name sku sellingPrice')
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(maxLimit)
      .lean();

    // Group activities by date
    const groupedActivities = activities.reduce((acc, activity) => {
      const date = activity.createdAt.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: activities,
      grouped: groupedActivities,
      total: activities.length
    });
  } catch (error) {
    console.error('RECENT ACTIVITIES ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};