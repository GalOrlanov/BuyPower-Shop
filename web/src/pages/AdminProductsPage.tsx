import { useEffect, useState } from 'react';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Package, Search, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchProducts = async (q = '') => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/products?search=${q}&limit=50`);
      setProducts(r.data.products);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleToggle = async (id: string) => {
    setActionLoading(id + '_toggle');
    try {
      const r = await api.patch(`/admin/products/${id}/toggle`);
      setProducts(prev => prev.map(p => p._id === id ? { ...p, isActive: r.data.isActive } : p));
    } finally { setActionLoading(null); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`למחוק את "${name}" לצמיתות?`)) return;
    setActionLoading(id + '_delete');
    try {
      await api.delete(`/admin/products/${id}`);
      setProducts(prev => prev.filter(p => p._id !== id));
    } finally { setActionLoading(null); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Package size={22} className="text-amber-600" />
        <h1 className="text-2xl font-bold text-gray-900">ניהול מוצרים</h1>
        <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{products.length}</span>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="חפש מוצר..."
          value={search}
          onChange={e => { setSearch(e.target.value); fetchProducts(e.target.value); }}
          className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400"
        />
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-right">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">מוצר</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">עסק</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">מחיר</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">נמכר</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">קטגוריה</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">סטטוס</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p._id} className={`hover:bg-gray-50 transition ${!p.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=60'}
                          className="w-10 h-10 rounded-lg object-cover"
                          alt=""
                        />
                        <div className="font-medium text-gray-900 truncate max-w-[160px]">{p.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.businessId?.businessName || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">₪{p.originalPrice?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{p.totalSold || 0}</td>
                    <td className="px-4 py-3 text-gray-500">{p.category}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isActive ? 'פעיל' : 'כבוי'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(p._id)}
                          disabled={actionLoading === p._id + '_toggle'}
                          title={p.isActive ? 'כבה מוצר' : 'הפעל מוצר'}
                          className={`p-1.5 rounded-lg transition border-0 cursor-pointer ${p.isActive ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                        >
                          {p.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                        </button>
                        <button
                          onClick={() => {
                            const market = p.originalPrice || (p.priceTiers?.[0]?.price || 0);
                            const bp = p.priceTiers?.[p.priceTiers.length-1]?.price || market;
                            const people = p.priceTiers?.[p.priceTiers.length-1]?.minBuyers || 30;
                            const url = `/vs-template.html?product=${encodeURIComponent(p.name)}&market=${market}&bp=${bp}&people=${people}`;
                            window.open(url, '_blank');
                          }}
                          title="צור פלאייר"
                          className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition border-0 cursor-pointer"
                        >
                          📸
                        </button>
                        <button
                          onClick={() => handleDelete(p._id, p.name)}
                          disabled={actionLoading === p._id + '_delete'}
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
            {products.length === 0 && <div className="text-center py-12 text-gray-400">אין מוצרים</div>}
          </div>
        </div>
      )}
    </div>
  );
}
