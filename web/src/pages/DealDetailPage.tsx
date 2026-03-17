import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { groupPurchasesAPI, reviewsAPI, businessAPI, productsAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ChatWidget from '../components/ChatWidget';
import {
  Users, TrendingDown, Clock, ShoppingCart, Check, X,
  Star, ArrowRight, Share2, Heart, AlertCircle, MapPin, Building2, Calendar,
  ChevronDown, ChevronUp, Truck, Ban, ShieldCheck, Lock
} from 'lucide-react';

function useCountdown(endDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) return setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [endDate]);
  return timeLeft;
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { addItem, items } = useCart();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<any>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [business, setBusiness] = useState<any>(null);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Review submission state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Checkout modal (shown before joining — collects details + creates payment link)
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    street: '', city: '', zip: '',
    invoiceName: '', invoiceLicense: '',
  });
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  const [showInstantBuyDialog, setShowInstantBuyDialog] = useState(false);
  const [instantBuying, setInstantBuying] = useState(false);
  const [preAuthStatus, setPreAuthStatus] = useState<string | null>(null);

  // "No GP yet" state — product found but no active group purchase
  const [noGpProduct, setNoGpProduct] = useState<any>(null);
  const [gpDays, setGpDays] = useState(14);
  const [creatingGP, setCreatingGP] = useState(false);
  const [createGpError, setCreateGpError] = useState('');

  const isParticipant = deal?.participants?.some((p: any) => p.userId?._id === user?._id || p.userId === user?._id);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve before fetching
    const fetchDeal = async () => {
      try {
        let data;
        try {
          const res = await groupPurchasesAPI.getById(id!);
          data = res.data;
        } catch {
          // Maybe id is a product id - search by productId
          const res = await groupPurchasesAPI.getAll({ productId: id, status: 'open', limit: 1 });
          const gps = res.data.groupPurchases || res.data;
          if (!gps?.length) throw new Error('not found');
          const gpRes = await groupPurchasesAPI.getById(gps[0]._id);
          data = gpRes.data;
        }
        const gp = data.groupPurchase || data;
        gp.participants = data.participants || [];
        setDeal(gp);
        setShareLink(`${window.location.origin}/deals/${gp._id}`);
        // If user is logged in and is a participant but not in cart — restore cart entry
        if (user && (data.participants || []).some((p: any) => p.userId?._id === user._id || p.userId === user._id)) {
          const cp = gp.productId as any;
          const cpImages = cp?.images?.length > 0 ? cp.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];
          addItem({
            groupPurchaseId: gp._id,
            productId: cp?._id || gp._id,
            productName: cp?.name || 'רכישה קבוצתית',
            image: cpImages[0],
            priceTiers: cp?.priceTiers || [],
            originalPrice: cp?.originalPrice || 0,
            quantity: 1,
            currentParticipants: gp.participantCount || 0,
            isGroupPurchase: true,
            endDate: gp.endDate,
            targetParticipants: cp?.maxBuyers,
            minParticipants: cp?.minBuyers,
          });
        }
        if (gp.productId?._id) {
          try {
            const revRes = await reviewsAPI.getByProduct(gp.productId._id);
            setReviews(revRes.data);
          } catch {}
        }
        // Load business info
        const businessId = gp.productId?.businessId?._id || gp.productId?.businessId;
        if (businessId) {
          try {
            const bizRes = await businessAPI.getPublic(businessId);
            setBusiness(bizRes.data);
          } catch {}
        }
      } catch (err) {
        console.error(err);
        // No GP found — try loading the product directly
        try {
          const prodRes = await productsAPI.getById(id!);
          setNoGpProduct(prodRes.data);
        } catch {
          // Product not found either — leave deal=null to show generic error
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDeal();
  }, [id, user?._id, authLoading]);

  // Always use deal._id (the actual GP ID), not the URL param (which may be a product ID)
  const gpId = deal?._id || id!;

  // Open checkout modal instead of joining directly
  const handleJoin = () => {
    if (!user) { navigate('/login'); return; }
    setCheckoutError('');
    setPaymentLink('');
    setShowCheckout(true);
  };

  // Submit checkout: create payment link via Make → then register join
  const handleCheckoutSubmit = async () => {
    const { firstName, lastName, phone, email, street, city, zip } = checkoutForm;
    const missing: string[] = [];
    if (!firstName.trim()) missing.push('שם פרטי');
    if (!lastName.trim()) missing.push('שם משפחה');
    if (!phone.trim()) missing.push('טלפון');
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('אימייל תקין');
    if (!street.trim()) missing.push('כתובת');
    if (!city.trim()) missing.push('עיר');
    if (missing.length) { setCheckoutError('נא למלא שדות חובה: ' + missing.join(', ')); return; }

    setCheckoutSubmitting(true);
    setCheckoutError('');
    try {
      const prod = deal.productId || {};
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      // Normalize phone (remove non-digits, fix 972 prefix)
      const normalizedPhone = phone.replace(/[^0-9]/g, '').replace(/^972/, '0');
      const addressLine = [street.trim(), city.trim(), zip.trim()].filter(Boolean).join(', ');

      // 1. Save pending order in system
      let orderId: string | null = null;
      try {
        const orRes = await fetch('/api/shop/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: fullName, phone: normalizedPhone, email: email.trim(),
            address: addressLine, city: city.trim(), zip: zip.trim(),
            items: [{ _id: (prod as any)._id, name: (prod as any).name, price: deal.currentPrice, qty: 1 }],
            totalAmount: deal.currentPrice,
            paymentMethod: 'grow', status: 'pending_payment',
            groupPurchaseId: gpId, chargeType: 2,
          }),
        });
        const orData = await orRes.json();
        orderId = orData.orderId || orData._id || null;
      } catch { /* non-fatal */ }

      // 2. Create payment link via Make webhook (ChargeType 2 = Group Charge)
      const successUrl = `https://buypower.co.il/order/success${orderId ? `?orderId=${orderId}&name=${encodeURIComponent(fullName)}` : ''}`;
      const failUrl = `https://buypower.co.il/order/failed${orderId ? `?orderId=${orderId}` : ''}`;

      const payRes = await fetch('/api/shop/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `רכישה קבוצתית — ${(prod as any).name || 'מוצר'}`,
          full_name: fullName,
          phone: normalizedPhone,
          email: email.trim(),
          invoice_name: checkoutForm.invoiceName.trim() || fullName,
          invoice_license_number: checkoutForm.invoiceLicense.trim(),
          chargeType: 2,
          payment_type: 'Payments',
          max_or_custom: 'Max Payments',
          message_text: `רכישה קבוצתית | כתובת: ${addressLine}`,
          success_url: successUrl,
          fail_url: failUrl,
          products: [{
            catalog_number: (prod as any)._id || '0',
            name: (prod as any).name || 'מוצר',
            price: deal.currentPrice || (prod as any).originalPrice || 0,
            quantity: 1,
            minimum_quantity: 1,
            productUrl: (prod as any).images?.[0] || '',
            vatType: 1,
          }],
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || 'שגיאה ביצירת לינק תשלום');

      // 3. Register join in our system
      try {
        const joinRes = await groupPurchasesAPI.join(gpId);
        if (joinRes.data?.preAuthStatus) setPreAuthStatus(joinRes.data.preAuthStatus);
        const { data } = await groupPurchasesAPI.getById(gpId);
        const gp = data.groupPurchase || data;
        gp.participants = data.participants || [];
        setDeal(gp);

        // 4. Add to cart so the user can see it there too
        const cartProd = deal.productId as any;
        const cartImages = cartProd?.images?.length > 0
          ? cartProd.images
          : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];
        addItem({
          groupPurchaseId: gpId,
          productId: cartProd?._id || gpId,
          productName: cartProd?.name || 'רכישה קבוצתית',
          image: cartImages[0],
          priceTiers: cartProd?.priceTiers || [],
          originalPrice: cartProd?.originalPrice || 0,
          quantity: 1,
          currentParticipants: gp.participantCount || 0,
          isGroupPurchase: true,
          endDate: gp.endDate,
          targetParticipants: cartProd?.maxBuyers,
          minParticipants: cartProd?.minBuyers,
        });
      } catch { /* join registration failure is non-fatal */ }

      // 4. Show payment link
      const url = payData.paymentUrl;
      if (url) {
        setPaymentLink(url);
      } else {
        setCheckoutError('לינק התשלום נוצר אך לא הוחזר URL — בדוק Make');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'שגיאה ביצירת לינק תשלום');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    setError('');
    try {
      await groupPurchasesAPI.leave(gpId);
      const { data } = await groupPurchasesAPI.getById(gpId);
      const gp = data.groupPurchase || data;
      gp.participants = data.participants || [];
      setDeal(gp);
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה בעזיבה');
    } finally {
      setLeaving(false);
    }
  };

  const countdown = useCountdown(deal?.endDate || '');

  const handleInstantBuy = async () => {
    if (!user) { navigate('/login'); return; }
    setInstantBuying(true);
    setError('');
    try {
      await groupPurchasesAPI.leave(gpId);
      const prod = deal.productId || {};
      const prodImages = prod.images?.length > 0 ? prod.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];
      addItem({
        groupPurchaseId: deal._id,
        productId: prod._id || deal._id,
        productName: prod.name || '',
        image: prodImages[0],
        priceTiers: [],
        originalPrice: prod.originalPrice || 0,
        quantity: 1,
        currentParticipants: 0,
      });
      setShowInstantBuyDialog(false);
      navigate('/cart');
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה בקניה המיידית');
      setShowInstantBuyDialog(false);
    } finally {
      setInstantBuying(false);
    }
  };

  const handleRateBusiness = async (rating: number) => {
    if (!user) { navigate('/login'); return; }
    const businessId = deal?.productId?.businessId?._id || deal?.productId?.businessId;
    if (!businessId) return;
    try {
      const res = await businessAPI.rate(businessId, rating);
      setUserRating(rating);
      setRatingSubmitted(true);
      setBusiness((prev: any) => prev ? { ...prev, rating: res.data.avgRating, reviewCount: res.data.reviewCount } : prev);
    } catch {}
  };

  const handleSubmitReview = async () => {
    if (!user) { navigate('/login'); return; }
    if (reviewRating === 0) { setReviewError('בחר דירוג'); return; }
    const productId = deal?.productId?._id;
    if (!productId) return;
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const res = await reviewsAPI.create({
        productId,
        rating: reviewRating,
        text: reviewText.trim() || undefined,
        groupPurchaseId: deal._id,
      });
      const newReview = res.data.review || res.data;
      setReviews(prev => [newReview, ...prev]);
      setReviewSubmitted(true);
      setReviewRating(0);
      setReviewText('');
    } catch (err: any) {
      setReviewError(err.response?.data?.error || 'שגיאה בשמירת הביקורת');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleCreateGP = async () => {
    if (!noGpProduct) return;
    setCreatingGP(true);
    setCreateGpError('');
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + gpDays);
      const res = await businessAPI.createGroupPurchase({
        productId: noGpProduct._id,
        endDate: endDate.toISOString(),
      });
      const newGpId = res.data?._id || res.data?.groupPurchase?._id;
      if (newGpId) {
        navigate(`/deals/${newGpId}`);
      } else {
        navigate('/business/products');
      }
    } catch (err: any) {
      setCreateGpError(err.response?.data?.error || 'שגיאה ביצירת קניה קבוצתית');
      setCreatingGP(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  // Product found but no active group purchase — show create-GP form
  if (!deal && noGpProduct) {
    const p = noGpProduct;
    const images = p.images?.length > 0 ? p.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];
    return (
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 bg-transparent border-0 cursor-pointer text-sm"
        >
          <ArrowRight size={16} />
          חזרה
        </button>
        <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <img src={images[0]} alt={p.name} className="w-20 h-20 rounded-xl object-cover border border-gray-100" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{p.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">₪{p.originalPrice?.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 flex items-start gap-2">
            <Lock size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <strong>רכישה קבוצתית עם ChargeType 2</strong>
              <br />
              האשראי של הקונים יאובטח אך לא יחויב עד שהיעד יושג. פתח קמפיין כדי לשתף לינק רכישה.
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">משך הקמפיין (ימים)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={gpDays}
                onChange={(e) => setGpDays(Math.max(1, Number(e.target.value)))}
                min={1}
                max={90}
                className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-center font-semibold focus:outline-none focus:border-green-500"
                dir="ltr"
              />
              <span className="text-sm text-gray-500">
                יסתיים ב-{new Date(Date.now() + gpDays * 86400000).toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          {createGpError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <AlertCircle size={16} />
              {createGpError}
            </div>
          )}

          <button
            onClick={handleCreateGP}
            disabled={creatingGP}
            className="w-full py-3.5 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 transition disabled:opacity-50 border-0 cursor-pointer flex items-center justify-center gap-2 text-base"
          >
            {creatingGP ? 'יוצר קמפיין...' : '🚀 פתח קניה קבוצתית וצור לינק'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">לאחר היצירה תקבל לינק ניתן לשיתוף</p>
        </div>
      </div>
    );
  }

  if (!deal) return <div className="text-center py-16"><p className="text-gray-500">הקניה הקבוצתית לא נמצאה</p></div>;

  const product = deal.productId || {};
  const images = product.images?.length > 0 ? product.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];
  const priceTiers = product.priceTiers || [];
  const maxBuyers = priceTiers[priceTiers.length - 1]?.minBuyers || product.maxBuyers || 100;
  const progress = Math.min((deal.participantCount / maxBuyers) * 100, 100);
  const savings = Math.round(((product.originalPrice - deal.currentPrice) / product.originalPrice) * 100);
  const inCart = items.some(i => i.groupPurchaseId === deal._id);

  // Compute average rating
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
    : 0;

  const handleAddToCart = () => {
    addItem({
      groupPurchaseId: deal._id,
      productId: product._id,
      productName: product.name,
      image: images[0],
      priceTiers: priceTiers,
      originalPrice: product.originalPrice,
      quantity: 1,
      currentParticipants: deal.participantCount || 0,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 bg-transparent border-0 cursor-pointer text-sm"
      >
        <ArrowRight size={16} />
        חזרה
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 mb-3">
            <img
              src={images[selectedImage]}
              alt={product.name}
              className="w-full h-80 lg:h-96 object-contain bg-gray-50"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                    i === selectedImage ? 'border-primary-500' : 'border-gray-200'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <button
                onClick={() => {
                  if (shareLink) {
                    navigator.clipboard.writeText(shareLink).then(() => {
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    });
                  }
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 bg-transparent border-0 cursor-pointer"
                title="העתק לינק שיתוף"
              >
                {linkCopied ? <Check size={18} className="text-green-600" /> : <Share2 size={18} />}
              </button>
            </div>
            {shareLink && user?.role === 'business' && (
              <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                <span className="text-xs text-green-700 flex-1 truncate font-mono">{shareLink}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink).then(() => {
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    });
                  }}
                  className="text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 px-2 py-1 rounded-lg border-0 cursor-pointer whitespace-nowrap transition"
                >
                  {linkCopied ? '✓ הועתק!' : '📋 העתק לינק'}
                </button>
              </div>
            )}

            <p className="text-gray-500 text-sm mb-3">{product.description}</p>

            {/* Business Info */}
            {business && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">{business.businessName}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  מוכר מאומת ✓
                </span>
                {business.rating > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={12} className={s <= Math.round(business.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                      ))}
                    </span>
                    <span>{business.rating.toFixed(1)} ({business.reviewCount} ביקורות)</span>
                  </span>
                )}
              </div>
            )}

            {/* Price */}
            <div className="bg-gradient-to-bl from-primary-50 to-accent-50 rounded-xl p-4 mb-4">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary-600">₪{deal.currentPrice?.toLocaleString()}</span>
                <span className="text-lg text-gray-400 line-through">₪{product.originalPrice?.toLocaleString()}</span>
                {savings > 0 && (
                  <span className="bg-red-100 text-red-600 text-sm font-bold px-2 py-0.5 rounded-full">
                    -{savings}%
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">המחיר יורד ככל שיותר אנשים מצטרפים!</p>
            </div>

            {/* Countdown Timer */}
            {deal.status === 'open' && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-orange-600 mb-2">
                  <Clock size={16} />
                  <span className="text-sm font-semibold">זמן שנותר לסיום הקניה</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { value: countdown.days, label: 'ימים' },
                    { value: countdown.hours, label: 'שעות' },
                    { value: countdown.minutes, label: 'דקות' },
                    { value: countdown.seconds, label: 'שניות' },
                  ].map(({ value, label }) => (
                    <div key={label} className="bg-white rounded-lg p-2 border border-orange-100">
                      <div className="text-xl font-bold text-orange-600">{String(value).padStart(2, '0')}</div>
                      <div className="text-[10px] text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Users size={18} className="mx-auto text-primary-500 mb-1" />
                <div className="text-lg font-bold text-gray-900">{deal.participantCount}</div>
                <div className="text-xs text-gray-500">משתתפים</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Clock size={18} className="mx-auto text-orange-500 mb-1" />
                <div className="text-lg font-bold text-gray-900">{countdown.days}</div>
                <div className="text-xs text-gray-500">ימים נותרו</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <TrendingDown size={18} className="mx-auto text-accent-500 mb-1" />
                <div className="text-lg font-bold text-gray-900">₪{(product.originalPrice - deal.currentPrice)?.toLocaleString()}</div>
                <div className="text-xs text-gray-500">חיסכון</div>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1.5">
                <span>{deal.participantCount} משתתפים</span>
                <span>יעד: {maxBuyers}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-gradient-to-l from-primary-500 to-accent-500 h-3 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Pickup Point Info */}
            {deal.pickupPointId && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <MapPin size={16} />
                  <span className="text-sm font-semibold">נקודת איסוף</span>
                </div>
                <div className="text-sm font-medium text-gray-900">{deal.pickupPointId.name}</div>
                {deal.pickupPointId.address && (
                  <div className="text-xs text-gray-500 mt-0.5">{deal.pickupPointId.address}</div>
                )}
                <div className="flex flex-wrap gap-4 mt-2">
                  {deal.pickupPointId.collectionDate && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Calendar size={12} />
                      <span>{new Date(deal.pickupPointId.collectionDate).toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>
                  )}
                  {deal.pickupPointId.collectionTimeFrom && deal.pickupPointId.collectionTimeTo && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Clock size={12} />
                      <span dir="ltr">{deal.pickupPointId.collectionTimeFrom} – {deal.pickupPointId.collectionTimeTo}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price Tiers */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">טבלת מחירים</h3>
              <div className="space-y-1.5">
                {priceTiers.map((tier: any, i: number) => {
                  const isActive = deal.participantCount >= tier.minBuyers &&
                    (i === priceTiers.length - 1 || deal.participantCount < priceTiers[i + 1].minBuyers);
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        isActive ? 'bg-primary-50 border border-primary-200 text-primary-700 font-medium' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span>{tier.minBuyers}+ קונים</span>
                      <span className="font-semibold">₪{tier.price.toLocaleString()}</span>
                      {isActive && <Check size={16} className="text-primary-600" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rate Business */}
            {business && user && (
              <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">דרג את העסק</h3>
                {ratingSubmitted ? (
                  <p className="text-sm text-amber-700">✓ תודה על הדירוג!</p>
                ) : (
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button
                        key={s}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => handleRateBusiness(s)}
                        className="bg-transparent border-0 cursor-pointer p-0.5"
                        aria-label={`דרג ${s} כוכבים`}
                      >
                        <Star size={24} className={s <= (hoverRating || userRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* CTA */}
            {deal.status === 'open' && (
              isParticipant ? (
                <div className="space-y-2">
                  <div className="p-3 bg-accent-50 border border-accent-200 rounded-xl text-sm text-accent-700 flex items-center gap-2">
                    <Check size={16} />
                    אתם משתתפים בקניה הקבוצתית!
                  </div>
                  {/* Pre-auth status badge */}
                  <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                    preAuthStatus === 'captured'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : preAuthStatus === 'released'
                      ? 'bg-gray-50 border border-gray-200 text-gray-600'
                      : preAuthStatus === 'failed'
                      ? 'bg-red-50 border border-red-200 text-red-600'
                      : 'bg-blue-50 border border-blue-200 text-blue-700'
                  }`}>
                    <ShieldCheck size={16} />
                    {preAuthStatus === 'captured'
                      ? 'החיוב בוצע בהצלחה ✓'
                      : preAuthStatus === 'released'
                      ? 'האישור המקדים שוחרר — לא בוצע חיוב'
                      : preAuthStatus === 'failed'
                      ? 'שגיאה באישור המקדים — פנה לתמיכה'
                      : 'כרטיס האשראי שלך מאובטח — לא יחויב עד להשלמת הרכישה'}
                  </div>
                  <button
                    onClick={() => setShowInstantBuyDialog(true)}
                    className="w-full py-3 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 transition border-0 cursor-pointer flex items-center justify-center gap-2 text-sm"
                  >
                    🛒 קנה עכשיו במחיר מלא
                  </button>
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {leaving ? 'עוזב...' : 'עזיבת הקניה'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Pre-auth notice — shown before joining */}
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-start gap-2">
                    <Lock size={14} className="mt-0.5 flex-shrink-0" />
                    <span>מספר האשראי שלך יאובטח אך לא יחויב עד השלמת הרכישה הקבוצתית</span>
                  </div>
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition disabled:opacity-50 border-0 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={18} />
                    {joining ? 'מצטרף...' : 'הצטרפות לקניה הקבוצתית'}
                  </button>
                  <button
                    onClick={handleAddToCart}
                    disabled={inCart}
                    className={`w-full py-3 rounded-xl font-semibold transition border-0 cursor-pointer flex items-center justify-center gap-2 text-sm ${
                      inCart || addedToCart
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-white border border-primary-200 text-primary-600 hover:bg-primary-50'
                    }`}
                  >
                    <ShoppingCart size={16} />
                    {addedToCart ? '✓ נוסף לעגלה!' : inCart ? 'כבר בעגלה' : 'הוסף לעגלה'}
                  </button>
                  {(inCart || addedToCart) && (
                    <Link to="/cart" className="block text-center text-xs text-primary-600 hover:underline no-underline">
                      לצפייה בעגלה →
                    </Link>
                  )}
                </div>
              )
            )}
            {deal.status === 'closed' && (
              <div className="p-3 bg-gray-100 rounded-xl text-sm text-gray-600 text-center">הקניה הקבוצתית הסתיימה</div>
            )}
          </div>

          {/* Shipping Details */}
          {(product.shippingPrice !== undefined || product.shippingTime) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck size={16} className="text-[#15803d]" />
                <h3 className="text-sm font-semibold text-gray-900">פרטי משלוח</h3>
              </div>
              <div className="flex flex-wrap gap-4">
                {product.shippingPrice !== undefined && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <span className="font-medium text-gray-800">מחיר משלוח:</span>
                    {product.shippingPrice === 0
                      ? <span className="text-[#15803d] font-semibold">חינם 🎉</span>
                      : <span>₪{product.shippingPrice.toLocaleString()}</span>
                    }
                  </div>
                )}
                {product.shippingTime && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <span className="font-medium text-gray-800">זמן משלוח:</span>
                    <span>{product.shippingTime}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cancellation Policy */}
          {product.cancelPolicy && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Ban size={16} className="text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900">מדיניות ביטול</h3>
              </div>
              <p className="text-sm text-gray-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                {product.cancelPolicy}
              </p>
            </div>
          )}

          {/* Terms of Use — collapsible */}
          {(product.deliveryTerms || product.cancellationTerms) && (
            <div className="bg-white rounded-2xl border border-gray-100 mt-4 overflow-hidden">
              <button
                type="button"
                onClick={() => setTermsOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 bg-transparent border-0 cursor-pointer text-right"
              >
                <span className="text-sm font-semibold text-gray-900">תנאי שימוש</span>
                {termsOpen
                  ? <ChevronUp size={16} className="text-gray-400" />
                  : <ChevronDown size={16} className="text-gray-400" />
                }
              </button>
              {termsOpen && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
                  {product.deliveryTerms && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#15803d] mt-3 mb-1">תנאי משלוח</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{product.deliveryTerms}</p>
                    </div>
                  )}
                  {product.cancellationTerms && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#15803d] mb-1">תנאי ביטול</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{product.cancellationTerms}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6">
        {/* Header with average rating */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            ביקורות{reviews.length > 0 ? ` (${reviews.length})` : ''}
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={16} className={s <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-gray-400">מתוך 5</span>
            </div>
          )}
        </div>

        {/* Submit Review Form */}
        {user && !reviewSubmitted && (
          <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">כתוב ביקורת</h3>
            {/* Star rating input */}
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setReviewHoverRating(s)}
                  onMouseLeave={() => setReviewHoverRating(0)}
                  onClick={() => setReviewRating(s)}
                  className="bg-transparent border-0 cursor-pointer p-0.5"
                  aria-label={`דרג ${s} כוכבים`}
                >
                  <Star
                    size={28}
                    className={s <= (reviewHoverRating || reviewRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="ספר על חווייתך עם המוצר (אופציונלי)"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600 resize-none mb-3"
            />
            {reviewError && (
              <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
                <AlertCircle size={13} /> {reviewError}
              </p>
            )}
            <button
              onClick={handleSubmitReview}
              disabled={reviewSubmitting || reviewRating === 0}
              className="px-5 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition disabled:opacity-50 border-0 cursor-pointer font-medium"
            >
              {reviewSubmitting ? 'שומר...' : 'שלח ביקורת'}
            </button>
          </div>
        )}

        {reviewSubmitted && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
            <Check size={16} />
            תודה! הביקורת שלך נשמרה בהצלחה.
          </div>
        )}

        {/* Existing Reviews */}
        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review: any) => (
              <div key={review._id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        className={s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {review.userId?.firstName} {review.userId?.lastName}
                  </span>
                </div>
                {review.text && <p className="text-sm text-gray-600">{review.text}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">אין ביקורות עדיין. היה הראשון!</p>
        )}
      </div>

      {/* Business Details Footer */}
      {business && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-green-700" />
            פרטי העסק
          </h2>
          <div className="flex items-start gap-4">
            {/* Business Logo */}
            {(business.logo || business.logoUrl) ? (
              <img
                src={business.logo || business.logoUrl}
                alt={business.businessName}
                className="w-16 h-16 rounded-xl object-cover border border-gray-100 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={28} className="text-green-700" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 mb-1">{business.businessName}</p>
              {(business.address || business.city) && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                  <span>
                    {[business.address, business.city].filter(Boolean).join(', ')}
                  </span>
                </p>
              )}
              {business.phone && (
                <p className="text-sm text-gray-500 mt-1">{business.phone}</p>
              )}
              {business.rating > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={13} className={s <= Math.round(business.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">{business.rating.toFixed(1)} ({business.reviewCount} דירוגים)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Widget — floating bottom-left, WhatsApp-green */}
      {deal && (
        <ChatWidget
          productId={product._id || deal._id}
          businessName={business?.businessName}
        />
      )}

      {/* Checkout Modal — collects customer details before join + payment link */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[90vh] overflow-y-auto">
            {paymentLink ? (
              /* Payment link created — show it */
              <div className="text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">לינק תשלום נוצר!</h3>
                <p className="text-sm text-gray-500 mb-4">שלח את הלינק הזה ללקוח להשלמת הרכישה הקבוצתית</p>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                  <span className="text-xs text-green-700 flex-1 break-all font-mono">{paymentLink}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(paymentLink); }}
                    className="flex-1 py-2.5 bg-green-700 text-white rounded-xl font-semibold text-sm border-0 cursor-pointer hover:bg-green-800 transition"
                  >
                    📋 העתק לינק
                  </button>
                  <a
                    href={paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm text-center no-underline hover:bg-blue-700 transition"
                  >
                    🔗 פתח לינק
                  </a>
                </div>
                <button
                  onClick={() => { setShowCheckout(false); setPaymentLink(''); }}
                  className="w-full mt-3 py-2 text-sm text-gray-500 bg-transparent border-0 cursor-pointer hover:text-gray-700"
                >
                  סגור
                </button>
              </div>
            ) : (
              /* Form */
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">פרטי רוכש</h3>
                  <button onClick={() => setShowCheckout(false)} className="p-1 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer">
                    <X size={20} />
                  </button>
                </div>

                {/* Product summary */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-3">
                  <img src={(deal.productId as any)?.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80'} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{(deal.productId as any)?.name}</p>
                    <p className="text-sm font-bold text-green-700">₪{deal.currentPrice?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  {/* Name row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">שם פרטי <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={checkoutForm.firstName}
                        onChange={e => setCheckoutForm(f => ({ ...f, firstName: e.target.value }))}
                        placeholder="ישראל"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">שם משפחה <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={checkoutForm.lastName}
                        onChange={e => setCheckoutForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="ישראלי"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                      />
                    </div>
                  </div>
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">אימייל <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={checkoutForm.email}
                      onChange={e => setCheckoutForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="israel@example.com"
                      dir="ltr"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">טלפון <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={checkoutForm.phone}
                      onChange={e => setCheckoutForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="050-0000000"
                      dir="ltr"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                  {/* Street address */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">כתובת למשלוח <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={checkoutForm.street}
                      onChange={e => setCheckoutForm(f => ({ ...f, street: e.target.value }))}
                      placeholder="רחוב הרצל 1"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                  {/* City + Zip */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">עיר <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={checkoutForm.city}
                        onChange={e => setCheckoutForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="תל אביב"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">מיקוד</label>
                      <input
                        type="text"
                        value={checkoutForm.zip}
                        onChange={e => setCheckoutForm(f => ({ ...f, zip: e.target.value }))}
                        placeholder="6120101"
                        dir="ltr"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                      />
                    </div>
                  </div>
                  {/* Invoice name (optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">שם לחשבונית (אופציונלי)</label>
                    <input
                      type="text"
                      value={checkoutForm.invoiceName}
                      onChange={e => setCheckoutForm(f => ({ ...f, invoiceName: e.target.value }))}
                      placeholder="שם עסק / ח.פ."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <Lock size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">האשראי יאובטח אך <strong>לא יחויב</strong> עד שהיעד מושג (ChargeType 2)</p>
                </div>

                {checkoutError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {checkoutError}
                  </div>
                )}

                <button
                  onClick={handleCheckoutSubmit}
                  disabled={checkoutSubmitting}
                  className="w-full py-3.5 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 transition disabled:opacity-50 border-0 cursor-pointer flex items-center justify-center gap-2"
                >
                  {checkoutSubmitting ? 'יוצר לינק תשלום...' : '💳 צור לינק תשלום'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Instant Buy Confirmation Dialog */}
      {showInstantBuyDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">קניה מיידית במחיר מלא</h3>
            <p className="text-sm text-gray-600 mb-1">
              פעולה זו תוציא אותך מהקניה הקבוצתית ותוסיף את המוצר לעגלה במחיר המלא:
            </p>
            <p className="text-2xl font-bold text-gray-900 mb-4">
              ₪{(deal.productId || deal)?.originalPrice?.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mb-5">לא תנצל את הנחת הקבוצה, אך תקבל את המוצר מיד.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowInstantBuyDialog(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm border-0 cursor-pointer hover:bg-gray-200 transition"
              >
                ביטול
              </button>
              <button
                onClick={handleInstantBuy}
                disabled={instantBuying}
                className="flex-1 py-2.5 bg-green-700 text-white rounded-xl font-semibold text-sm border-0 cursor-pointer hover:bg-green-800 disabled:opacity-50 transition"
              >
                {instantBuying ? 'רגע...' : '✓ אישור — קנה עכשיו'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
