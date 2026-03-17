import { useEffect, useState } from 'react';
import { CreditCard, RefreshCw, TrendingUp, DollarSign, Users } from 'lucide-react';
import axios from 'axios';

interface GrowPayment {
  _id: string;
  asmachta: string;
  cardSuffix: string;
  cardBrand: string;
  status: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  products: any[];
  createdAt: string;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<GrowPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/orders/grow-payments');
      setPayments(data.payments || []);
    } catch {
      setError('שגיאה בטעינת תשלומים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalRevenue = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.totalAmount, 0);
  const commission = Math.round(totalRevenue * 0.015);

  return (
    <div dir="rtl" className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard size={24} className="text-green-600" />
          תשלומים — Grow
        </h1>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 text-sm font-medium border-0 cursor-pointer">
          <RefreshCw size={16} />רענן
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign size={20} className="text-green-600" />
            <span className="text-sm text-gray-500">סה"כ מכירות</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">₪{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={20} className="text-blue-600" />
            <span className="text-sm text-gray-500">עמלת BuyPower (1.5%)</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">₪{commission.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="text-purple-600" />
            <span className="text-sm text-gray-500">סה"כ עסקאות</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{payments.length}</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">טוען...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <CreditCard size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400">אין תשלומים עדיין</p>
          <p className="text-sm text-gray-300 mt-1">תשלומים יופיעו כאן לאחר ביצוע עסקה ב-Grow</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-right p-4 font-semibold text-gray-600">תאריך</th>
                <th className="text-right p-4 font-semibold text-gray-600">לקוח</th>
                <th className="text-right p-4 font-semibold text-gray-600">טלפון</th>
                <th className="text-right p-4 font-semibold text-gray-600">סכום</th>
                <th className="text-right p-4 font-semibold text-gray-600">עמלה (1.5%)</th>
                <th className="text-right p-4 font-semibold text-gray-600">כרטיס</th>
                <th className="text-right p-4 font-semibold text-gray-600">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="p-4 text-gray-500">{new Date(p.createdAt).toLocaleDateString('he-IL')}</td>
                  <td className="p-4 font-medium text-gray-900">{p.customerName || '—'}</td>
                  <td className="p-4 text-gray-500" dir="ltr">{p.customerPhone || '—'}</td>
                  <td className="p-4 font-bold text-green-600">₪{p.totalAmount?.toLocaleString()}</td>
                  <td className="p-4 font-semibold text-blue-600">₪{Math.round((p.totalAmount || 0) * 0.015)}</td>
                  <td className="p-4 text-gray-500" dir="ltr">{p.cardBrand} *{p.cardSuffix}</td>
                  <td className="p-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status === 'paid' ? '✓ שולם' : p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
