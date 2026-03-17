import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/shop/api/auth/refresh-token', { refreshToken });
          localStorage.setItem('token', data.token);
          error.config.headers.Authorization = `Bearer ${data.token}`;
          return axios(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string }) => api.post('/auth/reset-password', data),
};

// Users
export const usersAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: any) => api.put('/users/me', data),
  getSavings: () => api.get('/users/me/savings'),
  getRecentlyViewed: () => api.get('/users/me/recently-viewed'),
};

// Products
export const productsAPI = {
  getAll: (params?: any) => api.get('/products', { params }),
  getHot: () => api.get('/products/hot'),
  getById: (id: string) => api.get(`/products/${id}`),
  trackView: (id: string) => api.post(`/products/${id}/view`),
};

// Business
export const businessAPI = {
  createProduct: (data: any) => api.post('/business/products', data),
  updateProduct: (id: string, data: any) => api.put(`/business/products/${id}`, data),
  getProducts: () => api.get('/business/products'),
  getAnalytics: () => api.get('/business/analytics'),
  getOrders: (params?: { from?: string; to?: string }) => api.get('/business/orders', { params }),
  createGroupPurchase: (data: any) => api.post('/business/group-purchases', data),
  assignPickupToGP: (gpId: string, pickupPointId: string | null) =>
    api.patch(`/business/group-purchases/${gpId}/pickup`, { pickupPointId }),
  rate: (id: string, rating: number) => api.post(`/business/${id}/rate`, { rating }),
  getPublic: (id: string) => api.get(`/business/${id}/public`),
  // Pickup Points
  getPickupPoints: () => api.get('/business/pickup-points'),
  createPickupPoint: (data: any) => api.post('/business/pickup-points', data),
  updatePickupPoint: (id: string, data: any) => api.patch(`/business/pickup-points/${id}`, data),
  deletePickupPoint: (id: string) => api.delete(`/business/pickup-points/${id}`),
};

// Group Purchases
export const groupPurchasesAPI = {
  getAll: (params?: any) => api.get('/group-purchases', { params }),
  getMy: (params?: any) => api.get('/group-purchases/my', { params }),
  getById: (id: string) => api.get(`/group-purchases/${id}`),
  join: (id: string, quantity?: number) => api.post(`/group-purchases/${id}/join`, { quantity: quantity || 1 }),
  leave: (id: string) => api.delete(`/group-purchases/${id}/leave`),
  /** Admin: capture all pending pre-auths (charge cards) when GP completes */
  capturePreAuths: (id: string) => api.post(`/group-purchases/${id}/capture`),
  /** Admin: release all pending pre-auths (no charge) when GP fails/expires */
  releasePreAuths: (id: string) => api.post(`/group-purchases/${id}/release`),
};

// Reviews
export const reviewsAPI = {
  create: (data: any) => api.post('/reviews', data),
  getByProduct: (id: string) => api.get(`/reviews/product/${id}`),
  getByBusiness: (id: string) => api.get(`/reviews/business/${id}`),
};

// Notifications
export const notificationsAPI = {
  getAll: (params?: any) => api.get('/notifications', { params }),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// Product Requests
export const productRequestsAPI = {
  getAll: (params?: any) => api.get('/product-requests', { params }),
  create: (data: any) => api.post('/product-requests', data),
  vote: (id: string) => api.post(`/product-requests/${id}/vote`),
  comment: (id: string, text: string) => api.post(`/product-requests/${id}/comment`, { text }),
};

// Payments
export const paymentsAPI = {
  initiate: (participantId: string) => api.post('/payments/initiate', { participantId }),
  getStatus: (id: string) => api.get(`/payments/${id}/status`),
};

// Referrals
export const referralsAPI = {
  getMyLink: () => api.get('/referrals/my-link'),
  apply: (referralCode: string) => api.post('/referrals/apply', { referralCode }),
  getStats: () => api.get('/referrals/stats'),
};

// Chat
export const chatAPI = {
  getMessages: (productId: string) => api.get(`/chat/${productId}`),
  sendMessage: (productId: string, text: string) => api.post(`/chat/${productId}`, { text }),
};

// Seed
export const seedAPI = {
  seed: () => api.post('/seed'),
};

export default api;
