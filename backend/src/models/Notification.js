import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'low_stock',
        'out_of_stock',
        'product_added',
        'product_updated',
        'product_deleted',
        'invoice_generated',
        'password_changed',
        'user_registered',
        'inventory_alert',
        'order_confirmed',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: [200, 'Title cannot be more than 200 characters'],
    },
    message: {
      type: String,
      required: true,
      maxlength: [500, 'Message cannot be more than 500 characters'],
    },
    icon: {
      type: String,
      default: null,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    relatedInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    actionUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Index for finding unread notifications
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
