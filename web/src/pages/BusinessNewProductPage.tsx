import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { businessAPI } from '../lib/api';
import { PlusCircle, Trash2, Package, ArrowRight, Upload, Star, X, Image } from 'lucide-react';
import axios from 'axios';

const categories = [
  { key: 'electronics', label: 'אלקטרוניקה' },
  { key: 'fashion', label: 'אופנה' },
  { key: 'home', label: 'בית' },
  { key: 'food', label: 'מזון' },
  { key: 'health', label: 'בריאות' },
  { key: 'sports', label: 'ספורט' },
  { key: 'kids', label: 'ילדים' },
  { key: 'automotive', label: 'רכב' },
  { key: 'services', label: 'שירותים' },
  { key: 'other', label: 'אחר' },
];

export default function BusinessNewProductPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'electronics',
    originalPrice: '',
    maxBuyers: '',
    minBuyers: '',
    endDate: '',
    deliveryTerms: '',
    cancellationTerms: '',
    cancelPolicy: '',
    shippingPrice: '',
    shippingTime: '',
    cancelPolicyCustom: '',
  });
  const [images, setImages] = useState<string[]>([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      arr.forEach(f => formData.append('images', f));
      const { data } = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.urls) {
        setImages(prev => [...prev, ...data.urls]);
      }
    } catch (e) {
      alert('שגיאה בהעלאת תמונה');
    } finally {
      setUploading(false);
    }
  }, []);
  const [priceTiers, setPriceTiers] = useState([
    { minBuyers: '1', price: '' },
    { minBuyers: '25', price: '' },
    { minBuyers: '50', price: '' },
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addPriceTier = () => {
    setPriceTiers([...priceTiers, { minBuyers: '', price: '' }]);
  };

  const removePriceTier = (index: number) => {
    setPriceTiers(priceTiers.filter((_, i) => i !== index));
  };

  const updatePriceTier = (index: number, field: string, value: string) => {
    const updated = [...priceTiers];
    (updated[index] as any)[field] = value;
    setPriceTiers(updated);
  };

  const addImage = () => setImages([...images, '']);
  const removeImage = (index: number) => setImages(images.filter((_, i) => i !== index));
  const updateImage = (index: number, value: string) => {
    const updated = [...images];
    updated[index] = value;
    setImages(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resolvedCancelPolicy = formData.cancelPolicy === 'custom'
        ? formData.cancelPolicyCustom
        : formData.cancelPolicy;
      const payload = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        originalPrice: Number(formData.originalPrice),
        maxBuyers: Number(formData.maxBuyers) || undefined,
        minBuyers: Number(formData.minBuyers) || undefined,
        deliveryTerms: formData.deliveryTerms,
        cancellationTerms: formData.cancellationTerms,
        cancelPolicy: resolvedCancelPolicy,
        shippingPrice: formData.shippingPrice ? Number(formData.shippingPrice) : undefined,
        shippingTime: formData.shippingTime,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        images: images.length ? [images[featuredIndex], ...images.filter((_, i) => i !== featuredIndex)] : [],
        priceTiers: priceTiers
          .filter((t) => t.minBuyers && t.price)
          .map((t) => ({ minBuyers: Number(t.minBuyers), price: Number(t.price) })),
      };
      const { data } = await businessAPI.createProduct(payload);
      navigate('/business/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה ביצירת המוצר');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 bg-transparent border-0 cursor-pointer text-sm"
      >
        <ArrowRight size={16} />
        חזרה
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">הוספת מוצר חדש</h1>
            <p className="text-sm text-gray-500">מלאו את פרטי המוצר</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">שם המוצר</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="לדוגמה: AirPods Pro 2"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">תיאור</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="תיאור מפורט של המוצר..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">קטגוריה</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {categories.map((cat) => (
                  <option key={cat.key} value={cat.key}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">מחיר מקורי (₪)</label>
              <input
                name="originalPrice"
                type="number"
                value={formData.originalPrice}
                onChange={handleChange}
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                required
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">מקס' קונים</label>
              <input
                name="maxBuyers"
                type="number"
                value={formData.maxBuyers}
                onChange={handleChange}
                placeholder="200"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">מינ' קונים</label>
              <input
                name="minBuyers"
                type="number"
                value={formData.minBuyers}
                onChange={handleChange}
                placeholder="10"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                dir="ltr"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              📅 תאריך סיום הקניה הקבוצתית
            </label>
            <input
              name="endDate"
              type="date"
              value={formData.endDate}
              onChange={handleChange}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              required
            />
            <p className="text-xs text-gray-400 mt-1">הקניה הקבוצתית תיסגר אוטומטית בתאריך זה</p>
          </div>

          {/* Price Tiers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">מדרגות מחיר</label>
              <button
                type="button"
                onClick={addPriceTier}
                className="text-primary-600 text-xs font-medium flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                <PlusCircle size={14} />
                הוסף מדרגה
              </button>
            </div>
            <div className="space-y-2">
              {priceTiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    value={tier.minBuyers}
                    onChange={(e) => updatePriceTier(i, 'minBuyers', e.target.value)}
                    placeholder="מינ' קונים"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    dir="ltr"
                  />
                  <input
                    type="number"
                    value={tier.price}
                    onChange={(e) => updatePriceTier(i, 'price', e.target.value)}
                    placeholder="מחיר ₪"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    dir="ltr"
                  />
                  {priceTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePriceTier(i)}
                      className="p-2 text-red-400 hover:text-red-600 bg-transparent border-0 cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">תמונות (URL)</label>
              <button
                type="button"
                onClick={addImage}
                className="text-primary-600 text-xs font-medium flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                <PlusCircle size={14} />
                הוסף תמונה
              </button>
            </div>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition"
              style={{ borderColor: dragOver ? '#6366f1' : '#d1d5db', background: dragOver ? '#eef2ff' : '#f9fafb' }}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
                onChange={e => e.target.files && uploadFiles(e.target.files)} />
              {uploading ? (
                <div className="text-primary-600 font-medium">⏳ מעלה תמונות...</div>
              ) : (
                <>
                  <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                  <div className="text-sm font-medium text-gray-600">גרור תמונות לכאן או לחץ לבחירה</div>
                  <div className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — עד 10MB לתמונה, עד 10 תמונות</div>
                </>
              )}
            </div>

            {/* Image grid with featured selection */}
            {images.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Star size={12} className="text-yellow-500" /> לחץ על הכוכב לבחירת תמונה ראשית
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border-2"
                      style={{ borderColor: i === featuredIndex ? '#6366f1' : '#e5e7eb' }}>
                      <img src={img} alt="" className="w-full h-20 object-cover" />
                      <button type="button" onClick={() => setFeaturedIndex(i)}
                        className="absolute top-1 right-1 p-0.5 rounded-full border-0 cursor-pointer"
                        style={{ background: i === featuredIndex ? '#6366f1' : 'rgba(0,0,0,0.4)' }}>
                        <Star size={12} className="text-white" />
                      </button>
                      <button type="button" onClick={() => { setImages(images.filter((_,j)=>j!==i)); if(featuredIndex>=images.length-1) setFeaturedIndex(0); }}
                        className="absolute top-1 left-1 p-0.5 rounded-full border-0 cursor-pointer"
                        style={{ background: 'rgba(220,38,38,0.8)' }}>
                        <X size={12} className="text-white" />
                      </button>
                      {i === featuredIndex && (
                        <div className="absolute bottom-0 inset-x-0 text-center text-white text-xs py-0.5"
                          style={{ background: 'rgba(99,102,241,0.8)' }}>ראשית</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: Terms of Use */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-[#15803d] mb-1">תנאי שימוש</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">תנאי משלוח</label>
              <textarea
                name="deliveryTerms"
                value={formData.deliveryTerms}
                onChange={handleChange}
                rows={3}
                placeholder="לדוגמה: משלוח חינם עד הבית. המשלוח מתבצע תוך 7 ימי עסקים מרגע סגירת הקניה הקבוצתית..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">תנאי ביטול</label>
              <textarea
                name="cancellationTerms"
                value={formData.cancellationTerms}
                onChange={handleChange}
                rows={3}
                placeholder="לדוגמה: ניתן לבטל את ההזמנה עד 14 יום מקבלת המוצר. המוצר צריך להיות בשלמותו ובאריזתו המקורית..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none bg-white"
              />
            </div>
          </div>

          {/* Section: Shipping Details */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-[#15803d] mb-1">פרטי משלוח</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">מחיר משלוח (₪)</label>
                <input
                  name="shippingPrice"
                  type="number"
                  min="0"
                  value={formData.shippingPrice}
                  onChange={handleChange}
                  placeholder="0 = חינם"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">זמן משלוח</label>
                <input
                  name="shippingTime"
                  value={formData.shippingTime}
                  onChange={handleChange}
                  placeholder="3-5 ימי עסקים"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section: Cancellation Policy */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-[#15803d] mb-3">מדיניות ביטול</h3>
            <select
              name="cancelPolicy"
              value={formData.cancelPolicy}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">בחר מדיניות ביטול...</option>
              <option value="ניתן לביטול תוך 14 יום">ניתן לביטול תוך 14 יום</option>
              <option value="לא ניתן לביטול">לא ניתן לביטול</option>
              <option value="ביטול עד יום לפני">ביטול עד יום לפני</option>
              <option value="custom">טקסט מותאם אישית...</option>
            </select>
            {formData.cancelPolicy === 'custom' && (
              <textarea
                name="cancelPolicyCustom"
                value={formData.cancelPolicyCustom}
                onChange={handleChange}
                rows={2}
                placeholder="הזן מדיניות ביטול מותאמת אישית..."
                className="w-full mt-2 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none bg-white"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition disabled:opacity-50 border-0 cursor-pointer text-sm"
          >
            {loading ? 'יוצר מוצר...' : 'צור מוצר'}
          </button>
        </form>
      </div>
    </div>
  );
}
