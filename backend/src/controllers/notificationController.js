import Notification from '../models/Notification.js';
import { validationResult } from 'express-validator';

// ==================== HELPER FUNCTIONS ====================
const validateObjectId = (id) => {
  return id && id.match(/^[0-9a-fA-F]{24}$/);
};

// ==================== GET NOTIFICATIONS ====================
export const getNotifications = async (req, res, next) => {
  try {
    let { 
      page = 1, 
      limit = 10, 
      isRead, 
      type, 
      priority,
      startDate, 
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = { recipient: req.userId };

    // ✅ FIX 1: Filter by read status
    if (isRead !== undefined && isRead !== '') {
      filter.isRead = isRead === 'true';
    }

    // ✅ FIX 2: Filter by notification type
    if (type) {
      const validTypes = [
        'low_stock', 'out_of_stock', 'product_added', 'product_updated', 
        'product_deleted', 'invoice_generated', 'invoice_status_changed',
        'invoice_cancelled', 'password_changed', 'user_registered', 
        'email_failed', 'stock_alert', 'system_notification'
      ];
      const types = type.split(',').filter(t => validTypes.includes(t));
      if (types.length) {
        filter.type = { $in: types };
      }
    }

    // ✅ FIX 3: Filter by priority
    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) {
      filter.priority = priority;
    }

    // ✅ FIX 4: Date range filter
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

    // Dynamic sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [notifications, total, unreadCount, stats] = await Promise.all([
      Notification.find(filter)
        .populate('relatedProduct', 'name sku sellingPrice quantity minimumStock')
        .populate('relatedInvoice', 'invoiceNumber totalAmount status')
        .populate('relatedUser', 'fullName email')
        .skip(skip)
        .limit(limitNum)
        .sort(sortOptions)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.userId, isRead: false }),
      Notification.aggregate([
        { $match: { recipient: req.userId, isRead: false } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);

    // ✅ FIX 5: Format priority counts
    const priorityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    stats.forEach(stat => {
      if (stat._id && priorityCounts.hasOwnProperty(stat._id)) {
        priorityCounts[stat._id] = stat.count;
      }
    });

    const pages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      priorityCounts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages,
        hasNextPage: pageNum < pages,
        hasPrevPage: pageNum > 1
      },
      filters: { isRead, type, priority, startDate, endDate }
    });
  } catch (error) {
    console.error('GET NOTIFICATIONS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== MARK AS READ ====================
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
    }

    // ✅ FIX 6: Verify ownership
    const notification = await Notification.findOne({
      _id: id,
      recipient: req.userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    // ✅ FIX 7: Don't update if already read
    if (notification.isRead) {
      return res.status(200).json({
        success: true,
        message: 'Notification already marked as read',
        notification
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    // Get updated unread count
    const unreadCount = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
      unreadCount
    });
  } catch (error) {
    console.error('MARK AS READ ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== MARK ALL AS READ ====================
export const markAllAsRead = async (req, res, next) => {
  try {
    const { type, priority } = req.query;

    const filter = { recipient: req.userId, isRead: false };

    // ✅ FIX 8: Filter by type or priority
    if (type) {
      const validTypes = [
        'low_stock', 'out_of_stock', 'product_added', 'product_updated',
        'product_deleted', 'invoice_generated', 'invoice_status_changed',
        'invoice_cancelled', 'password_changed', 'user_registered',
        'email_failed', 'stock_alert', 'system_notification'
      ];
      if (validTypes.includes(type)) {
        filter.type = type;
      }
    }

    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) {
      filter.priority = priority;
    }

    const result = await Notification.updateMany(
      filter,
      { isRead: true, readAt: new Date() }
    );

    const unreadCount = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read`,
      modifiedCount: result.modifiedCount,
      unreadCount
    });
  } catch (error) {
    console.error('MARK ALL AS READ ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== DELETE NOTIFICATION ====================
export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
    }

    // ✅ FIX 9: Verify ownership before deletion
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      unreadCount
    });
  } catch (error) {
    console.error('DELETE NOTIFICATION ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET UNREAD COUNT ====================
export const getUnreadCount = async (req, res, next) => {
  try {
    const { type, priority } = req.query;

    const filter = { recipient: req.userId, isRead: false };

    if (type) {
      const validTypes = [
        'low_stock', 'out_of_stock', 'product_added', 'product_updated',
        'product_deleted', 'invoice_generated', 'invoice_status_changed',
        'invoice_cancelled', 'password_changed', 'user_registered',
        'email_failed', 'stock_alert', 'system_notification'
      ];
      if (validTypes.includes(type)) {
        filter.type = type;
      }
    }

    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) {
      filter.priority = priority;
    }

    const [unreadCount, priorityCounts] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.aggregate([
        { $match: { recipient: req.userId, isRead: false } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);

    const counts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    priorityCounts.forEach(stat => {
      if (stat._id && counts.hasOwnProperty(stat._id)) {
        counts[stat._id] = stat.count;
      }
    });

    res.status(200).json({
      success: true,
      unreadCount,
      priorityCounts: counts,
      hasUnread: unreadCount > 0
    });
  } catch (error) {
    console.error('GET UNREAD COUNT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== DELETE ALL NOTIFICATIONS ====================
export const deleteAllNotifications = async (req, res, next) => {
  try {
    const { type, isRead, olderThan } = req.query;

    const filter = { recipient: req.userId };

    // ✅ FIX 10: Filter by type
    if (type) {
      const validTypes = [
        'low_stock', 'out_of_stock', 'product_added', 'product_updated',
        'product_deleted', 'invoice_generated', 'invoice_status_changed',
        'invoice_cancelled', 'password_changed', 'user_registered',
        'email_failed', 'stock_alert', 'system_notification'
      ];
      if (validTypes.includes(type)) {
        filter.type = type;
      }
    }

    // ✅ FIX 11: Filter by read status
    if (isRead !== undefined && isRead !== '') {
      filter.isRead = isRead === 'true';
    }

    // ✅ FIX 12: Delete older than specified days
    if (olderThan) {
      const days = parseInt(olderThan);
      if (!isNaN(days) && days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        filter.createdAt = { $lt: cutoffDate };
      }
    }

    const result = await Notification.deleteMany(filter);

    const remainingCount = await Notification.countDocuments({ recipient: req.userId });
    const unreadCount = await Notification.countDocuments({ recipient: req.userId, isRead: false });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} notification(s) deleted successfully`,
      deletedCount: result.deletedCount,
      remainingCount,
      unreadCount
    });
  } catch (error) {
    console.error('DELETE ALL NOTIFICATIONS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET NOTIFICATION STATS ====================
export const getNotificationStats = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;

    // Calculate date range
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

    const matchFilter = {
      recipient: req.userId,
      createdAt: { $gte: startDate, $lte: endDate }
    };

    // ✅ FIX 13: Enhanced stats with multiple aggregations
    const [
      typeStats,
      priorityStats,
      readStats,
      dailyStats,
      topProducts
    ] = await Promise.all([
      // Stats by type
      Notification.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Stats by priority
      Notification.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Read vs Unread stats
      Notification.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$isRead', count: { $sum: 1 } } }
      ]),
      
      // Daily notification trends
      Notification.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ]),
      
      // Top products generating notifications
      Notification.aggregate([
        { $match: { ...matchFilter, relatedProduct: { $exists: true, $ne: null } } },
        { $group: { _id: '$relatedProduct', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
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
        { $project: { productName: '$product.name', productSku: '$product.sku', notificationCount: '$count' } }
      ])
    ]);

    // Type mapping for better display
    const typeMap = {
      low_stock: 'Low Stock',
      out_of_stock: 'Out of Stock',
      product_added: 'Product Added',
      product_updated: 'Product Updated',
      product_deleted: 'Product Deleted',
      invoice_generated: 'Invoice Generated',
      invoice_status_changed: 'Invoice Status Changed',
      invoice_cancelled: 'Invoice Cancelled',
      password_changed: 'Password Changed',
      user_registered: 'User Registered',
      email_failed: 'Email Failed',
      stock_alert: 'Stock Alert',
      system_notification: 'System'
    };

    const formattedTypeStats = typeStats.map(stat => ({
      type: typeMap[stat._id] || stat._id,
      typeKey: stat._id,
      count: stat.count
    }));

    const readCount = readStats.find(s => s._id === true)?.count || 0;
    const unreadCount = readStats.find(s => s._id === false)?.count || 0;

    res.status(200).json({
      success: true,
      period,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      summary: {
        totalNotifications: formattedTypeStats.reduce((sum, s) => sum + s.count, 0),
        read: readCount,
        unread: unreadCount,
        readRate: readCount + unreadCount > 0 
          ? ((readCount / (readCount + unreadCount)) * 100).toFixed(2) 
          : 0
      },
      byType: formattedTypeStats,
      byPriority: priorityStats,
      dailyTrends: dailyStats,
      topAffectedProducts: topProducts
    });
  } catch (error) {
    console.error('NOTIFICATION STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== CREATE SYSTEM NOTIFICATION (NEW) ====================
export const createSystemNotification = async (req, res, next) => {
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
      title, 
      message, 
      type = 'system_notification', 
      priority = 'medium',
      recipients, // Array of user IDs or 'all'
      expiresAt
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    let recipientList = [];
    
    if (recipients === 'all') {
      // Get all active users (you'll need to import User model)
      const User = (await import('../models/User.js')).default;
      const users = await User.find({ status: 'active' }).select('_id');
      recipientList = users.map(u => u._id);
    } else if (Array.isArray(recipients) && recipients.length > 0) {
      recipientList = recipients;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please specify recipients or use "all"'
      });
    }

    const notifications = [];
    for (const recipientId of recipientList) {
      notifications.push({
        title,
        message,
        type,
        priority,
        recipient: recipientId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: req.userId
      });
    }

    const created = await Notification.insertMany(notifications);

    res.status(201).json({
      success: true,
      message: `${created.length} notification(s) created successfully`,
      count: created.length
    });
  } catch (error) {
    console.error('CREATE SYSTEM NOTIFICATION ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create system notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== GET NOTIFICATION BY ID (NEW) ====================
export const getNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
    }

    const notification = await Notification.findOne({
      _id: id,
      recipient: req.userId
    })
      .populate('relatedProduct', 'name sku sellingPrice quantity minimumStock')
      .populate('relatedInvoice', 'invoiceNumber totalAmount status paymentStatus')
      .populate('relatedUser', 'fullName email')
      .populate('createdBy', 'fullName email');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    // Auto-mark as read when viewed
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('GET NOTIFICATION BY ID ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ==================== CLEANUP EXPIRED NOTIFICATIONS (NEW) ====================
export const cleanupExpiredNotifications = async (req, res, next) => {
  try {
    // Only admins can run this
    const result = await Notification.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} expired notification(s) cleaned up`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('CLEANUP EXPIRED NOTIFICATIONS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup expired notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};