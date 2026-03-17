import { useSearchParams, Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function OrderFailedPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #fdf4ff 100%)' }}>
      <div className="max-w-md w-full">
        <div className="rounded-3xl overflow-hidden shadow-2xl bg-white">
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} className="p-8 text-center">
            <div className="text-6xl mb-3">🛒</div>
            <h1 className="text-white text-3xl font-extrabold">BuyPower</h1>
          </div>

          {/* Failed banner */}
          <div className="bg-red-500 p-6 text-center">
            <XCircle size={52} className="mx-auto text-white mb-2" />
            <h2 className="text-white text-2xl font-bold">התשלום נכשל</h2>
            {orderId && <p className="text-red-100 text-sm mt-1">הזמנה: #{orderId}</p>}
          </div>

          {/* Body */}
          <div className="p-8">
            <p className="text-gray-600 text-center mb-6">
              משהו השתבש בתהליך התשלום. ניתן לנסות שוב או לפנות לתמיכה.
            </p>

            <Link
              to="/cart"
              className="block w-full py-4 text-center text-white font-semibold rounded-2xl no-underline transition hover:opacity-90 mb-3"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              נסה שוב
            </Link>

            <a
              href="mailto:support@buypower.co.il"
              className="block w-full py-3 text-center text-indigo-600 font-semibold rounded-2xl no-underline border-2 border-indigo-200 hover:bg-indigo-50 transition"
            >
              צור קשר עם תמיכה
            </a>

            <div className="text-center mt-6 text-gray-400 text-xs">
              <p>support@buypower.co.il</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
