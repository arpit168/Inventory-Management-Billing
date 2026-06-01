import Notification from '../models/Notification.js';

export const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, isRead } = req.query;

    const filter = { recipient: req.userId };

    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
    }

    const skip = (page - 1) * limit;

    const notifications = await Notification.find(filter)
      .populate('relatedProduct', 'name sku')
      .populate('relatedInvoice', 'invoiceNumber totalAmount')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ recipient: req.userId, isRead: false });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message,
    });
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message,
    });
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message,
    });
  }
};

export const deleteAllNotifications = async (req, res, next) => {
  try {
    await Notification.deleteMany({ recipient: req.userId });

    res.status(200).json({
      success: true,
      message: 'All notifications deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
      error: error.message,
    });
  }
};

export const getNotificationStats = async (req, res, next) => {
  try {
    const stats = await Notification.aggregate([
      { $match: { recipient: req.userId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const typeMap = {
      low_stock: 'Low Stock',
      out_of_stock: 'Out of Stock',
      product_added: 'Product Added',
      product_updated: 'Product Updated',
      product_deleted: 'Product Deleted',
      invoice_generated: 'Invoice Generated',
      password_changed: 'Password Changed',
      user_registered: 'User Registered',
    };

    const formattedStats = stats.map(stat => ({
      type: typeMap[stat._id] || stat._id,
      count: stat.count,
    }));

    res.status(200).json({
      success: true,
      stats: formattedStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: error.message,
    });
  }
};
