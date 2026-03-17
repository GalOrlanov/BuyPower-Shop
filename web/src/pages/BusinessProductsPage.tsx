import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { businessAPI } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Package, PlusCircle, Play, Eye, Calendar } from 'lucide-react';

export default function BusinessProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingGP, setCreatingGP] = useState<string | null>(null);
  const [gpDays, setGpDays] = useState(14);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await businessAPI.getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createGroupPurchase = async (productId: string) => {
    setError('');
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + gpDays);
      await businessAPI.createGroupPurchase({ productId, endDate: endDate.toISOString() });
      setCreatingGP(null);
      alert('קניה קבוצתית נוצרה בהצלחה!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה ביצירת קניה קבוצתית');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">המוצרים שלי</h1>
          <p className="text-gray-500 text-sm mt-1">ניהול המוצרים והקניות הקבוצתיות</p>
        </div>
        <Link
          to="/business/new-product"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition no-underline"
        >
          <PlusCircle size={16} />
          מוצר חדש
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 text-center py-16">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">אין מוצרים עדיין</h3>
          <Link
            to="/business/new-product"
            className="inline-flex items-center gap-2 mt-4 text-primary-600 font-medium text-sm no-underline"
          >
            <PlusCircle size={16} />
            הוסיפו מוצר ראשון
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product: any) => (
            <div key={product._id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-4">
                <img
                  src={product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}
                  alt={product.name}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">₪{product.originalPrice?.toLocaleString()} | {product.priceTiers?.length || 0} מדרגות מחיר</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Eye size={12} /> {product.viewCount || 0} צפיות
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      product.isActive ? 'bg-accent-50 text-accent-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {product.isActive ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {creatingGP === product._id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} className="text-gray-400" />
                        <input
                          type="number"
                          value={gpDays}
                          onChange={(e) => setGpDays(Number(e.target.value))}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center"
                          min={1}
                          dir="ltr"
                        />
                        <span className="text-xs text-gray-500">ימים</span>
                      </div>
                      <button
                        onClick={() => createGroupPurchase(product._id)}
                        className="px-3 py-1.5 bg-accent-600 text-white rounded-lg text-xs font-medium hover:bg-accent-700 transition border-0 cursor-pointer"
                      >
                        צור
                      </button>
                      <button
                        onClick={() => setCreatingGP(null)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition border-0 cursor-pointer"
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreatingGP(product._id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent-50 text-accent-700 rounded-lg text-xs font-medium hover:bg-accent-100 transition border-0 cursor-pointer"
                    >
                      <Play size={14} />
                      פתח קניה קבוצתית
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
