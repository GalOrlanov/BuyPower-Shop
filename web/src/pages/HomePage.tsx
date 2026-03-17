import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI, groupPurchasesAPI } from '../lib/api';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ShoppingCart, Users, TrendingDown, Shield, ArrowLeft,
  Zap, Package, Heart, Star, ChevronLeft, ChevronRight, Sparkles, UtensilsCrossed
} from 'lucide-react';

const categories = [
  { key: 'פירות וירקות', label: 'פירות וירקות', icon: UtensilsCrossed, color: 'bg-green-50 text-green-600' },
  { key: 'מוצרי ניקיון', label: 'ניקיון', icon: Sparkles, color: 'bg-cyan-50 text-cyan-600' },
  { key: 'חד פעמי', label: 'חד פעמי', icon: Package, color: 'bg-amber-50 text-amber-600' },
  { key: 'יינות תשבי פסח 2026', label: 'יינות פסח', icon: Star, color: 'bg-purple-50 text-purple-600' },
  { key: 'יינות תשבי קלאסי', label: 'יינות קלאסי', icon: Heart, color: 'bg-pink-50 text-pink-600' },
  { key: 'ירקות ופירות', label: 'ירקות', icon: Zap, color: 'bg-blue-50 text-blue-600' },
];

export default function HomePage() {
  const [hotProducts, setHotProducts] = useState<any[]>([]);
  const [activeDeals, setActiveDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (dir: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const amount = 320;
    carouselRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hotRes, dealsRes] = await Promise.all([
          productsAPI.getHot(),
          groupPurchasesAPI.getAll({ status: 'open', limit: 6 }),
        ]);
        setHotProducts(hotRes.data);
        setActiveDeals(dealsRes.data.groupPurchases || dealsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-bl from-primary-600 via-primary-700 to-primary-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-accent-400 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-6">
              <Zap size={14} />
              <span>הפלטפורמה המובילה לקניות קבוצתיות</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
              קונים ביחד,
              <br />
              <span className="text-accent-300">חוסכים יותר</span>
            </h1>
            <p className="text-lg text-primary-100 mb-8 leading-relaxed">
              הצטרפו לאלפי קונים חכמים שחוסכים עד 60% על מוצרים מובילים.
              ככל שיותר אנשים מצטרפים, המחיר יורד לכולם!
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/deals"
                className="inline-flex items-center gap-2 bg-white text-primary-700 px-6 py-3 rounded-xl font-semibold hover:bg-primary-50 transition no-underline text-sm"
              >
                <ShoppingCart size={18} />
                לקניות קבוצתיות
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/25 transition no-underline text-sm border border-white/20"
              >
                הרשמה חינם
                <ArrowLeft size={18} />
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
            {[
              { value: '50,000+', label: 'משתמשים רשומים' },
              { value: '₪2M+', label: 'נחסכו ללקוחות' },
              { value: '1,200+', label: 'קניות קבוצתיות' },
              { value: '98%', label: 'שביעות רצון' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10">
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-primary-200 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hot Deals Carousel */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🔥 הדילים החמים</h2>
            <p className="text-gray-500 text-sm mt-1">המוצרים הפופולריים ביותר עכשיו</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollCarousel('right')}
              className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-primary-300 transition shadow-sm cursor-pointer"
              aria-label="הקודם"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
            <button
              onClick={() => scrollCarousel('left')}
              className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-primary-300 transition shadow-sm cursor-pointer"
              aria-label="הבא"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <Link
              to="/deals"
              className="flex items-center gap-1 text-primary-600 font-medium text-sm hover:text-primary-700 no-underline mr-2"
            >
              הצג הכל
              <ChevronLeft size={16} />
            </Link>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="relative">
            <div
              ref={carouselRef}
              className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {(hotProducts.length > 0 ? hotProducts : activeDeals).slice(0, 12).map((item: any, idx: number) => {
                const product = item.product || item.productId || item;
                const gp = item.groupPurchase || (item.productId ? item : undefined);
                return (
                  <div key={product._id || idx} className="flex-shrink-0 w-64">
                    <ProductCard
                      product={product}
                      groupPurchase={gp}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* How it Works */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900">איך זה עובד?</h2>
            <p className="text-gray-500 mt-2">תהליך פשוט, חיסכון מקסימלי</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: ShoppingCart,
                title: 'בחרו מוצר',
                desc: 'גלשו בין מאות מוצרים מובילים במחירים שלא תמצאו בשום מקום אחר',
                color: 'from-primary-500 to-primary-600',
              },
              {
                step: '2',
                icon: Users,
                title: 'הצטרפו לקבוצה',
                desc: 'הצטרפו לקניה קבוצתית קיימת. ככל שיותר אנשים מצטרפים, המחיר יורד',
                color: 'from-accent-500 to-accent-600',
              },
              {
                step: '3',
                icon: TrendingDown,
                title: 'חסכו כסף',
                desc: 'קבלו את המוצר במחיר הנמוך ביותר. חיסכון של עד 60% ממחיר השוק',
                color: 'from-orange-500 to-orange-600',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="relative mx-auto w-20 h-20 mb-4">
                  <div className={`w-full h-full bg-gradient-to-bl ${item.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <item.icon size={32} className="text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">קטגוריות</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.key}
              to={`/products?category=${cat.key}`}
              className={`${cat.color} flex flex-col items-center gap-2 p-6 rounded-2xl hover:shadow-md transition no-underline`}
            >
              <cat.icon size={28} />
              <span className="font-medium text-sm">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA for Businesses */}
      <section className="bg-gradient-to-bl from-gray-900 to-gray-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3">בעל עסק? הצטרף אלינו</h2>
          <p className="text-gray-300 mb-6 max-w-xl mx-auto">
            הגדילו את המכירות שלכם דרך קניות קבוצתיות. הגיעו לאלפי לקוחות חדשים ומכרו בנפחים גדולים.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition no-underline text-sm"
          >
            הרשמה כבעל עסק
            <ArrowLeft size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
