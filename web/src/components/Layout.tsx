import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import {
  ShoppingCart, Bell, User, LogOut, Menu, X, Home, Package,
  Users, MessageSquare, TrendingUp, BarChart3, PlusCircle, Settings, Heart, Shield
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [appVersion, setAppVersion] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  useEffect(() => {
    fetch('/api/versions/current').then(r => r.json()).then(d => setAppVersion(d.version?.version || '')).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/notifications?limit=1', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUnreadNotifications(d.unreadCount || 0))
      .catch(() => {});
  }, [user]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const userLinks = [
    { to: '/', label: 'דף הבית', icon: Home },
    { to: '/deals', label: 'קניות קבוצתיות', icon: ShoppingCart },
    { to: '/products', label: 'מוצרים', icon: Package },
    { to: '/my-purchases', label: 'הקניות שלי', icon: Heart },
    { to: '/requests', label: 'בקשות מוצרים', icon: MessageSquare },
  ];

  const businessLinks = [
    { to: '/', label: 'דף הבית', icon: Home },
    { to: '/business/dashboard', label: 'לוח בקרה', icon: BarChart3 },
    { to: '/business/products', label: 'המוצרים שלי', icon: Package },
    { to: '/business/new-product', label: 'מוצר חדש', icon: PlusCircle },
    { to: '/deals', label: 'קניות קבוצתיות', icon: ShoppingCart },
  ];

  const adminLinks = [
    { to: '/admin', label: 'ניהול', icon: Shield },
    { to: '/admin/businesses', label: 'עסקים', icon: Users },
    { to: '/admin/products', label: 'מוצרים', icon: Package },
    { to: '/deals', label: 'דילים', icon: ShoppingCart },
  ];

  const links = user?.role === 'admin' ? adminLinks : user?.role === 'business' ? businessLinks : userLinks;

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to Content - Accessibility */}
      <a href="#main-content" className="skip-to-content">דלג לתוכן הראשי</a>

      {/* Trust Banner */}
      <div className="bg-gradient-to-l from-emerald-600 to-emerald-500 text-white text-center py-2 px-4 text-xs sm:text-sm font-medium" role="banner" aria-label="מדיניות ביטחון">
        <span>🛡️ כל עסק נבדק ומאומת בקפידה לפני שמצטרף לפלטפורמה</span>
        <span className="mx-3 opacity-50">|</span>
        <span>💰 לא הגעתם למחיר היעד? הכסף חוזר במלואו — אוטומטית</span>
      </div>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Right side - Logo + mobile menu */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'סגור תפריט' : 'פתח תפריט'}
                aria-expanded={sidebarOpen}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <Link to="/" className="flex items-center gap-2 no-underline">
                <div className="w-9 h-9 bg-gradient-to-bl from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                  <ShoppingCart size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">BuyPower</h1>
                  <p className="text-[10px] text-gray-500 leading-tight -mt-0.5">קניות קבוצתיות חכמות</p>
                </div>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition no-underline ${
                    isActive(link.to)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <link.icon size={16} />
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Left side - Actions */}
            <div className="flex items-center gap-2">
              {/* Cart Icon */}
              <Link
                to="/cart"
                aria-label={`עגלת קניות${itemCount > 0 ? ` (${itemCount} פריטים)` : ''}`}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
              >
                <ShoppingCart size={20} />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>
              {user ? (
                <>
                  <Link
                    to="/notifications"
                    aria-label={`התראות${unreadNotifications > 0 ? ` (${unreadNotifications} חדשות)` : ''}`}
                    className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
                  >
                    <Bell size={20} />
                    {unreadNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </span>
                    )}
                  </Link>
                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen(!profileOpen)}
                      className="flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-gray-100 transition border-0 bg-transparent cursor-pointer"
                    >
                      <div className="w-8 h-8 bg-gradient-to-bl from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {user.firstName[0]}
                      </div>
                      <span className="hidden sm:block text-sm font-medium text-gray-700">
                        {user.firstName}
                      </span>
                    </button>
                    {profileOpen && (
                      <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                            {user.role === 'business' ? 'חשבון עסקי' : 'משתמש'}
                          </span>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 no-underline"
                        >
                          <Settings size={16} /> הגדרות פרופיל
                        </Link>
                        <button
                          onClick={() => { setProfileOpen(false); handleLogout(); }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-0 bg-transparent cursor-pointer text-right"
                        >
                          <LogOut size={16} /> התנתקות
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 no-underline"
                  >
                    התחברות
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition no-underline"
                  >
                    הרשמה
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="fixed inset-0 bg-black/30" />
          <div
            className="fixed top-16 right-0 w-64 h-[calc(100vh-4rem)] bg-white shadow-xl p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition no-underline ${
                    isActive(link.to)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <link.icon size={18} />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-bl from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                  <ShoppingCart size={16} className="text-white" />
                </div>
                <span className="font-bold text-gray-900">BuyPower</span>
              </div>
              <p className="text-sm text-gray-500">
                הפלטפורמה המובילה לקניות קבוצתיות בישראל. חוסכים יחד, מרוויחים יחד.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">קישורים</h3>
              <div className="flex flex-col gap-2">
                <Link to="/deals" className="text-sm text-gray-500 hover:text-primary-600 no-underline">קניות קבוצתיות</Link>
                <Link to="/products" className="text-sm text-gray-500 hover:text-primary-600 no-underline">מוצרים</Link>
                <Link to="/requests" className="text-sm text-gray-500 hover:text-primary-600 no-underline">בקשות מוצרים</Link>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">צור קשר</h3>
              <p className="text-sm text-gray-500">support@groupbuy.co.il</p>
              <p className="text-sm text-gray-500">1-800-GROUP-BUY</p>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-8 pt-6 text-center">
            <p className="text-sm text-gray-400">&copy; 2026 BuyPower. כל הזכויות שמורות.{appVersion && <span className="ml-2 text-xs text-gray-300">v{appVersion}</span>} &nbsp;·&nbsp; <a href="/accessibility.html" className="text-gray-400 hover:text-primary-600" style={{textDecoration:"none"}}>♿ הצהרת נגישות</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
