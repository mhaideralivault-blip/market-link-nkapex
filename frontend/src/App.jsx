import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import { NotificationsProvider } from './context/NotificationsContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { About, Contact, NotFound } from './pages/StaticPages';

// Route pages load on demand so the map library only ships with map pages.
const Markets = lazy(() => import('./pages/Markets'));
const MarketDetail = lazy(() => import('./pages/MarketDetail'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const FarmerProfile = lazy(() => import('./pages/FarmerProfile'));
const Cart = lazy(() => import('./pages/Cart'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Notifications = lazy(() => import('./pages/Notifications'));
const FarmerDashboard = lazy(() => import('./pages/farmer/Dashboard'));
const FarmerProducts = lazy(() => import('./pages/farmer/Products'));
const FarmerOrders = lazy(() => import('./pages/farmer/Orders'));
const FarmerHarvest = lazy(() => import('./pages/farmer/Harvest'));
const HarvestCalendar = lazy(() => import('./pages/Harvest'));
const FarmerReviews = lazy(() => import('./pages/farmer/Reviews'));
const FarmerStall = lazy(() => import('./pages/farmer/Profile'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminAudit = lazy(() => import('./pages/admin/Audit'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminMarkets = lazy(() => import('./pages/admin/Markets'));
const AdminModeration = lazy(() => import('./pages/admin/Moderation'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
        <FavoritesProvider>
        <CartProvider>
        <ToastProvider>
        <ConfirmProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />

            {/* Public browsing */}
            <Route path="/markets" element={<Markets />} />
            <Route path="/markets/:id" element={<MarketDetail />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/farmers/:id" element={<FarmerProfile />} />
            <Route path="/harvest" element={<HarvestCalendar />} />

            {/* Customer */}
            <Route element={<ProtectedRoute roles={['customer']} />}>
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/favorites" element={<Favorites />} />
            </Route>

            {/* Any logged-in user */}
            <Route element={<ProtectedRoute />}>
              <Route path="/notifications" element={<Notifications />} />
            </Route>

            {/* Farmer */}
            <Route element={<ProtectedRoute roles={['farmer']} />}>
              <Route path="/farmer" element={<FarmerDashboard />} />
              <Route path="/farmer/products" element={<FarmerProducts />} />
              <Route path="/farmer/orders" element={<FarmerOrders />} />
              <Route path="/farmer/harvest" element={<FarmerHarvest />} />
              <Route path="/farmer/reviews" element={<FarmerReviews />} />
              <Route path="/farmer/profile" element={<FarmerStall />} />
            </Route>

            {/* Admin */}
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/markets" element={<AdminMarkets />} />
                <Route path="/admin/moderation" element={<AdminModeration />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/audit" element={<AdminAudit />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </ConfirmProvider>
        </ToastProvider>
        </CartProvider>
        </FavoritesProvider>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
