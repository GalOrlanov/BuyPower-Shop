import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Users, Building2, Package, ShoppingCart, DollarSign,
  TrendingUp, CheckCircle2, XCircle, Shield, GitBranch, CreditCard
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(r => { setStats(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const kpis = [
    { label: 'סה"כ הכנסות', value: `₪${(stats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-green-50 text-green-600' },
    { label: 'עסקים רשומים', value: stats?.totalBusinesses || 0, icon: Building2, color: 'bg-blue-50 text-blue-600' },
    { label: 'עסקים חסומים', value: stats?.blockedBusinesses || 0, icon: XCircle, color: 'bg-red-50 text-red-600' },
    { label: 'משתמשים', value: stats?.totalUsers || 0, icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'מוצרים', value: stats?.totalProducts || 0, icon: Package, color: 'bg-amber-50 text-amber-600' },
    { label: 'דילים פעילים', value: stats?.activeDeals || 0, icon: TrendingUp, color: 'bg-teal-50 text-teal-600' },
    { label: 'דילים שהושלמו', value: stats?.completedDeals || 0, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'עסקאות', value: stats?.totalTransactions || 0, icon: ShoppingCart, color: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול מערכת</h1>
          <p className="text-gray-500 text-sm">BuyPower Admin Panel</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`w-10 h-10 ${k.color} rounded-lg flex items-center justify-center mb-3`}>
              <k.icon size={20} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{k.value}</div>
            <div className="text-xs text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/businesses" className="flex items-center gap-3 bg-white border border-gray-200 p-5 rounded-xl hover:bg-gray-50 transition no-underline">
          <Building2 size={24} className="text-blue-600" />
          <div>
            <div className="font-semibold text-gray-900">ניהול עסקים</div>
            <div className="text-sm text-gray-400">חסום, מחק, אמת עסקים</div>
          </div>
        </Link>
        <Link to="/admin/products" className="flex items-center gap-3 bg-white border border-gray-200 p-5 rounded-xl hover:bg-gray-50 transition no-underline">
          <Package size={24} className="text-amber-600" />
          <div>
            <div className="font-semibold text-gray-900">ניהול מוצרים</div>
            <div className="text-sm text-gray-400">הפעל, כבה, מחק מוצרים</div>
          </div>
        </Link>
        <Link to="/admin/users" className="flex items-center gap-3 bg-white border border-gray-200 p-5 rounded-xl hover:bg-gray-50 transition no-underline">
          <Users size={24} className="text-purple-600" />
          <div>
            <div className="font-semibold text-gray-900">ניהול משתמשים</div>
            <div className="text-sm text-gray-400">ראה את כל המשתמשים</div>
          </div>
        </Link>
        <Link to="/admin/payments" className="flex items-center gap-3 bg-white border border-gray-200 p-5 rounded-xl hover:bg-gray-50 transition no-underline">
          <CreditCard size={24} className="text-green-600" />
          <div>
            <div className="font-semibold text-gray-900">תשלומים (Grow)</div>
            <div className="text-sm text-gray-400">היסטוריית תשלומים, עמלות</div>
          </div>
        </Link>
        <Link to="/admin/versions" className="flex items-center gap-3 bg-white border border-gray-200 p-5 rounded-xl hover:bg-gray-50 transition no-underline">
          <GitBranch size={24} className="text-indigo-600" />
          <div>
            <div className="font-semibold text-gray-900">ניהול גרסאות</div>
            <div className="text-sm text-gray-400">גרסאות, changelog, revert</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
