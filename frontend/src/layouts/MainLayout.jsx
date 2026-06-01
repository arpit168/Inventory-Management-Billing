import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Menu, X, LogOut, Bell, Settings } from 'lucide-react';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Products', href: '/products', icon: '📦' },
    { label: 'Categories', href: '/categories', icon: '🏷️' },
    { label: 'Invoices', href: '/invoices', icon: '📄' },
    { label: 'Inventory', href: '/inventory', icon: '📈' },
    { label: 'Notifications', href: '/notifications', icon: '🔔' },
  ];

  const isActive = (href) => location.pathname === href;

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="flex h-screen bg-dark-900">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-dark-800 border-r border-dark-700 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-dark-700">
          <h1 className={`font-bold text-primary-400 ${sidebarOpen ? 'text-xl' : 'text-lg'}`}>
            {sidebarOpen ? 'Inventory' : 'I'}
          </h1>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-300 hover:bg-dark-700'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 space-y-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 text-dark-300 hover:bg-dark-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-dark-800 border-b border-dark-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {menuItems.find(item => isActive(item.href))?.label || 'Dashboard'}
          </h2>

          <div className="flex items-center gap-4">
            {/* Notifications Bell */}
            <button className="relative text-dark-300 hover:text-white transition">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-error text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                3
              </span>
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-3 pl-4 border-l border-dark-700">
              <div className="text-right">
                <p className="text-sm font-medium">{user?.fullName}</p>
                <p className="text-xs text-dark-400">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-dark-300 hover:text-error transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
