import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2, ShoppingCart, ArrowRight, X, Loader2,
  CreditCard, ExternalLink, Clock, Users, CheckCircle2, MapPin, Calendar,
} from 'lucide-react';
import { useCart, getCurrentPrice } from '../contexts/CartContext';
import type { CartItem } from '../contexts/CartContext';
import { groupPurchasesAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// ─── Reusable form field ──────────────────────────────────────────────────────
const Field = ({ label, type = 'text', placeholder, value, onChange }: {
  label: string; type?: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: 'right' }}>{label}</label>
    <input
      type={type} required value={value} onChange={onChange} placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 text-right"
      dir={type === 'email' || type === 'tel' ? 'ltr' : 'rtl'}
      style={{ fontFamily: 'inherit', fontSize: '1rem' }}
    />
  </div>
);

// ─── Countdown timer component ────────────────────────────────────────────────
function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('הסתיים'); return; }
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      if (days > 0) setTimeLeft(`${days} ימים ${hours} שעות`);
      else if (hours > 0) setTimeLeft(`${hours} שעות ${minutes} דקות`);
      else setTimeLeft(`${minutes} דקות`);
    };
    calc();
    const interval = setInterval(calc, 60_000);
    return () => clearInterval(interval);
  }, [endDate]);

  return <span>{timeLeft}</span>;
}

// ─── Group purchase card ──────────────────────────────────────────────────────
function GroupPurchaseCard({
  item,
  onRemove,
  onJoin,
  isJoining,
  joinError,
  alreadyJoined = false,
}: {
  item: CartItem;
  onRemove: () => void;
  onJoin: () => void;
  isJoining: boolean;
  joinError: string;
  alreadyJoined?: boolean;
}) {
  const price = getCurrentPrice(item.priceTiers, item.currentParticipants);
  const savings = Math.round(((item.originalPrice - price) / item.originalPrice) * 100);
  const progress = item.targetParticipants
    ? Math.min((item.currentParticipants / item.targetParticipants) * 100, 100)
    : 0;
  const minReached = item.minParticipants
    ? item.currentParticipants >= item.minParticipants
    : false;

  return (
    <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-4">
      <div className="flex items-start gap-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
          <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 mb-1 leading-tight">{item.productName}</h3>
            <button
              onClick={onRemove}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition bg-transparent border-0 cursor-pointer flex-shrink-0"
              title="הסר מהעגלה"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-bold text-green-700">₪{price.toLocaleString()}</span>
            {savings > 0 && (
              <>
                <span className="text-sm text-gray-400 line-through">₪{item.originalPrice.toLocaleString()}</span>
                <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">-{savings}%</span>
              </>
            )}
          </div>

          {/* Participant progress bar */}
          {item.targetParticipants ? (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {item.currentParticipants} מתוך {item.targetParticipants} משתתפים
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-2">
              {item.currentParticipants} משתתפים עד כה
            </p>
          )}

          {/* Countdown */}
          {item.endDate && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <Clock size={12} className="flex-shrink-0" />
              <span>נותר: </span>
              <CountdownTimer endDate={item.endDate} />
            </div>
          )}

          {/* Pickup Point */}
          {(item as any).pickupPointId && (
            <div className="flex flex-wrap gap-3 mt-1 mb-1">
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <MapPin size={11} />
                <span className="font-medium">{(item as any).pickupPointId.name}</span>
                {(item as any).pickupPointId.address && (
                  <span className="text-gray-400">· {(item as any).pickupPointId.address}</span>
                )}
              </div>
              {(item as any).pickupPointId.collectionDate && (
                <div className="flex items-center gap-1 text-xs text-blue-500">
                  <Calendar size={11} />
                  <span>{new Date((item as any).pickupPointId.collectionDate).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  {(item as any).pickupPointId.collectionTimeFrom && (item as any).pickupPointId.collectionTimeTo && (
                    <span dir="ltr" className="mr-1">
                      {(item as any).pickupPointId.collectionTimeFrom}–{(item as any).pickupPointId.collectionTimeTo}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Status badge */}
          <div
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              minReached
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {minReached ? (
              <><CheckCircle2 size={12} /> הושגה מינימום</>
            ) : (
              <><Users size={12} /> ממתין לחברים נוספים</>
            )}
          </div>
        </div>
      </div>

      {joinError && (
        <p className="text-red-500 text-sm mt-2 text-center">{joinError}</p>
      )}

      {/* Join button — hide if already a participant */}
      {alreadyJoined ? (
        <div className="w-full mt-3 py-3 rounded-xl text-sm flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 font-semibold">
          <CheckCircle2 size={16} />
          הצטרפת לרכישה הקבוצתית ✓
        </div>
      ) : (
        <button
          onClick={onJoin}
          disabled={isJoining}
          className="w-full mt-3 py-3 rounded-xl font-semibold transition border-0 cursor-pointer text-sm flex items-center justify-center gap-2 disabled:opacity-70 text-white"
          style={{ background: '#15803d' }}
        >
          {isJoining
            ? <><Loader2 size={16} className="animate-spin" />מצטרף...</>
            : <><Users size={16} />הצטרף לרכישה קבוצתית</>}
        </button>
      )}

      {/* Credit hold note */}
      {!alreadyJoined && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          💳 החיוב יתבצע רק כשהקניה הקבוצתית תושלם
        </p>
      )}
    </div>
  );
}

// ─── Contact form interface ───────────────────────────────────────────────────
interface ContactForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  street: string;
  houseNumber: string;
}

// ─── Main cart page ───────────────────────────────────────────────────────────
export default function CartPage() {
  const { items, removeItem, clearCart, itemCount } = useCart();
  const { user } = useAuth();
  const [myGpIds, setMyGpIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    groupPurchasesAPI.getMy().then(({ data }) => {
      const ids = new Set<string>(data.map((p: any) => p.groupPurchaseId?._id || p.groupPurchaseId));
      setMyGpIds(ids);
    }).catch(() => {});
  }, [user?._id]);

  // Split items
  const regularItems = items.filter(item => !item.isGroupPurchase);
  const groupItems = items.filter(item => item.isGroupPurchase);

  // Totals
  const regularTotal = regularItems.reduce((sum, item) => {
    return sum + getCurrentPrice(item.priceTiers, item.currentParticipants) * item.quantity;
  }, 0);

  // Regular checkout state
  const [step, setStep] = useState<'cart' | 'form' | 'payment'>('cart');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [growUrl, setGrowUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>({
    firstName: '', lastName: '', email: '', phone: '',
    city: '', street: '', houseNumber: '',
  });

  // Group purchase join state
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinErrors, setJoinErrors] = useState<Record<string, string>>({});

  const set = (field: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const missing = [];
    if (!form.firstName.trim()) missing.push('שם פרטי');
    if (!form.lastName.trim()) missing.push('שם משפחה');
    if (!form.phone.trim()) missing.push('טלפון');
    if (missing.length) { setError('נא למלא שדות חובה: ' + missing.join(', ')); return; }
    setLoading(true);
    try {
      const { data } = await axios.post('/api/shop/payment/create', {
        title: `BuyPower — ${regularItems.length} פריטים`,
        full_name: `${form.firstName} ${form.lastName}`,
        phone: form.phone.replace(/[^0-9]/g, ''),
        email: form.email,
        invoice_name: `${form.firstName} ${form.lastName}`,
        charge_type: 'Regular Charge',
        payment_type: 'Payments',
        max_or_custom: 'Max Payments',
        products: regularItems.map(item => ({
          catalog_number: item.groupPurchaseId,
          name: item.productName,
          price: Math.round(getCurrentPrice(item.priceTiers, item.currentParticipants)),
          quantity: item.quantity,
          minimum_quantity: 1,
          productUrl: item.image || '',
          vatType: 1,
        })),
      });

      if (data.paymentUrl) {
        setGrowUrl(data.paymentUrl);
        setStep('payment');
        window.open(data.paymentUrl, 'grow_payment', 'width=560,height=720,top=80,left=300,scrollbars=yes,resizable=yes');
      } else {
        setError('שגיאה ביצירת קישור תשלום — נסה שוב');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה בשרת, נסה שוב');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (item: CartItem) => {
    setJoiningId(item.groupPurchaseId);
    setJoinErrors(prev => ({ ...prev, [item.groupPurchaseId]: '' }));
    try {
      await groupPurchasesAPI.join(item.groupPurchaseId, item.quantity);
      removeItem(item.groupPurchaseId);
    } catch (err: any) {
      setJoinErrors(prev => ({
        ...prev,
        [item.groupPurchaseId]: err.response?.data?.error || 'שגיאה בהצטרפות, נסה שוב',
      }));
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/deals" className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm no-underline">
          <ArrowRight size={16} />
          המשך קנייה
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <ShoppingCart size={24} className="text-primary-600" />
        עגלת הקניות
        {itemCount > 0 && (
          <span className="bg-primary-100 text-primary-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {itemCount} פריטים
          </span>
        )}
      </h1>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <ShoppingCart size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg mb-4">העגלה שלך ריקה</p>
          <Link to="/deals" className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition no-underline text-sm">
            לקניות קבוצתיות
          </Link>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Regular items section ── */}
          {regularItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart size={18} className="text-gray-600" />
                <h2 className="text-lg font-bold text-gray-800">פריטים רגילים</h2>
                <span className="bg-gray-100 text-gray-600 text-sm font-medium px-2.5 py-0.5 rounded-full">
                  {regularItems.length} פריטים
                </span>
              </div>

              <div className="space-y-4">
                {regularItems.map(item => {
                  const price = getCurrentPrice(item.priceTiers, item.currentParticipants);
                  const savings = Math.round(((item.originalPrice - price) / item.originalPrice) * 100);
                  return (
                    <div key={item.groupPurchaseId} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                        <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 truncate">{item.productName}</h3>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-bold text-primary-600">₪{price.toLocaleString()}</span>
                          {savings > 0 && (
                            <>
                              <span className="text-sm text-gray-400 line-through">₪{item.originalPrice.toLocaleString()}</span>
                              <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">-{savings}%</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">מחיר עדכני ({item.currentParticipants} משתתפים)</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">כמות: {item.quantity}</span>
                        <button onClick={() => removeItem(item.groupPurchaseId)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition bg-transparent border-0 cursor-pointer">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Regular checkout summary */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">סה"כ פריטים רגילים</span>
                  <span className="text-2xl font-bold text-gray-900">₪{regularTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-4 text-sm text-gray-500 border-t pt-2">
                  <span>🚚 משלוח</span>
                  <span>יחושב בקופה לפי עסק</span>
                </div>
                <button
                  onClick={() => setStep('form')}
                  className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition border-0 cursor-pointer text-lg flex items-center justify-center gap-2"
                >
                  <CreditCard size={20} />לתשלום
                </button>
                <button onClick={clearCart} className="w-full mt-2 py-2.5 text-gray-500 hover:text-red-500 text-sm bg-transparent border-0 cursor-pointer">
                  ריקון עגלה
                </button>
              </div>
            </div>
          )}

          {/* ── Group purchases section ── */}
          {groupItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-green-700" />
                <h2 className="text-lg font-bold text-gray-800">רכישות קבוצתיות</h2>
                <span className="bg-green-100 text-green-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
                  {groupItems.length} פריטים
                </span>
              </div>

              {/* Info banner */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-800 flex items-start gap-2">
                <span className="mt-0.5">ℹ️</span>
                <span>
                  רכישות קבוצתיות <strong>לא נגבות מיידית</strong> — מתבצע שמירת אשראי בלבד.
                  החיוב יתבצע רק לאחר שמספר המינימום של המשתתפים יושג.
                </span>
              </div>

              <div className="space-y-4">
                {groupItems.map(item => (
                  <GroupPurchaseCard
                    key={item.groupPurchaseId}
                    item={item}
                    onRemove={() => removeItem(item.groupPurchaseId)}
                    onJoin={() => handleJoin(item)}
                    isJoining={joiningId === item.groupPurchaseId}
                    joinError={joinErrors[item.groupPurchaseId] || ''}
                    alreadyJoined={myGpIds.has(item.groupPurchaseId)}
                  />
                ))}
              </div>

              {/* Clear group purchases only */}
              {regularItems.length === 0 && (
                <button onClick={clearCart} className="w-full mt-4 py-2.5 text-gray-500 hover:text-red-500 text-sm bg-transparent border-0 cursor-pointer">
                  ריקון עגלה
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Contact Form Modal (regular items checkout) ── */}
      {step === 'form' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row"
            style={{ width: '820px', maxWidth: '97vw', maxHeight: '92vh' }}>
            <button onClick={() => { setStep('cart'); setError(''); }}
              className="absolute top-3 left-3 text-gray-400 hover:text-gray-700 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow border-0 cursor-pointer z-10">
              <X size={16} />
            </button>

            {/* Order summary sidebar */}
            <div className="hidden md:flex flex-shrink-0 overflow-y-auto bg-gray-50 border-l border-gray-200 p-6 flex-col" style={{ width: '260px' }}>
              <h3 className="font-bold text-base text-gray-800 mb-4 flex items-center gap-2">
                <ShoppingCart size={16} className="text-primary-600" /> סיכום
              </h3>
              <div className="space-y-3">
                {regularItems.map(item => {
                  const price = getCurrentPrice(item.priceTiers, item.currentParticipants);
                  return (
                    <div key={item.groupPurchaseId} className="flex items-center gap-2">
                      <img src={item.image} alt={item.productName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-gray-800 truncate">{item.productName}</div>
                        <div className="text-xs text-gray-400">×{item.quantity}</div>
                        <div className="text-primary-600 font-bold text-sm">₪{(price * item.quantity).toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between font-bold">
                <span>סה"כ</span>
                <span className="text-primary-600">₪{regularTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Mobile order total bar */}
            <div className="flex md:hidden items-center justify-between bg-gray-50 border-b border-gray-200 px-5 py-3 mt-8">
              <span className="font-bold text-gray-700 text-sm flex items-center gap-1"><ShoppingCart size={14} /> {regularItems.length} פריטים</span>
              <span className="font-bold text-primary-600">סה"כ: ₪{regularTotal.toLocaleString()}</span>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-5 md:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">פרטי הזמנה</h2>
                <p className="text-gray-500 text-sm mt-1">מלא את הפרטים לפני המעבר לתשלום</p>
              </div>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="שם פרטי" placeholder="ישראל" value={form.firstName} onChange={set('firstName')} />
                  <Field label="שם משפחה" placeholder="ישראלי" value={form.lastName} onChange={set('lastName')} />
                </div>
                <Field label="אימייל" type="email" placeholder="israel@example.com" value={form.email} onChange={set('email')} />
                <Field label="טלפון" type="tel" placeholder="050-0000000" value={form.phone} onChange={set('phone')} />
                <div className="pt-1">
                  <div className="text-sm font-semibold text-gray-700 mb-3">📍 כתובת למשלוח</div>
                  <div className="space-y-3">
                    <Field label="עיר" placeholder="תל אביב" value={form.city} onChange={set('city')} />
                    <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                      <div className="col-span-2 sm:col-span-2">
                        <Field label="רחוב" placeholder="רוטשילד" value={form.street} onChange={set('street')} />
                      </div>
                      <Field label="מספר בית" placeholder="10" value={form.houseNumber} onChange={set('houseNumber')} />
                    </div>
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-4 text-white rounded-xl font-semibold transition border-0 cursor-pointer text-lg flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                  {loading ? <><Loader2 size={20} className="animate-spin" />יוצר קישור תשלום...</> : '💳 המשך לתשלום מאובטח'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment opened modal ── */}
      {step === 'payment' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl p-10 text-center relative" style={{ maxWidth: '420px', width: '100%' }}>
            <button onClick={() => setStep('cart')}
              className="absolute top-3 left-3 text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer">
              <X size={20} />
            </button>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              <CreditCard size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">דף התשלום נפתח!</h2>
            <p className="text-gray-500 mb-6">השלם את התשלום בחלון שנפתח.<br />לאחר תשלום מוצלח תקבל אישור.</p>
            <button
              onClick={() => window.open(growUrl!, 'grow_payment', 'width=560,height=720,top=80,left=300,scrollbars=yes')}
              className="w-full py-3 text-white rounded-xl font-semibold border-0 cursor-pointer flex items-center justify-center gap-2 mb-3"
              style={{ background: '#1d4ed8' }}>
              <ExternalLink size={18} /> פתח שוב את דף התשלום
            </button>
            <a href={growUrl!} target="_blank" rel="noreferrer" className="text-sm text-gray-400 underline">
              פתח בלשונית חדשה
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
