import { useState, useEffect } from 'react';
import { notificationAPI } from '../services/api.js';
import { Button, Card, Pagination } from '../components/UI.jsx';
import { 
  Trash2, 
  CheckCircle, 
  Bell, 
  Inbox, 
  MailOpen, 
  Mail,
  Archive,
  Sparkles,
  X,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [selectMode, setSelectMode] = useState(false);

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
        toast.success('Marked as read');
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
        toast.success('All notifications marked as read ✨');
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
        setSelectedNotifications(selectedNotifications.filter(nid => nid !== id));
      }
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.length === 0) return;
    
    if (window.confirm(`Delete ${selectedNotifications.length} notification(s)?`)) {
      try {
        await Promise.all(selectedNotifications.map(id => notificationAPI.deleteNotification(id)));
        toast.success(`${selectedNotifications.length} notification(s) deleted`);
        fetchNotifications();
        setSelectedNotifications([]);
        setSelectMode(false);
      } catch (err) {
        toast.error('Failed to delete notifications');
      }
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('⚠️ Are you sure you want to delete ALL notifications? This action cannot be undone.')) {
      try {
        const { data } = await notificationAPI.deleteAllNotifications();
        if (data.success) {
          toast.success('All notifications cleared');
          fetchNotifications();
        }
      } catch (err) {
        toast.error('Failed to delete notifications');
      }
    }
  };

  const toggleSelectNotification = (id) => {
    setSelectedNotifications(prev => 
      prev.includes(id) ? prev.filter(nid => nid !== id) : [...prev, id]
    );
  };

  const getNotificationIcon = (type) => {
    if (type.includes('stock')) return '📦';
    if (type.includes('invoice')) return '📄';
    if (type.includes('product')) return '🛍️';
    if (type.includes('warning')) return '⚠️';
    if (type.includes('success')) return '✅';
    return '🔔';
  };

  const getNotificationGradient = (type, isRead) => {
    if (isRead) return 'from-dark-800 to-dark-900';
    
    if (type === 'out_of_stock') return 'from-red-900/30 to-red-950/20 border-l-red-500';
    if (type === 'low_stock') return 'from-yellow-900/30 to-yellow-950/20 border-l-yellow-500';
    if (type === 'invoice_generated') return 'from-green-900/30 to-green-950/20 border-l-green-500';
    return 'from-blue-900/30 to-blue-950/20 border-l-blue-500';
  };

  const getFilterIcon = (filterName) => {
    switch(filterName) {
      case 'all': return <Bell size={16} />;
      case 'unread': return <Mail size={16} />;
      case 'read': return <MailOpen size={16} />;
      default: return <Bell size={16} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-600/20 via-primary-500/10 to-transparent border-b border-primary-500/20">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="relative px-6 py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg shadow-primary-500/25">
                  <Bell className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-primary-200 bg-clip-text text-transparent">
                    Notifications
                  </h1>
                  {unreadCount > 0 && (
                    <p className="text-dark-300 mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles size={14} className="text-primary-400" />
                        You have 
                        <span className="text-primary-400 font-bold text-lg">{unreadCount}</span>
                        unread notification{unreadCount !== 1 && 's'}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                {selectMode && selectedNotifications.length > 0 && (
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={handleBulkDelete}
                    className="shadow-lg"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete ({selectedNotifications.length})
                  </Button>
                )}
                {unreadCount > 0 && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="bg-dark-700/50 backdrop-blur-sm border-primary-500/30 hover:bg-primary-500/20 shadow-lg"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Mark All Read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={handleDeleteAll}
                    className="shadow-lg"
                  >
                    <Archive size={16} className="mr-2" />
                    Clear All
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectMode(!selectMode);
                    setSelectedNotifications([]);
                  }}
                  className={`bg-dark-700/50 backdrop-blur-sm shadow-lg ${selectMode ? 'bg-primary-500/20 border-primary-500' : ''}`}
                >
                  {selectMode ? <X size={16} className="mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                  {selectMode ? 'Cancel' : 'Select'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Filters - Modern Design */}
          <Card className="mb-8 p-2 bg-dark-800/50 backdrop-blur-sm border-dark-700 shadow-xl">
            <div className="flex gap-2 flex-wrap">
              {['all', 'unread', 'read'].map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => {
                    setFilter(filterOption);
                    setCurrentPage(1);
                    setSelectMode(false);
                    setSelectedNotifications([]);
                  }}
                  className={`
                    relative px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300
                    flex items-center gap-2
                    ${filter === filterOption 
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 scale-105' 
                      : 'text-dark-300 hover:text-white hover:bg-dark-700/50'
                    }
                  `}
                >
                  {getFilterIcon(filterOption)}
                  <span className="capitalize">{filterOption}</span>
                  {filterOption === 'unread' && unreadCount > 0 && filter !== filterOption && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-500/20 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Notifications List */}
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="relative overflow-hidden">
                    <div className="h-28 bg-dark-800/50 rounded-xl border border-dark-700 animate-pulse">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-dark-700/50 to-transparent animate-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <Card className="text-center py-16 bg-dark-800/30 backdrop-blur-sm border-dark-700">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-dark-700/50 rounded-full">
                    <Inbox size={48} className="text-dark-500" />
                  </div>
                  <div>
                    <p className="text-dark-400 text-lg">No notifications</p>
                    <p className="text-dark-500 text-sm mt-1">You're all caught up! 🎉</p>
                  </div>
                </div>
              </Card>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`
                    group relative transition-all duration-300 transform hover:scale-[1.01]
                    ${!notification.isRead ? 'animate-slideIn' : ''}
                  `}
                >
                  <div className={`
                    absolute inset-0 bg-gradient-to-r rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300
                    ${getNotificationGradient(notification.type, notification.isRead)}
                  `} />
                  
                  <Card className={`
                    relative bg-dark-800/80 backdrop-blur-sm border-l-4 overflow-hidden
                    ${!notification.isRead 
                      ? 'border-l-primary-500 bg-gradient-to-r' 
                      : 'border-l-dark-600 bg-dark-800/40'
                    }
                    ${getNotificationGradient(notification.type, notification.isRead)}
                    transition-all duration-300 hover:shadow-2xl
                  `}>
                    <div className="flex items-start p-5 gap-4">
                      {/* Checkbox for select mode */}
                      {selectMode && (
                        <div className="flex-shrink-0 pt-1">
                          <input
                            type="checkbox"
                            checked={selectedNotifications.includes(notification._id)}
                            onChange={() => toggleSelectNotification(notification._id)}
                            className="w-5 h-5 rounded border-dark-600 bg-dark-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
                          />
                        </div>
                      )}
                      
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                          ${!notification.isRead ? 'bg-primary-500/20 shadow-lg shadow-primary-500/10' : 'bg-dark-700/50'}
                        `}>
                          {getNotificationIcon(notification.type)}
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          <h3 className={`font-semibold text-lg ${!notification.isRead ? 'text-white' : 'text-dark-200'}`}>
                            {notification.title}
                          </h3>
                          <div className="flex gap-2">
                            <span className={`
                              px-2 py-0.5 text-xs font-medium rounded-full
                              ${notification.type === 'out_of_stock' ? 'bg-red-500/20 text-red-300' : ''}
                              ${notification.type === 'low_stock' ? 'bg-yellow-500/20 text-yellow-300' : ''}
                              ${notification.type === 'invoice_generated' ? 'bg-green-500/20 text-green-300' : ''}
                              ${notification.type === 'product_added' ? 'bg-blue-500/20 text-blue-300' : ''}
                            `}>
                              {notification.type.replace(/_/g, ' ')}
                            </span>
                            {!notification.isRead && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-500/20 text-primary-300 animate-pulse">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-dark-300 text-sm mb-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="text-dark-500 text-xs flex items-center gap-1">
                          <span>{new Date(notification.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{new Date(notification.createdAt).toLocaleTimeString()}</span>
                        </p>
                      </div>
                      
                      {/* Actions */}
                      {!selectMode && (
                        <div className="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification._id)}
                              className="p-2 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 hover:text-primary-300 transition-all duration-200 hover:scale-110"
                              title="Mark as read"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification._id)}
                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all duration-200 hover:scale-110"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-dark-500" />
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage}
                className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default Notifications;