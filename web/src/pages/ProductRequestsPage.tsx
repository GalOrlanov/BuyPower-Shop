import { useEffect, useState } from 'react';
import { productRequestsAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { MessageSquare, ThumbsUp, Send, PlusCircle } from 'lucide-react';

const categoryLabels: Record<string, string> = {
  electronics: 'אלקטרוניקה', fashion: 'אופנה', home: 'בית', food: 'מזון',
  health: 'בריאות', sports: 'ספורט', kids: 'ילדים', automotive: 'רכב',
  services: 'שירותים', other: 'אחר',
};

export default function ProductRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [commenting, setCommenting] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await productRequestsAPI.getAll({ limit: 50 });
      setRequests(data.requests || data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (id: string) => {
    if (!user) return;
    try {
      await productRequestsAPI.vote(id);
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await productRequestsAPI.create({ title: newTitle, description: newDesc, category: newCategory });
      setNewTitle('');
      setNewDesc('');
      setShowForm(false);
      fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async (id: string) => {
    if (!commentText.trim()) return;
    try {
      await productRequestsAPI.comment(id, commentText);
      setCommentText('');
      setCommenting(null);
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">בקשות מוצרים</h1>
          <p className="text-gray-500 text-sm mt-1">הציעו מוצרים שתרצו לראות בקניה קבוצתית</p>
        </div>
        {user && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition border-0 cursor-pointer"
          >
            <PlusCircle size={16} />
            בקשה חדשה
          </button>
        )}
      </div>

      {/* New Request Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">בקשת מוצר חדשה</h3>
          <form onSubmit={handleSubmitRequest} className="space-y-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="שם המוצר המבוקש"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="תיאור (אופציונלי)"
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition border-0 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'שולח...' : 'שלח בקשה'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition border-0 cursor-pointer"
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">אין בקשות עדיין</h3>
          <p className="text-sm text-gray-400 mt-1">היו הראשונים להציע מוצר!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => (
            <div key={req._id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleVote(req._id)}
                  className={`flex flex-col items-center p-2 rounded-lg transition border-0 cursor-pointer min-w-[48px] ${
                    user ? 'hover:bg-primary-50' : 'opacity-50'
                  }`}
                  disabled={!user}
                >
                  <ThumbsUp size={18} className="text-primary-500" />
                  <span className="text-sm font-bold text-gray-900 mt-0.5">{req.voteCount}</span>
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{req.title}</h3>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {categoryLabels[req.category] || req.category}
                    </span>
                  </div>
                  {req.description && <p className="text-xs text-gray-500 mb-2">{req.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{req.userId?.firstName} {req.userId?.lastName}</span>
                    <button
                      onClick={() => setCommenting(commenting === req._id ? null : req._id)}
                      className="flex items-center gap-1 hover:text-primary-600 bg-transparent border-0 cursor-pointer text-xs text-gray-400"
                    >
                      <MessageSquare size={12} />
                      {req.comments?.length || 0} תגובות
                    </button>
                  </div>

                  {/* Comments */}
                  {commenting === req._id && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      {req.comments?.map((c: any, i: number) => (
                        <div key={i} className="text-xs text-gray-600 mb-2">
                          <span className="font-medium">{c.userId?.firstName || 'משתמש'}: </span>
                          {c.text}
                        </div>
                      ))}
                      {user && (
                        <div className="flex gap-2 mt-2">
                          <input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="הוסיפו תגובה..."
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleComment(req._id)}
                          />
                          <button
                            onClick={() => handleComment(req._id)}
                            className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition border-0 cursor-pointer"
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
