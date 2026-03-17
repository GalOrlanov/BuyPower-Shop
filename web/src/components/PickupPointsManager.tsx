import { useEffect, useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, Check, X, Clock, Calendar } from 'lucide-react';
import { businessAPI } from '../lib/api';

interface PickupPoint {
  _id: string;
  name: string;
  address: string;
  collectionDate: string | null;
  collectionTimeFrom: string;
  collectionTimeTo: string;
  isActive: boolean;
}

interface PickupForm {
  name: string;
  address: string;
  collectionDate: string;
  collectionTimeFrom: string;
  collectionTimeTo: string;
}

const emptyForm: PickupForm = {
  name: '',
  address: '',
  collectionDate: '',
  collectionTimeFrom: '',
  collectionTimeTo: '',
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PickupPointsManager() {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PickupForm>(emptyForm);
  const [editForm, setEditForm] = useState<PickupForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await businessAPI.getPickupPoints();
      setPoints(res.data);
    } catch {
      setError('שגיאה בטעינת נקודות איסוף');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('יש להזין שם לנקודת האיסוף'); return; }
    setSaving(true); setError('');
    try {
      await businessAPI.createPickupPoint({
        ...form,
        collectionDate: form.collectionDate || null,
      });
      setForm(emptyForm);
      setShowCreate(false);
      await load();
    } catch {
      setError('שגיאה ביצירת נקודת איסוף');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: PickupPoint) => {
    setEditingId(p._id);
    setEditForm({
      name: p.name,
      address: p.address || '',
      collectionDate: p.collectionDate ? p.collectionDate.split('T')[0] : '',
      collectionTimeFrom: p.collectionTimeFrom || '',
      collectionTimeTo: p.collectionTimeTo || '',
    });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) { setError('יש להזין שם'); return; }
    setSaving(true); setError('');
    try {
      await businessAPI.updatePickupPoint(id, {
        ...editForm,
        collectionDate: editForm.collectionDate || null,
      });
      setEditingId(null);
      await load();
    } catch {
      setError('שגיאה בעדכון נקודת איסוף');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('למחוק את נקודת האיסוף? הפעולה תנתק אותה מכל הרכישות הקבוצתיות.')) return;
    try {
      await businessAPI.deletePickupPoint(id);
      await load();
    } catch {
      setError('שגיאה במחיקה');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 mb-6">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">נקודות איסוף</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {points.length} נקודות
          </span>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(''); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-xs font-medium rounded-xl hover:bg-primary-700 transition cursor-pointer border-0"
        >
          <Plus size={14} />
          הוסף נקודה
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="p-4 bg-primary-50 border-b border-primary-100">
          <div className="text-sm font-semibold text-primary-700 mb-3">➕ נקודת איסוף חדשה</div>
          <PickupForm form={form} onChange={setForm} />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition disabled:opacity-50 cursor-pointer border-0"
            >
              <Check size={14} />
              {saving ? 'שומר...' : 'צור'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setForm(emptyForm); setError(''); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
            >
              <X size={14} />
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="p-6 text-center text-gray-400 text-sm">טוען...</div>
      ) : points.length === 0 ? (
        <div className="p-8 text-center">
          <MapPin size={36} className="mx-auto text-gray-200 mb-2" />
          <p className="text-gray-400 text-sm">אין נקודות איסוף עדיין</p>
          <p className="text-gray-300 text-xs mt-1">הוסף נקודת איסוף ראשונה למעלה</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {points.map((point) => (
            <div key={point._id} className="p-4">
              {editingId === point._id ? (
                /* ── Edit mode ── */
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">✏️ עריכת נקודת איסוף</div>
                  <PickupForm form={editForm} onChange={setEditForm} />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleUpdate(point._id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition disabled:opacity-50 cursor-pointer border-0"
                    >
                      <Check size={14} />
                      {saving ? 'שומר...' : 'שמור'}
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setError(''); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
                    >
                      <X size={14} />
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin size={16} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{point.name}</span>
                      {!point.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">לא פעיל</span>
                      )}
                    </div>
                    {point.address && (
                      <div className="text-xs text-gray-500 mt-0.5">{point.address}</div>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar size={12} className="text-primary-400" />
                        <span>יום איסוף: </span>
                        <span className="font-medium text-gray-700">{formatDate(point.collectionDate)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={12} className="text-primary-400" />
                        <span>שעות: </span>
                        <span className="font-medium text-gray-700" dir="ltr">
                          {point.collectionTimeFrom && point.collectionTimeTo
                            ? `${point.collectionTimeFrom} – ${point.collectionTimeTo}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(point)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition cursor-pointer border-0 bg-transparent"
                      title="ערוך"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(point._id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer border-0 bg-transparent"
                      title="מחק"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared form fields ────────────────────────────────────────────────────────
function PickupForm({
  form,
  onChange,
}: {
  form: PickupForm;
  onChange: (f: PickupForm) => void;
}) {
  const set = (field: keyof PickupForm, value: string) =>
    onChange({ ...form, [field]: value });

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">שם נקודת האיסוף *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="למשל: חנות תל אביב"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">כתובת</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="רחוב, עיר"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <Calendar size={11} className="inline ml-1" />
            יום איסוף
          </label>
          <input
            type="date"
            value={form.collectionDate}
            onChange={(e) => set('collectionDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <Clock size={11} className="inline ml-1" />
            שעת התחלה
          </label>
          <input
            type="time"
            value={form.collectionTimeFrom}
            onChange={(e) => set('collectionTimeFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <Clock size={11} className="inline ml-1" />
            שעת סיום
          </label>
          <input
            type="time"
            value={form.collectionTimeTo}
            onChange={(e) => set('collectionTimeTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            dir="ltr"
          />
        </div>
      </div>
    </div>
  );
}
