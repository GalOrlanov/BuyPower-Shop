import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { productsAPI } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Search, Package, ArrowLeft } from 'lucide-react';

const categoryLabels: Record<string, string> = {
  electronics: 'אלקטרוניקה', fashion: 'אופנה', home: 'בית', food: 'מזון',
  health: 'בריאות', sports: 'ספורט', kids: 'ילדים', automotive: 'רכב',
  services: 'שירותים', other: 'אחר',
};

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const category = searchParams.get('category') || '';

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params: any = { page, limit: 12 };
        if (category) params.category = category;
        if (searchTerm) params.search = searchTerm;
        const { data } = await productsAPI.getAll(params);
        setProducts(data.products || data);
        setTotal(data.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [category, page, searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params: any = {};
    if (searchTerm) params.search = searchTerm;
    if (category) params.category = category;
    setSearchParams(params);
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div>
      {/* Vision Banner */}
      <div className="rounded-2xl mb-8 overflow-hidden" style={{ background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)' }}>
        <div className="px-6 py-8 text-center" dir="rtl">
          <div className="text-3xl mb-2">🤝</div>
          <h2 className="text-white text-xl font-bold mb-2">החזון שלנו</h2>
          <p className="text-green-100 text-sm leading-relaxed max-w-lg mx-auto mb-4">
            להחזיר את כוח הקנייה לצרכנים ולהוריד חסמים. כשמתחברים יחד לכל מוצר — הופכים לכוח קנייה שחוסך <strong className="text-white">מאות ואלפי שקלים</strong> לכל בית בישראל.
          </p>
          <div className="flex justify-center gap-6 text-xs text-green-200">
            <span>✅ העסק מרוויח — מוכר הרבה</span>
            <span>✅ הצרכן מרוויח — קונה במחיר טוב</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">כל המוצרים</h1>
        <p className="text-gray-500 text-sm mt-1">גלו מוצרים מובילים במחירים הטובים ביותר</p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש מוצרים..."
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
          />
        </form>
        <select
          value={category}
          onChange={(e) => {
            setPage(1);
            const params: any = {};
            if (e.target.value) params.category = e.target.value;
            if (searchTerm) params.search = searchTerm;
            setSearchParams(params);
          }}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">כל הקטגוריות</option>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">לא נמצאו מוצרים</h3>
          <p className="text-sm text-gray-400 mt-1">נסו לשנות את החיפוש או הפילטרים</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product: any) => (
              <Link
                key={product._id}
                to={`/products/${product._id}`}
                className="group block no-underline"
              >
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-primary-200 h-full flex flex-col">
                  <div className="relative h-48 overflow-hidden bg-gray-100">
                    <img
                      src={product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-medium px-2.5 py-1 rounded-full text-gray-700">
                      {categoryLabels[product.category] || product.category}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2 flex-1">{product.description}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-primary-600">
                        ₪{(product.priceTiers?.[0]?.price || product.originalPrice)?.toLocaleString()}
                      </span>
                      {product.priceTiers?.[0]?.price < product.originalPrice && (
                        <span className="text-sm text-gray-400 line-through">₪{product.originalPrice?.toLocaleString()}</span>
                      )}
                    </div>
                    <span className="mt-2 text-xs font-medium text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                      לפרטים נוספים
                      <ArrowLeft size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition border-0 cursor-pointer ${
                    page === p ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
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
