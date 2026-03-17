import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { groupPurchasesAPI } from '../lib/api';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { Search, Filter, ShoppingCart } from 'lucide-react';

const categories = [
  { key: '', label: 'הכל', icon: '🛍️' },
  { key: 'electronics', label: 'אלקטרוניקה', icon: '📱' },
  { key: 'fashion', label: 'אופנה', icon: '👗' },
  { key: 'home', label: 'בית', icon: '🏠' },
  { key: 'food', label: 'מזון', icon: '🥦' },
  { key: 'health', label: 'בריאות', icon: '💊' },
  { key: 'sports', label: 'ספורט', icon: '⚽' },
  { key: 'kids', label: 'ילדים', icon: '🧸' },
  { key: 'automotive', label: 'רכב', icon: '🚗' },
  { key: 'services', label: 'שירותים', icon: '🔧' },
  { key: 'beverages', label: 'משקאות', icon: '🧃' },
  { key: 'wine', label: 'יין', icon: '🍷' },
  { key: 'cleaning', label: 'ניקיון', icon: '🧹' },
];

export default function DealsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const category = searchParams.get('category') || '';

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      try {
        const params: any = { status: 'open', page, limit: 12 };
        if (category) params.category = category;
        if (searchTerm) params.search = searchTerm;
        const { data } = await groupPurchasesAPI.getAll(params);
        setDeals(data.groupPurchases || data);
        setTotal(data.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, [category, page, searchTerm]);

  const totalPages = Math.ceil(total / 12);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">קניות קבוצתיות פעילות</h1>
        <p className="text-gray-500 text-sm mt-1">הצטרפו לדילים הכי שווים ותחסכו ביחד</p>
      </div>

      {/* Search */}
      <form onSubmit={e => { e.preventDefault(); setPage(1); }} className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="חפש דיל..."
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
          className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 bg-white"
        />
      </form>

      {/* Category Filter - horizontal scrollable pills with icons */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => {
              setPage(1);
              setSearchParams(cat.key ? { category: cat.key } : {});
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium transition border-0 cursor-pointer flex-shrink-0 ${
              category === cat.key
                ? 'bg-green-700 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span className="text-base leading-none">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : deals.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">אין קניות קבוצתיות פעילות</h3>
          <p className="text-sm text-gray-400 mt-1">בדקו שוב מאוחר יותר</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {deals.map((deal: any) => (
              <ProductCard
                key={deal._id}
                product={deal.productId || deal}
                groupPurchase={deal}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition border-0 cursor-pointer ${
                    page === p
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
