import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI, referralsAPI } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { User, Save, Copy, Check, Gift, Eye, TrendingDown } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    location: '',
  });
  const [savings, setSavings] = useState(0);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        location: user.location || '',
      });
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [savingsRes, referralRes, recentRes] = await Promise.all([
        usersAPI.getSavings().catch(() => ({ data: { totalSavings: 0 } })),
        referralsAPI.getStats().catch(() => ({ data: null })),
        usersAPI.getRecentlyViewed().catch(() => ({ data: [] })),
      ]);
      setSavings(savingsRes.data.totalSavings || 0);
      setReferralStats(referralRes.data);
      setRecentlyViewed(recentRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await usersAPI.updateMe(formData);
      await refreshUser();
      setMessage('הפרופיל עודכן בהצלחה');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'שגיאה בעדכון');
    } finally {
      setSaving(false);
    }
  };

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || !user) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">הפרופיל שלי</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-accent-50 text-accent-600 rounded-lg flex items-center justify-center">
              <TrendingDown size={16} />
            </div>
            <span className="text-sm text-gray-500">סה"כ חיסכון</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₪{savings.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
              <Gift size={16} />
            </div>
            <span className="text-sm text-gray-500">הפניות</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{referralStats?.totalReferrals || 0}</p>
        </div>
      </div>

      {/* Referral Code */}
      <div className="bg-gradient-to-bl from-primary-50 to-accent-50 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">קוד ההפניה שלך</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white rounded-lg px-4 py-2 text-sm font-mono font-bold text-primary-700 border border-primary-200" dir="ltr">
            {user.referralCode}
          </div>
          <button
            onClick={copyReferralCode}
            className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition border-0 cursor-pointer"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'הועתק!' : 'העתק'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">שתפו את הקוד עם חברים וקבלו בונוס על כל הפניה מוצלחת</p>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">עריכת פרטים</h2>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${
            message.includes('שגיאה') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-accent-50 text-accent-700 border border-accent-200'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">שם פרטי</label>
              <input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">שם משפחה</label>
              <input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">טלפון</label>
            <input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">מיקום</label>
            <input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition border-0 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </form>
      </div>

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye size={18} />
            נצפו לאחרונה
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentlyViewed.map((product: any) => (
              <div key={product._id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                <img
                  src={product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=60'}
                  alt={product.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-[11px] text-gray-500">₪{product.originalPrice?.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
