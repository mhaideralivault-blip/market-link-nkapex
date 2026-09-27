import axios from 'axios';

export const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const TOKEN_KEY = 'marketlink_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired/invalid token: drop it and let the app fall back to logged-out state.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

// Readable message from an axios error.
export const errorMessage = (err) =>
  err.response?.data?.message || (err.request ? 'Cannot reach the server. Is the backend running?' : err.message);

// Product/market images are stored as "/uploads/x.jpg" on the backend.
// Pass a width (160/320/480/640/960) to get a smaller WebP version from the server.
export const imageUrl = (path, width) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_ORIGIN}${path}${width && path.startsWith('/uploads/') ? `?w=${width}` : ''}`;
};

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  registerCustomer: (data) => api.post('/auth/register', data),
  registerFarmer: (data) => api.post('/auth/register-farmer', data),
  me: () => api.get('/auth/me'),
};

const qs = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export const marketsApi = {
  list: (params) => api.get('/markets', { params: qs(params) }),
  get: (id) => api.get(`/markets/${id}`),
  create: (data) => api.post('/markets', data),
  update: (id, data) => api.put(`/markets/${id}`, data),
  remove: (id) => api.delete(`/markets/${id}`),
};
// One cached request with everything the landing page needs (see backend homeController).
export const homeApi = { get: () => api.get('/home') };
export const searchApi = { suggest: (q) => api.get('/search', { params: { q } }) };
export const categoriesApi = {
  list: (params) => api.get('/categories', { params: qs(params) }),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  remove: (id) => api.delete(`/categories/${id}`),
};
export const productsApi = {
  list: (params) => api.get('/products', { params: qs(params) }),
  get: (id) => api.get(`/products/${id}`),
  mine: () => api.get('/products/mine'),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  setStatus: (id, status) => api.patch(`/products/${id}/status`, { status }),
  applyTemplate: () => api.post('/products/weekly-template/apply'),
  applyTemplateOne: (id) => api.post(`/products/${id}/weekly-template/apply`),
  bulkUpdate: (items) => api.patch('/products/bulk', { items }),
  remove: (id) => api.delete(`/products/${id}`),
};
export const farmersApi = {
  list: (params) => api.get('/farmers', { params: qs(params) }),
  get: (id) => api.get(`/farmers/${id}`),
  dashboard: () => api.get('/farmers/dashboard'),
  updateProfile: (data) => api.put('/farmers/profile', data),
};
export const uploadImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const reviewsApi = {
  list: (params) => api.get('/reviews', { params: qs(params) }),
  forOrder: (orderId) => api.get(`/reviews/order/${orderId}`),
  create: (data) => api.post('/reviews', data),
  mine: () => api.get('/reviews/mine'),
  reply: (id, text) => api.put(`/reviews/${id}/reply`, { text }),
};
export const notificationsApi = {
  list: (params) => api.get('/notifications', { params: qs(params) }),
  announcements: () => api.get('/notifications/announcements'),
  read: (id) => api.patch(`/notifications/${id}/read`),
  readAll: () => api.patch('/notifications/read-all'),
};
export const chatbotApi = { ask: (message) => api.post('/chatbot', { message }) };
export const favoritesApi = {
  list: () => api.get('/customer/favorites'),
  add: (type, id) => api.put(`/customer/favorites/${type}/${id}`),
  remove: (type, id) => api.delete(`/customer/favorites/${type}/${id}`),
};

export const familyApi = {
  get: () => api.get('/family'),
  favorites: () => api.get('/family/favorites'),
  invite: (email) => api.post('/family/invite', { email }),
  accept: (from) => api.post(`/family/invites/${from}/accept`),
  decline: (from) => api.post(`/family/invites/${from}/decline`),
  leave: () => api.post('/family/leave'),
  removeMember: (id) => api.delete(`/family/members/${id}`),
};

export const ordersApi = {
  list: (params) => api.get('/orders', { params: qs(params) }),
  get: (id) => api.get(`/orders/${id}`),
  place: (data) => api.post('/orders', data),
  modify: (id, data) => api.put(`/orders/${id}`, data),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  reorder: (id) => api.get(`/orders/${id}/reorder`),
  setStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  verifyPickup: (code) => api.post('/orders/verify-pickup', { code }),
};

export const harvestsApi = {
  upcoming: (params) => api.get('/harvests', { params: qs(params) }),
  subscribe: (id) => api.post(`/harvests/${id}/subscribe`),
  unsubscribe: (id) => api.delete(`/harvests/${id}/subscribe`),
  mine: () => api.get('/harvests/mine'),
  create: (data) => api.post('/harvests', data),
  update: (id, data) => api.put(`/harvests/${id}`, data),
  setStatus: (id, status) => api.patch(`/harvests/${id}/status`, { status }),
};

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  users: (params) => api.get('/admin/users', { params: qs(params) }),
  setFarmerStatus: (id, status) => api.patch(`/admin/farmers/${id}/status`, { status }),
  setActive: (id, isActive) => api.patch(`/admin/users/${id}/active`, { isActive }),
  products: (params) => api.get('/products/admin/all', { params: qs(params) }),
  removeProduct: (id) => api.delete(`/products/${id}`),
  reviews: (params) => api.get('/admin/reviews', { params: qs(params) }),
  removeReview: (id) => api.delete(`/reviews/${id}`),
  reports: () => api.get('/admin/reports'),
  generateReport: (reportType) => api.post('/admin/reports', { reportType }),
  createAnnouncement: (data) => api.post('/admin/announcements', data),
  removeAnnouncement: (id) => api.delete(`/admin/announcements/${id}`),
  bulkUsers: (ids, action) => api.patch('/admin/users/bulk', { ids, action }),
  search: (q) => api.get('/admin/search', { params: { q } }),
  audit: (params) => api.get('/admin/audit', { params: qs(params) }),
  // Downloads a CSV through the authenticated client (a plain <a href> could not send the token).
  exportCsv: async (type, params) => {
    const res = await api.get(`/admin/export/${type}`, { params: qs(params), responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = Object.assign(document.createElement('a'), { href: url, download: `marketlink-${type}-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export default api;
