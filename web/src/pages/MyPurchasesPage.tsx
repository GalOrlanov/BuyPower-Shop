import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupPurchasesAPI } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { ShoppingCart, Clock, Check, X } from 'lucide-react';

const statusLabels: Record<string, string> = {
  open: 'פעילות',
  closed: 'הושלמו',
  cancelled: 'בוטלו',
};

const statusColors: Record<string, string> = {
  open: 'bg-primary-50 text-primary-700',
  closed: 'bg-accent-50 text-accent-700',
  cancelled: 'bg-red-50 text-red-600',
};

export default function MyPurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const params: any = {};
        if (activeTab) params.status = activeTab;
        const { data } = await groupPurchasesAPI.getMy(params);
        setPurchases(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [activeTab]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">הקניות שלי</h1>
      <p className="text-gray-500 text-sm mb-6">הקניות הקבוצתיות שהצטרפתם אליהן</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: '', label: 'הכל' },
          { key: 'open', label: 'פעילות' },
          { key: 'closed', label: 'הושלמו' },
          { key: 'cancelled', label: 'בוטלו' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition border-0 cursor-pointer ${
              activeTab === tab.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : purchases.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <ShoppingCart size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">אין קניות קבוצתיות</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">עדיין לא הצטרפתם לאף קניה קבוצתית</p>
          <Link
            to="/deals"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition no-underline"
          >
            <ShoppingCart size={16} />
            לקניות קבוצתיות
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((item: any) => {
            const gp = item.groupPurchaseId || item;
            const product = gp.productId || {};
            return (
              <Link
                key={item._id}
                to={`/deals/${gp._id}`}
                className="block no-underline"
              >
                <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition flex items-center gap-4">
                  <img
                    src={product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}
                    alt={product.name}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{product.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ₪{gp.currentPrice?.toLocaleString()} | {gp.participantCount} משתתפים
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[gp.status] || 'bg-gray-100 text-gray-500'}`}>
                    {statusLabels[gp.status] || gp.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
