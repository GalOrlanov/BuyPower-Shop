import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, ShoppingBag } from 'lucide-react';
import axios from 'axios';

interface Order {
  _id: string;
  totalAmount: number;
  items: Array<{ productName?: string; name?: string; quantity: number; price: number }>;
  status: string;
}

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (orderId) {
      axios.get(`/api/orders/${orderId}`)
        .then(r => setOrder(r.data.order))
        .catch(() => {});
    }
  }, [orderId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)' }}>
      <div className="max-w-lg w-full">
        {/* Header card */}
        <div className="rounded-3xl overflow-hidden shadow-2xl">
          {/* Gradient header */}
          <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} className="p-8 text-center">
            <div className="text-6xl mb-3">🛒</div>
            <h1 className="text-white text-3xl font-extrabold">BuyPower</h1>
            <p className="text-purple-200 mt-1 text-sm">הפלטפורמה המובילה לקניות קבוצתיות</p>
          </div>

          {/* Success banner */}
          <div className="bg-emerald-500 p-6 text-center">
            <CheckCircle size={52} className="mx-auto text-white mb-2" />
            <h2 className="text-white text-2xl font-bold">הזמנתך התקבלה בהצלחה!</h2>
            {orderId && <p className="text-emerald-100 text-sm mt-1">מספר הזמנה: #{orderId}</p>}
          </div>

          {/* Body */}
          <div className="bg-white p-8">
            {order ? (
              <>
                <h3 className="text-gray-700 font-semibold mb-4">פרטי ההזמנה</h3>
                <div className="space-y-2 mb-6">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-700">{item.name || item.productName || 'מוצר'}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm">x{item.quantity}</span>
                        <span className="font-bold text-indigo-600">₪{item.price?.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mb-6 pt-2">
                  <span className="font-bold text-lg text-gray-800">סה"כ לתשלום:</span>
                  <span className="text-2xl font-extrabold text-indigo-600">₪{order.totalAmount?.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <ShoppingBag size={40} className="mx-auto text-indigo-300 mb-3" />
                <p className="text-gray-500">ההזמנה שלך נקלטה במערכת ✅</p>
              </div>
            )}

            {/* Trust banner */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 text-center">
              <p className="text-green-800 text-sm">🛡️ הקנייה שלך מוגנת — אם הקבוצה לא תמלא, הכסף יחזור אוטומטית</p>
            </div>

            <Link
              to="/"
              className="block w-full py-4 text-center text-white font-semibold rounded-2xl no-underline transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              חזרה לדף הבית
            </Link>

            <div className="text-center mt-6 text-gray-400 text-xs">
              <p>BuyPower — חוסכים יחד, מרוויחים יחד</p>
              <p className="mt-1">support@buypower.co.il</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
