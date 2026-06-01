import { useState, useEffect } from 'react';
import { notificationAPI } from '../services/api.js';
import { Button, Card, Badge, Pagination } from '../components/UI.jsx';
import { Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [currentPage, filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = { page: currentPage, limit: 20 };
      if (filter !== 'all') {
        params.isRead = filter === 'read';
      }

      const { data } = await notificationAPI.getNotifications(params);
      if (data.success) {
        setNotifications(data.notifications);
        setTotalPages(data.pagination.pages);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      toast.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const { data } = await notificationAPI.getUnreadCount();
      if (data.success) {
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch unread count');
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      const { data } = await notificationAPI.markAsRead(id);
      if (data.success) {
        fetchNotifications();
      }
    } catch (err) {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { data } = await notificationAPI.markAllAsRead();
      if (data.success) {
        toast.success('All notifications marked as read');
        fetchNotifications();
      }
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (id) => {
    try {
      const { data } = await notificationAPI.deleteNotification(id);
      if (data.success) {
        toast.success('Notification deleted');
        fetchNotifications();
      }
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete all notifications?')) {
      try {
        const { data } = await notificationAPI.deleteAllNotifications();
        if (data.success) {
          toast.success('All notifications deleted');
          fetchNotifications();
        }
      } catch (err) {
        toast.error('Failed to delete notifications');
      }
    }
  };

  const getNotificationIcon = (type) => {
    if (type.includes('stock')) return '📦';
    if (type.includes('invoice')) return '📄';
    if (type.includes('product')) return '🛍️';
    return '🔔';
  };

  const getNotificationColor = (type) => {
    if (type === 'out_of_stock') return 'error';
    if (type === 'low_stock') return 'warning';
    if (type === 'invoice_generated') return 'success';
    return 'info';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-dark-400 mt-2">
              You have <span className="text-primary-400 font-semibold">{unreadCount}</span> unread notifications
            </p>
          )}
        </div>
        <div className="space-x-2">
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={handleMarkAllAsRead}>
              Mark All as Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="danger" size="sm" onClick={handleDeleteAll}>
              Delete All
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setFilter('all');
            setCurrentPage(1);
          }}
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setFilter('unread');
            setCurrentPage(1);
          }}
        >
          Unread
        </Button>
        <Button
          variant={filter === 'read' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setFilter('read');
            setCurrentPage(1);
          }}
        >
          Read
        </Button>
      </Card>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-dark-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-dark-400 text-lg">No notifications</p>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification._id}
              className={`flex items-start justify-between p-4 ${!notification.isRead ? 'bg-dark-700' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                  <h3 className="font-semibold">{notification.title}</h3>
                  <Badge variant={getNotificationColor(notification.type)}>
                    {notification.type.replace('_', ' ')}
                  </Badge>
                  {!notification.isRead && (
                    <Badge variant="primary">New</Badge>
                  )}
                </div>
                <p className="text-dark-300 text-sm mb-2">{notification.message}</p>
                <p className="text-dark-400 text-xs">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {!notification.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(notification._id)}
                    className="text-primary-400 hover:text-primary-300 transition"
                    title="Mark as read"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notification._id)}
                  className="text-error hover:text-red-400 transition"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </div>
  );
};

export default Notifications;
