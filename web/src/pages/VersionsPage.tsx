import { useEffect, useState } from 'react';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { GitBranch, Plus, RotateCcw, Tag, Clock, User } from 'lucide-react';

interface Version {
  _id: string;
  version: string;
  type: 'major' | 'minor' | 'patch';
  changelog: string;
  commitHash: string;
  deployed_by: string;
  createdAt: string;
}

const typeBadgeColor = {
  major: 'bg-red-100 text-red-700',
  minor: 'bg-blue-100 text-blue-700',
  patch: 'bg-green-100 text-green-700',
};

export default function VersionsPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [current, setCurrent] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'patch' as 'major'|'minor'|'patch', changelog: '' });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [vRes, cRes] = await Promise.all([
        api.get('/versions'),
        api.get('/versions/current'),
      ]);
      setVersions(vRes.data.versions || []);
      setCurrent(cRes.data.version);
    } catch (e) {
      setError('Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.changelog.trim()) { setError('נא להזין changelog'); return; }
    setCreating(true);
    setError('');
    try {
      await api.post('/versions', form);
      setShowModal(false);
      setForm({ type: 'patch', changelog: '' });
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create version');
    } finally {
      setCreating(false);
    }
  };

  const handleRevert = async (v: Version) => {
    if (!window.confirm(`האם אתה בטוח שברצונך לחזור לגרסה ${v.version}?\nפעולה זו תאפס את המערכת לגרסה ישנה יותר.`)) return;
    setReverting(v._id);
    setError('');
    try {
      await api.post(`/versions/${v._id}/revert`);
      alert(`הוחזר בהצלחה לגרסה ${v.version}`);
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to revert');
    } finally {
      setReverting(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <GitBranch size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ניהול גרסאות</h1>
            <p className="text-gray-500 text-sm">Version Management System</p>
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(''); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
        >
          <Plus size={16} /> גרסה חדשה
        </button>
      </div>

      {current && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-6 mb-6">
          <div className="text-sm text-indigo-500 font-medium mb-1">גרסה נוכחית</div>
          <div className="text-4xl font-bold text-indigo-700 mb-2">v{current.version}</div>
          <div className="text-gray-600 text-sm mb-3">{current.changelog}</div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Tag size={12} /> {current.commitHash}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(current.createdAt).toLocaleDateString('he-IL')}</span>
            <span className="flex items-center gap-1"><User size={12} /> {current.deployed_by}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      <div className="space-y-3">
        {versions.map((v, i) => (
          <div key={v._id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-gray-900">v{v.version}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColor[v.type]}`}>{v.type}</span>
                {i === 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">נוכחית</span>}
              </div>
              <p className="text-gray-600 text-sm mb-2">{v.changelog}</p>
              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Tag size={11} /> {v.commitHash}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {new Date(v.createdAt).toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="flex items-center gap-1"><User size={11} /> {v.deployed_by}</span>
              </div>
            </div>
            {i !== 0 && (
              <button
                onClick={() => handleRevert(v)}
                disabled={reverting === v._id}
                className="flex items-center gap-1 text-xs border border-orange-200 text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition disabled:opacity-50"
              >
                <RotateCcw size={13} /> {reverting === v._id ? 'מחזיר...' : 'חזור'}
              </button>
            )}
          </div>
        ))}
        {versions.length === 0 && (
          <div className="text-center text-gray-400 py-12">אין גרסאות עדיין</div>
        )}
      </div>

      {/* Create Version Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">יצירת גרסה חדשה</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">סוג גרסה</label>
              <div className="grid grid-cols-3 gap-2">
                {(['major', 'minor', 'patch'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${form.type === t ? typeBadgeColor[t] + ' border-current' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {form.type === 'major' && 'שינוי גדול - major.0.0'}
                {form.type === 'minor' && 'פיצ\'ר חדש - x.minor.0'}
                {form.type === 'patch' && 'תיקון באג - x.x.patch'}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Changelog</label>
              <textarea
                value={form.changelog}
                onChange={e => setForm(f => ({ ...f, changelog: e.target.value }))}
                placeholder="תאר את השינויים בגרסה זו..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setError(''); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                ביטול
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {creating ? 'יוצר...' : 'צור גרסה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
