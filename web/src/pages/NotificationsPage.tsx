import { useEffect, useState } from 'react';
import { notificationsAPI } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Bell, Check, TrendingDown, Clock, Users, ShoppingCart, AlertCircle, MessageSquare } from 'lucide-react';

const typeIcons: Record<string, any> = {
  price_drop: TrendingDown,
  closing_soon: Clock,
  spots_left: Users,
  new_purchase: ShoppingCart,
  demand: MessageSquare,
  purchase_closed: Check,
};

const typeColors: Record<string, string> = {
  price_drop: 'bg-accent-50 text-accent-600',
  closing_soon: 'bg-orange-50 text-orange-600',
  spots_left: 'bg-purple-50 text-purple-600',
  new_purchase: 'bg-primary-50 text-primary-600',
  demand: 'bg-blue-50 text-blue-600',
  purchase_closed: 'bg-teal-50 text-teal-600',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await notificationsAPI.getAll({ limit: 50 });
      setNotifications(data.notifications || data);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(notifications.map((n) => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    const diffDays = Math.floor(diffHours / 24);
    return `לפני ${diffDays} ימים`;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">התראות</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unreadCount} התראות שלא נקראו</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-primary-600 text-sm font-medium hover:text-primary-700 bg-transparent border-0 cursor-pointer"
          >
            <Check size={16} />
            סמן הכל כנקרא
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Bell size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">אין התראות</h3>
          <p className="text-sm text-gray-400 mt-1">כשיהיו עדכונים חדשים, הם יופיעו כאן</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif: any) => {
            const Icon = typeIcons[notif.type] || AlertCircle;
            const colorClass = typeColors[notif.type] || 'bg-gray-50 text-gray-600';
            return (
              <div
                key={notif._id}
                onClick={() => !notif.isRead && markRead(notif._id)}
                className={`bg-white rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition hover:shadow-sm ${
                  notif.isRead ? 'border-gray-100 opacity-70' : 'border-primary-200 bg-primary-50/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{notif.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{formatDate(notif.createdAt)}</p>
                </div>
                {!notif.isRead && (
                  <div className="w-2.5 h-2.5 bg-primary-500 rounded-full flex-shrink-0 mt-1" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
