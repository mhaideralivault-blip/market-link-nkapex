import { Link, useNavigate } from 'react-router-dom';
import { useFavorites } from '../context/FavoritesContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { IconCart, IconHeart } from './Icons';
import { imageUrl } from '../services/api';
import { money, categoryEmoji, phClass, productPath, farmerPath } from '../utils';
import { computeSlots, todayISO } from '../slots';

export function Stars({ value = 0, count }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {'★'.repeat(full)}
      <span className="stars-off">{'★'.repeat(5 - full)}</span>
      {count !== undefined && <span className="muted"> ({count})</span>}
    </span>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function Status({ loading, error, empty, emptyText = 'Nothing found.' }) {
  if (loading) return <div className="spinner" role="status" aria-label="Loading" />;
  if (error) return <p className="alert alert-error">{error}</p>;
  if (empty) return <p className="page-message">{emptyText}</p>;
  return null;
}

// Heart toggle; only shown to logged-in customers.
export function FavoriteButton({ type, id }) {
  const fav = useFavorites();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  // Guests still see the heart; tapping it invites them to log in instead of being a dead end.
  if (!fav.enabled) {
    if (user) return null;
    return (
      <button
        className="fav-btn"
        aria-label="Log in to save favorites"
        onClick={() => {
          toast('Log in to save favorites', { to: '/login', label: 'Log in' });
          navigate('/login', { state: { from: window.location.pathname } });
        }}
      >
        <IconHeart width={21} height={21} />
      </button>
    );
  }
  const on = fav.has(type, id);
  return (
    <button className={`fav-btn ${on ? 'on' : ''}`} aria-pressed={on} aria-label={on ? 'Remove from favorites' : 'Add to favorites'} onClick={() => fav.toggle(type, id)}>
      <IconHeart width={21} height={21} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

export function ProductCard({ product }) {
  const img = imageUrl(product.image, 320);
  const left = product.quantityAvailable;
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const canQuickAdd = user?.role === 'customer' && left > 0 && product.available !== false;
  const quickAdd = () => {
    cart.addItem(
      { _id: product._id, name: product.name, price: product.price, unit: product.unit, image: product.image, slug: product.slug, farmerId: product.farmer?._id, stallName: product.farmer?.farmerProfile?.stallName, max: left },
      1
    );
    toast(`${product.name} added to your cart`, { to: '/cart', label: 'View cart' });
  };
  return (
    <article className="product-card">
      <div className="pc-media">
        <Link to={productPath(product)} className={`product-img ${img ? '' : `noimg ${phClass(product.category?.name)}`}`} aria-label={product.name}>
          {img ? <img src={img} alt={product.name} loading="lazy" /> : <span className="ph-letter" aria-hidden>{product.name?.[0]}</span>}
        </Link>
        <span className="pc-fav">
          <FavoriteButton type="products" id={product._id} />
        </span>
        {canQuickAdd && (
          <button className="pc-add" onClick={quickAdd} aria-label={`Add ${product.name} to cart`}>
            <IconCart width={18} height={18} /> <span>Add</span>
          </button>
        )}
        {left <= 0 ? <span className="pc-badge out">Sold out</span> : left <= 10 ? <span className="pc-badge low">Only {left} left</span> : null}
      </div>
      <div className="product-body">
        <p className="pc-cat">{product.category?.name}</p>
        <h3>
          <Link to={productPath(product)}>{product.name}</Link>
        </h3>
        {product.farmer?.farmerProfile?.stallName && (
          <p className="pc-stall">
            by <Link to={farmerPath(product.farmer)}>{product.farmer.farmerProfile.stallName}</Link>
          </p>
        )}
        <p className="pc-price">
          <span className="price">{money(product.price)}</span>
          <span className="muted small"> / {product.unit}</span>
        </p>
      </div>
    </article>
  );
}

const STATUS_LABELS = { placed: 'Placed', accepted: 'Accepted', ready: 'Ready for pickup', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' };

export function StatusTag({ status }) {
  return <span className={`tag tag-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

// Date input + slot chips. `farmers` = farmerProfile-like objects that must all accept the slot.
export function SlotPicker({ farmers, date, slot, onDate, onSlot }) {
  const slots = computeSlots(farmers, date);
  return (
    <div className="stack">
      <label>
        Pickup date
        <input type="date" required min={todayISO()} value={date} onChange={(event) => onDate(event.target.value)} />
      </label>
      {date && (
        <div>
          <strong className="small">Pickup time</strong>
          {slots.length ? (
            <div className="chips" role="radiogroup" aria-label="Pickup time">
              {slots.map((s) => {
                const v = `${s.start}-${s.end}`;
                return (
                  <button type="button" key={v} role="radio" aria-checked={slot === v} className={`chip ${slot === v ? 'active' : ''}`} onClick={() => onSlot(v)}>
                    {s.start} - {s.end}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="alert alert-info mt">No pickup slots available on this date (closed, outside pickup windows, or past the order cut-off). Try another date.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Star rating input built from radio-style buttons (keyboard + screen-reader friendly).
export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>
          ★
        </button>
      ))}
    </div>
  );
}

// Compact row used in the home page lists.
export function ProductMini({ product }) {
  const img = imageUrl(product.image, 160);
  return (
    <Link to={productPath(product)} className="mini">
      <span className={`mini-img ${img ? '' : phClass(product.category?.name)}`}>{img ? <img src={img} alt="" loading="lazy" /> : <span aria-hidden>{categoryEmoji(product.category?.name)}</span>}</span>
      <span className="mini-info">
        <strong>{product.name}</strong>
        <span className="muted small">{product.farmer?.farmerProfile?.stallName}</span>
        <span className="price small">
          {money(product.price)} <span className="muted">/ {product.unit}</span>
        </span>
      </span>
    </Link>
  );
}

// Grey shimmering cards shown while product lists load.
export function SkeletonGrid({ count = 8, className = 'grid grid-4' }) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div className="card skel-card" key={index}>
          <div className="skeleton skel-img" />
          <div className="skeleton skel-line" />
          <div className="skeleton skel-line short" />
        </div>
      ))}
    </div>
  );
}

// Consistent page title block: small kicker, big serif title, optional subtitle and right-aligned actions.
export function PageHead({ kicker, title, sub, children }) {
  return (
    <header className="page-head ph-flex">
      <div>
        {kicker && <span className="kicker dark">{kicker}</span>}
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="ad-tools">{children}</div>}
    </header>
  );
}

// Friendly empty state with an optional call to action.
export function EmptyState({ title, text, to, cta, icon: Icon }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-ico">
          <Icon width={30} height={30} />
        </span>
      )}
      <strong>{title}</strong>
      {text && <p className="muted">{text}</p>}
      {to && (
        <Link className="btn" to={to}>
          {cta}
        </Link>
      )}
    </div>
  );
}

const STEPS = [
  ['placed', 'Placed'],
  ['accepted', 'Accepted'],
  ['ready', 'Ready for pickup'],
  ['completed', 'Completed'],
];

// Visual progress of an order. Cancelled / declined orders show a single red end state.
export function OrderStepper({ status, compact = false }) {
  if (status === 'cancelled' || status === 'declined') {
    return (
      <div className={`stepper stopped ${compact ? 'compact' : ''}`}>
        <span className="step-stop">{status === 'cancelled' ? 'Order cancelled' : 'Declined by the farmer'}</span>
      </div>
    );
  }
  const idx = STEPS.findIndex(([k]) => k === status);
  return (
    <ol className={`stepper ${compact ? 'compact' : ''}`} aria-label={`Order status: ${status}`}>
      {STEPS.map(([k, label], index) => (
        <li key={k} className={index < idx ? 'done' : index === idx ? 'now' : ''}>
          <span className="step-dot" aria-hidden>
            {index < idx || (index === idx && k === 'completed') ? '✓' : index + 1}
          </span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
