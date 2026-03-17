import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { businessAPI } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import PickupPointsManager from '../components/PickupPointsManager';
import {
  Package, Eye, Users, ShoppingCart, TrendingUp, PlusCircle,
  DollarSign, BarChart3, Star, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Download, FileText, Filter
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderParticipant {
  _id: string;
  quantity: number;
  paymentStatus: string;
  joinedAt: string;
  totalPaid: number;
  user: { firstName: string; lastName: string; phone: string; email: string } | null;
}

interface Order {
  _id: string;
  status: string;
  currentPrice: number;
  participantCount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  totalQuantity: number;
  totalRevenue: number;
  product: { _id: string; name: string; category: string; originalPrice: number; images: string[] } | null;
  participants: OrderParticipant[];
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(orders: Order[]) {
  const rows: string[][] = [
    ['מוצר', 'שם לקוח', 'טלפון', 'אימייל', 'כמות', 'מחיר ליחידה', 'סה"כ שולם', 'סטטוס תשלום', 'תאריך הצטרפות', 'סטטוס קנייה'],
  ];

  for (const order of orders) {
    const productName = order.product?.name || '—';
    if (order.participants.length === 0) {
      rows.push([productName, '—', '—', '—', '0', String(order.currentPrice), '0', '—', '', order.status]);
    } else {
      for (const p of order.participants) {
        rows.push([
          productName,
          p.user ? `${p.user.firstName} ${p.user.lastName}` : '—',
          p.user?.phone || '—',
          p.user?.email || '—',
          String(p.quantity),
          String(order.currentPrice),
          String(p.totalPaid),
          p.paymentStatus,
          p.joinedAt ? new Date(p.joinedAt).toLocaleDateString('he-IL') : '',
          order.status,
        ]);
      }
    }
  }

  const bom = '\uFEFF'; // UTF-8 BOM for Hebrew in Excel
  const csv = bom + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `buypower-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportPDF(orders: Order[]) {
  const rows = orders.flatMap((order) => {
    const pName = order.product?.name || '—';
    if (order.participants.length === 0) {
      return `<tr><td>${pName}</td><td>—</td><td>—</td><td>0</td><td>₪${order.currentPrice}</td><td>₪0</td><td>—</td><td>${order.status}</td></tr>`;
    }
    return order.participants.map(
      (p) =>
        `<tr><td>${pName}</td><td>${p.user ? `${p.user.firstName} ${p.user.lastName}` : '—'}</td><td>${p.user?.phone || '—'}</td><td>${p.quantity}</td><td>₪${order.currentPrice}</td><td>₪${p.totalPaid}</td><td>${p.paymentStatus}</td><td>${order.status}</td></tr>`,
    );
  });

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8"/>
<title>BuyPower - דוח הזמנות</title>
<style>
  body { font-family: Arial, sans-serif; direction: rtl; font-size: 12px; }
  h1 { color: #15803d; font-size: 18px; margin-bottom: 4px; }
  p { color: #6b7280; font-size: 11px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #15803d; color: white; padding: 6px 8px; text-align: right; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  tr:nth-child(even) td { background: #f9fafb; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>BuyPower — דוח הזמנות</h1>
<p>הופק בתאריך: ${new Date().toLocaleDateString('he-IL')}</p>
<table>
<thead><tr><th>מוצר</th><th>שם לקוח</th><th>טלפון</th><th>כמות</th><th>מחיר ליח'</th><th>סה"כ שולם</th><th>סטטוס תשלום</th><th>סטטוס קנייה</th></tr></thead>
<tbody>${rows.join('')}</tbody>
</table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const statusLabel: Record<string, string> = {
  open: 'פעיל',
  closed: 'הושלם',
  cancelled: 'בוטל',
  waiting_for_demand: 'ממתין',
  in_negotiation: 'במשא ומתן',
};

const paymentStatusLabel: Record<string, string> = {
  pending: 'ממתין',
  paid: 'שולם',
  failed: 'נכשל',
  refunded: 'הוחזר',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function BusinessDashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Date filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  // Initial load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, productsRes, ordersRes] = await Promise.all([
          businessAPI.getAnalytics(),
          businessAPI.getProducts(),
          businessAPI.getOrders(),
        ]);
        setAnalytics(analyticsRes.data);
        setProducts(productsRes.data);
        setOrders(ordersRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Re-fetch orders when date filter changes
  const applyDateFilter = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const params: { from?: string; to?: string } = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await businessAPI.getOrders(params);
      setOrders(res.data);
      setAppliedFrom(dateFrom);
      setAppliedTo(dateTo);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  }, [dateFrom, dateTo]);

  const clearFilter = async () => {
    setDateFrom('');
    setDateTo('');
    setOrdersLoading(true);
    try {
      const res = await businessAPI.getOrders();
      setOrders(res.data);
      setAppliedFrom('');
      setAppliedTo('');
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const totalRevenue = analytics?.totalRevenue || 0;
  const totalSold = analytics?.totalSold || 0;
  const avgRating = analytics?.avgRating || 0;

  const kpis = [
    { label: 'סה"כ הכנסות', value: `₪${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'bg-green-50 text-green-600', border: 'border-green-100', sub: 'מכל הקניות הקבוצתיות' },
    { label: 'יחידות שנמכרו', value: totalSold.toLocaleString(), icon: ShoppingCart, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100', sub: 'סה"כ מכל המוצרים' },
    { label: 'קניות פעילות', value: analytics?.activeGroupPurchases || 0, icon: TrendingUp, color: 'bg-primary-50 text-primary-600', border: 'border-primary-100', sub: 'ממתינות למשתתפים' },
    { label: 'קניות שהושלמו', value: analytics?.closedDeals || 0, icon: CheckCircle2, color: 'bg-teal-50 text-teal-600', border: 'border-teal-100', sub: 'הושלמו בהצלחה' },
    { label: 'סה"כ משתתפים', value: analytics?.totalParticipants || 0, icon: Users, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100', sub: 'הצטרפו לקניות שלך' },
    { label: 'דירוג ממוצע', value: avgRating ? `${avgRating.toFixed(1)} ⭐` : '—', icon: Star, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100', sub: `מבוסס על ${analytics?.totalReviews || 0} ביקורות` },
    { label: 'צפיות', value: (analytics?.totalViews || 0).toLocaleString(), icon: Eye, color: 'bg-rose-50 text-rose-600', border: 'border-rose-100', sub: 'בכל המוצרים שלך' },
    { label: 'סה"כ מוצרים', value: analytics?.totalProducts || products.length, icon: Package, color: 'bg-gray-50 text-gray-600', border: 'border-gray-100', sub: `${products.filter((p) => p.isActive).length} פעילים` },
  ];

  const statusInfo = (product: any) => {
    if (!product.isActive) return { label: 'לא פעיל', color: 'bg-gray-100 text-gray-500', icon: XCircle };
    if (product.groupPurchaseStatus === 'active') return { label: 'קנייה פעילה', color: 'bg-green-50 text-green-700', icon: TrendingUp };
    if (product.groupPurchaseStatus === 'completed') return { label: 'הושלם', color: 'bg-teal-50 text-teal-700', icon: CheckCircle2 };
    return { label: 'פעיל', color: 'bg-blue-50 text-blue-700', icon: CheckCircle2 };
  };

  const productRevenue = (product: any) => {
    const sold = product.totalSold || 0;
    const price = product.currentPrice || product.originalPrice || 0;
    return sold * price;
  };

  const filterActive = appliedFrom || appliedTo;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
          <p className="text-gray-500 text-sm mt-1">סקירת ביצועי העסק שלך ב-BuyPower</p>
        </div>
        <Link
          to="/business/new-product"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition no-underline"
        >
          <PlusCircle size={16} />
          מוצר חדש
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`bg-white rounded-xl border ${kpi.border} p-4`}>
            <div className={`w-10 h-10 ${kpi.color} rounded-lg flex items-center justify-center mb-3`}>
              <kpi.icon size={20} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs font-medium text-gray-700 mt-1">{kpi.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Orders Section ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 mb-6">
        {/* Header row */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-green-700" />
              <h2 className="text-lg font-semibold text-gray-900">הזמנות ולקוחות</h2>
              {filterActive && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  מסונן
                </span>
              )}
            </div>
            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportCSV(orders)}
                disabled={orders.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Download size={14} />
                ייצא CSV
              </button>
              <button
                onClick={() => exportPDF(orders)}
                disabled={orders.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <FileText size={14} />
                ייצא PDF
              </button>
            </div>
          </div>

          {/* Date filter row */}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Filter size={14} />
              <span>סנן לפי תאריך:</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">מ-</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">עד-</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                dir="ltr"
              />
            </div>
            <button
              onClick={applyDateFilter}
              className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition cursor-pointer border-0"
            >
              חפש
            </button>
            {filterActive && (
              <button
                onClick={clearFilter}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition cursor-pointer border-0"
              >
                נקה סינון
              </button>
            )}
          </div>
        </div>

        {/* Orders list */}
        {ordersLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">טוען הזמנות...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingCart size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">
              {filterActive ? 'אין הזמנות בטווח התאריכים שנבחר' : 'אין הזמנות עדיין'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {orders.map((order) => {
              const isExpanded = expandedOrder === order._id;
              const statusColor =
                order.status === 'closed' ? 'bg-teal-50 text-teal-700' :
                order.status === 'open' ? 'bg-green-50 text-green-700' :
                'bg-gray-100 text-gray-500';

              return (
                <div key={order._id}>
                  {/* Order row */}
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order._id)}
                    className="w-full text-right px-4 py-3 hover:bg-gray-50 transition flex items-center gap-4 border-0 bg-transparent cursor-pointer"
                  >
                    {order.product?.images?.[0] && (
                      <img
                        src={order.product.images[0]}
                        alt={order.product.name}
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{order.product?.name || '—'}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('he-IL') : ''} — עד {order.endDate ? new Date(order.endDate).toLocaleDateString('he-IL') : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-xs text-gray-400">משתתפים</div>
                        <div className="font-semibold text-gray-800">{order.participantCount}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">מחיר</div>
                        <div className="font-semibold text-gray-800">₪{order.currentPrice?.toLocaleString()}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">הכנסה</div>
                        <div className="font-semibold text-green-700">₪{order.totalRevenue?.toLocaleString()}</div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor}`}>
                        {statusLabel[order.status] || order.status}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* ── Expanded: Customer Details ──────────────────────────── */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50">
                      {order.participants.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3 text-center">אין משתתפים עדיין</p>
                      ) : (
                        <>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-2">
                            פרטי לקוחות — {order.participants.length} משתתפים
                          </div>
                          <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <table className="w-full text-sm bg-white">
                              <thead>
                                <tr className="bg-gray-50 text-right">
                                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">שם</th>
                                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">טלפון</th>
                                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">כמות</th>
                                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">סה"כ שולם</th>
                                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">תשלום</th>
                                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">תאריך</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {order.participants.map((p) => (
                                  <tr key={p._id} className="hover:bg-gray-50 transition">
                                    <td className="px-3 py-2.5 font-medium text-gray-900">
                                      {p.user ? `${p.user.firstName} ${p.user.lastName}` : '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-600 font-mono text-xs" dir="ltr">
                                      {p.user?.phone || '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-700">{p.quantity}</td>
                                    <td className="px-3 py-2.5 font-semibold text-green-700">₪{p.totalPaid?.toLocaleString()}</td>
                                    <td className="px-3 py-2.5">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        p.paymentStatus === 'paid' ? 'bg-green-50 text-green-700' :
                                        p.paymentStatus === 'failed' ? 'bg-red-50 text-red-600' :
                                        'bg-yellow-50 text-yellow-700'
                                      }`}>
                                        {paymentStatusLabel[p.paymentStatus] || p.paymentStatus}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                                      {p.joinedAt ? new Date(p.joinedAt).toLocaleDateString('he-IL') : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-50 border-t border-gray-200">
                                  <td className="px-3 py-2 font-semibold text-gray-700" colSpan={2}>סה"כ</td>
                                  <td className="px-3 py-2 font-bold text-gray-900">
                                    {order.participants.reduce((s, p) => s + p.quantity, 0)}
                                  </td>
                                  <td className="px-3 py-2 font-bold text-green-700">
                                    ₪{order.totalRevenue?.toLocaleString()}
                                  </td>
                                  <td colSpan={2}></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pickup Points ────────────────────────────────────────────────────── */}
      <PickupPointsManager />

      {/* ── Products Table ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">המוצרים שלי</h2>
          </div>
          <span className="text-sm text-gray-500">{products.length} מוצרים</span>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-3">אין לך מוצרים עדיין</p>
            <Link
              to="/business/new-product"
              className="text-primary-600 font-medium text-sm hover:text-primary-700 no-underline"
            >
              הוסיפו מוצר ראשון
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-right">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">מוצר</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">מחיר רגיל</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">מחיר קבוצתי</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">נמכר</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">הכנסה</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">משתתפים</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">סטטוס</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((product: any) => {
                  const status = statusInfo(product);
                  const rev = productRevenue(product);
                  const discount =
                    product.originalPrice && product.currentPrice
                      ? Math.round((1 - product.currentPrice / product.originalPrice) * 100)
                      : 0;
                  return (
                    <tr key={product._id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80'}
                            alt={product.name}
                            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                          />
                          <div>
                            <div className="font-medium text-gray-900 truncate max-w-[140px]">{product.name}</div>
                            <div className="text-[11px] text-gray-400">{product.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">₪{product.originalPrice?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900 font-medium">
                          ₪{(product.currentPrice || product.originalPrice)?.toLocaleString()}
                        </div>
                        {discount > 0 && (
                          <div className="text-[11px] text-green-600 font-medium">-{discount}%</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{product.totalSold || 0}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">
                        {rev > 0 ? `₪${rev.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Users size={13} />
                          {product.currentParticipants || 0}
                          <span className="text-gray-400">/ {product.minParticipants || '∞'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                          <status.icon size={11} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/business/products/${product._id}/edit`}
                          className="text-primary-600 text-xs font-medium hover:text-primary-700 no-underline"
                        >
                          ערוך
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {products.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 font-semibold text-gray-700" colSpan={3}>
                      סה"כ
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {products.reduce((s, p) => s + (p.totalSold || 0), 0)}
                    </td>
                    <td className="px-4 py-3 font-bold text-green-700">
                      ₪{products.reduce((s, p) => s + productRevenue(p), 0).toLocaleString()}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/business/new-product"
          className="flex items-center gap-3 bg-primary-600 text-white p-4 rounded-xl hover:bg-primary-700 transition no-underline"
        >
          <PlusCircle size={22} />
          <div>
            <div className="font-semibold">הוסף מוצר חדש</div>
            <div className="text-primary-200 text-xs">פרסם מוצר לקנייה קבוצתית</div>
          </div>
        </Link>
        <Link
          to="/business/products"
          className="flex items-center gap-3 bg-white border border-gray-200 text-gray-800 p-4 rounded-xl hover:bg-gray-50 transition no-underline"
        >
          <Package size={22} className="text-primary-600" />
          <div>
            <div className="font-semibold">ניהול מוצרים</div>
            <div className="text-gray-400 text-xs">ערוך, מחק, עדכן מוצרים</div>
          </div>
        </Link>
        <Link
          to="/deals"
          className="flex items-center gap-3 bg-white border border-gray-200 text-gray-800 p-4 rounded-xl hover:bg-gray-50 transition no-underline"
        >
          <ShoppingCart size={22} className="text-primary-600" />
          <div>
            <div className="font-semibold">קניות קבוצתיות</div>
            <div className="text-gray-400 text-xs">ראה את כל הדילים הפעילים</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
