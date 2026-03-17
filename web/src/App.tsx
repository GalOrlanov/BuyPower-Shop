import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DealsPage from './pages/DealsPage';
import DealDetailPage from './pages/DealDetailPage';
import ProductsPage from './pages/ProductsPage';
import MyPurchasesPage from './pages/MyPurchasesPage';
import NotificationsPage from './pages/NotificationsPage';
import ProductRequestsPage from './pages/ProductRequestsPage';
import ProfilePage from './pages/ProfilePage';
import BusinessDashboardPage from './pages/BusinessDashboardPage';
import BusinessProductsPage from './pages/BusinessProductsPage';
import BusinessNewProductPage from './pages/BusinessNewProductPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminBusinessesPage from './pages/AdminBusinessesPage';
import AdminProductsPage from './pages/AdminProductsPage';
import VersionsPage from './pages/VersionsPage';
import AdminPaymentsPage from './pages/AdminPaymentsPage';
import CartPage from './pages/CartPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderFailedPage from './pages/OrderFailedPage';
import LoadingSpinner from './components/LoadingSpinner';
import type { ReactNode } from 'react';

function ProtectedRoute({ children, role }: { children: ReactNode; role?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role && user.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <CartProvider>
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { direction: 'rtl' } }} />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/deals/:id" element={<DealDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/order/success" element={<OrderSuccessPage />} />
            <Route path="/order/failed" element={<OrderFailedPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<DealDetailPage />} />
            <Route path="/requests" element={<ProductRequestsPage />} />
            <Route
              path="/my-purchases"
              element={<ProtectedRoute><MyPurchasesPage /></ProtectedRoute>}
            />
            <Route
              path="/notifications"
              element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>}
            />
            <Route
              path="/profile"
              element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
            />
            <Route
              path="/business/dashboard"
              element={<ProtectedRoute role="business"><BusinessDashboardPage /></ProtectedRoute>}
            />
            <Route
              path="/business/products"
              element={<ProtectedRoute role="business"><BusinessProductsPage /></ProtectedRoute>}
            />
            <Route
              path="/business/new-product"
              element={<ProtectedRoute role="business"><BusinessNewProductPage /></ProtectedRoute>}
            />
            {/* Admin Routes */}
            <Route
              path="/admin"
              element={<ProtectedRoute role="admin"><AdminDashboardPage /></ProtectedRoute>}
            />
            <Route
              path="/admin/businesses"
              element={<ProtectedRoute role="admin"><AdminBusinessesPage /></ProtectedRoute>}
            />
            <Route
              path="/admin/products"
              element={<ProtectedRoute role="admin"><AdminProductsPage /></ProtectedRoute>}
            />
            <Route
              path="/admin/versions"
              element={<ProtectedRoute role="admin"><VersionsPage /></ProtectedRoute>}
            />
            <Route
              path="/admin/payments"
              element={<ProtectedRoute role="admin"><AdminPaymentsPage /></ProtectedRoute>}
            />
          </Route>
        </Routes>
      </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
