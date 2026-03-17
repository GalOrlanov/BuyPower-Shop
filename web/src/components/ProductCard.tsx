import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Users, TrendingDown, ArrowLeft, Clock, Star } from 'lucide-react';

interface PriceTier {
  minBuyers: number;
  price: number;
}

interface BusinessInfo {
  _id?: string;
  businessName?: string;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
}

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    description: string;
    images: string[];
    originalPrice: number;
    priceTiers: PriceTier[];
    category: string;
    deliveryTerms?: string;
    businessId?: BusinessInfo | string;
  };
  groupPurchase?: {
    _id: string;
    currentPrice: number;
    participantCount: number;
    status: string;
    endDate: string;
  };
}

const categoryLabels: Record<string, string> = {
  electronics: 'אלקטרוניקה',
  fashion: 'אופנה',
  home: 'בית',
  food: 'מזון',
  health: 'בריאות',
  sports: 'ספורט',
  kids: 'ילדים',
  automotive: 'רכב',
  services: 'שירותים',
  other: 'אחר',
};

function useDaysLeft(endDate?: string): number | null {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!endDate) return;
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      setDays(Math.max(0, Math.ceil(diff / 86400000)));
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [endDate]);
  return days;
}

export default function ProductCard({ product, groupPurchase }: ProductCardProps) {
  const daysLeft = useDaysLeft(groupPurchase?.endDate);
  const business = typeof product.businessId === 'object' ? product.businessId as BusinessInfo : null;
  const currentPrice = groupPurchase?.currentPrice || product.priceTiers[0]?.price || product.originalPrice;
  const savings = Math.round(((product.originalPrice - currentPrice) / product.originalPrice) * 100);
  const bestPrice = product.priceTiers[product.priceTiers.length - 1]?.price || currentPrice;
  const maxBuyers = product.priceTiers[product.priceTiers.length - 1]?.minBuyers || 100;
  const participantCount = groupPurchase?.participantCount || 0;
  const progress = Math.min((participantCount / maxBuyers) * 100, 100);

  const linkTo = groupPurchase?._id ? `/deals/${groupPurchase._id}` : `/products/${product._id}`;

  return (
    <Link to={linkTo} className="group block no-underline">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-primary-200 h-full flex flex-col">
        {/* Image */}
        <div className="relative h-48 overflow-hidden bg-gray-100">
          <img
            src={product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {savings > 0 && (
            <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {savings}%- חיסכון
            </div>
          )}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-medium px-2.5 py-1 rounded-full text-gray-700">
            {categoryLabels[product.category] || product.category}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition">
            {product.name}
          </h3>
          <p className="text-xs text-gray-500 mb-3 line-clamp-2 flex-1">
            {product.description}
          </p>

          {/* Pricing */}
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-xl font-bold text-primary-600">
              {bestPrice < currentPrice ? `₪${bestPrice.toLocaleString()} - ₪${currentPrice.toLocaleString()}` : `₪${currentPrice.toLocaleString()}`}
            </span>
            {currentPrice < product.originalPrice && (
              <span className="text-sm text-gray-400 line-through">₪{product.originalPrice.toLocaleString()}</span>
            )}
          </div>

          {/* Best possible price hint */}
          {bestPrice < currentPrice && (
            <div className="flex items-center gap-1 text-xs text-accent-600 mb-3 bg-accent-50 px-2 py-1 rounded-lg">
              <TrendingDown size={12} />
              <span>יכול לרדת עד ₪{bestPrice.toLocaleString()}</span>
            </div>
          )}

          {/* Progress */}
          {groupPurchase && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  <span>{participantCount} משתתפים</span>
                </div>
                <span>יעד: {maxBuyers}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-gradient-to-l from-primary-500 to-accent-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Countdown */}
          {groupPurchase && daysLeft !== null && (
            <div className={`mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
              daysLeft <= 2 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
            }`}>
              <Clock size={11} />
              <span>{daysLeft === 0 ? 'מסתיים היום!' : `${daysLeft} ימים נותרו`}</span>
            </div>
          )}

          {/* Business Info */}
          {business?.businessName && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500">{business.businessName}</span>
              <span className="text-[10px] text-emerald-600 font-medium">מאומת ✓</span>
              {business.rating && business.rating > 0 ? (
                <span className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={10} className={s <= Math.round(business.rating!) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                  ))}
                  <span className="text-[10px] text-gray-400">({business.reviewCount})</span>
                </span>
              ) : null}
            </div>
          )}

          {/* Shipping */}
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <span>🚚</span>
            <span>{product.deliveryTerms || 'משלוח לפי החלטת העסק'}</span>
          </div>

          {/* CTA */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-medium text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
              לפרטים נוספים
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
