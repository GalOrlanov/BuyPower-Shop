import { useEffect, useState } from 'react';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Building2, Search, Trash2, ShieldOff, ShieldCheck,
  BadgeCheck, Star, Package, TrendingUp, DollarSign
} from 'lucide-react';

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBusinesses = async (q = '') => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/businesses?search=${q}&limit=50`);
      setBusinesses(r.data.businesses);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBusinesses(); }, []);

  const handleBlock = async (id: string) => {
    setActionLoading(id + '_block');
    try {
      const r = await api.patch(`/admin/businesses/${id}/block`);
      setBusinesses(prev => prev.map(b => b._id === id ? { ...b, isBlocked: r.data.isBlocked } : b));
    } finally { setActionLoading(null); }
  };

  const handleVerify = async (id: string) => {
    setActionLoading(id + '_verify');
    try {
      const r = await api.patch(`/admin/businesses/${id}/verify`);
      setBusinesses(prev => prev.map(b => b._id === id ? { ...b, isVerified: r.data.isVerified } : b));
    } finally { setActionLoading(null); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`למחוק את "${name}" ואת כל המוצרים שלו לצמיתות?`)) return;
    setActionLoading(id + '_delete');
    try {
      await api.delete(`/admin/businesses/${id}`);
      setBusinesses(prev => prev.filter(b => b._id !== id));
    } finally { setActionLoading(null); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Building2 size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">ניהול עסקים</h1>
        <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{businesses.length}</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="חפש עסק..."
          value={search}
          onChange={e => { setSearch(e.target.value); fetchBusinesses(e.target.value); }}
          className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400"
        />
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-right">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">עסק</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">בעלים</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">מוצרים</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">דילים פעילים</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">הכנסות</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">דירוג</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">סטטוס</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {businesses.map(b => (
                  <tr key={b._id} className={`hover:bg-gray-50 transition ${b.isBlocked ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {b.logo ? (
                          <img src={b.logo} className="w-9 h-9 rounded-lg object-cover" alt="" />
                        ) : (
                          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Building2 size={16} className="text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{b.businessName}</div>
                          <div className="text-[11px] text-gray-400">{b.contactEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{b.userId?.firstName} {b.userId?.lastName}</div>
                      <div className="text-[11px] text-gray-400">{b.userId?.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Package size={13} /> {b.productCount || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <TrendingUp size={13} /> {b.activeDeals || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-700">
                      {b.totalRevenue > 0 ? `₪${b.totalRevenue.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star size={13} /> {b.rating?.toFixed(1) || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {b.isVerified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                            <BadgeCheck size={11} /> מאומת
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${b.isBlocked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                          {b.isBlocked ? '🔒 חסום' : '✅ פעיל'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBlock(b._id)}
                          disabled={actionLoading === b._id + '_block'}
                          title={b.isBlocked ? 'שחרר חסימה' : 'חסום עסק'}
                          className={`p-1.5 rounded-lg transition border-0 cursor-pointer ${b.isBlocked ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                        >
                          {b.isBlocked ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
                        </button>
                        <button
                          onClick={() => handleVerify(b._id)}
                          disabled={actionLoading === b._id + '_verify'}
                          title={b.isVerified ? 'הסר אימות' : 'אמת עסק'}
                          className={`p-1.5 rounded-lg transition border-0 cursor-pointer ${b.isVerified ? 'bg-gray-50 text-gray-500 hover:bg-gray-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                        >
                          <BadgeCheck size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(b._id, b.businessName)}
                          disabled={actionLoading === b._id + '_delete'}
                          title="מחק עסק לצמיתות"
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition border-0 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {businesses.length === 0 && (
              <div className="text-center py-12 text-gray-400">אין עסקים</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
