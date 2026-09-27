import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { ordersApi } from '../services/api';
import { EmptyState, OrderStepper, PageHead, Pagination, StatusTag } from '../components/Common';
import { IconBasket } from '../components/Icons';
import { money } from '../utils';

const TABS = [['', 'All'], ['placed', 'Placed'], ['accepted', 'Accepted'], ['ready', 'Ready'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
const prettyDate = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

export default function Orders() {
  const location = useLocation();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error } = useFetch(() => ordersApi.list({ status, page, limit: 10 }), [status, page]);
  const orders = data?.orders || [];
  // Soonest open order on this page: shown as a "next pickup" reminder.
  const today = new Date().toISOString().slice(0, 10);
  const next = orders
    .filter((order) => ['placed', 'accepted', 'ready'].includes(order.status) && order.pickupDate >= today)
    .sort((first, second) => `${first.pickupDate}${first.pickupSlot.start}`.localeCompare(`${second.pickupDate}${second.pickupSlot.start}`))[0];

  return (
    <>
      <PageHead kicker="Orders" title="My orders" sub="Track every pre-order from the farmer's confirmation to pickup day." />
      {location.state?.placed && (
        <p className="alert alert-info">
          Your pre-order{location.state.placed > 1 ? 's were' : ' was'} placed. You will be notified when the farmer accepts. Payment is made at pickup.
        </p>
      )}

      {next && (
        <Link to={`/orders/${next._id}`} className="next-pickup">
          <span className="np-label">Your next pickup</span>
          <strong>
            {prettyDate(next.pickupDate)} · {next.pickupSlot.start}–{next.pickupSlot.end}
          </strong>
          <span>
            {next.farmer?.farmerProfile?.stallName}
            {next.market?.name && ` at ${next.market.name}`} · pay {money(next.totalAmount)} in person
          </span>
          <span className="np-go" aria-hidden>
            →
          </span>
        </Link>
      )}

      <div className="chip-row inline wrap-chips" role="tablist" aria-label="Order status">
        {TABS.map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={status === v}
            className={status === v ? 'active' : ''}
            onClick={() => {
              setStatus(v);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {loading && !orders.length && <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 22 }} />)}</div>}
      {!loading && !orders.length && <EmptyState icon={IconBasket} title="No orders here yet" text="Reserve fresh produce from a local grower and it will show up here." to="/products" cta="Browse products" />}

      <div className="order-list">
        {orders.map((order) => (
          <Link to={`/orders/${order._id}`} className="order-tile" key={order._id}>
            <div className="ot-top">
              <div>
                <strong className="ot-farmer">{order.farmer?.farmerProfile?.stallName}</strong>
                <small className="muted">
                  #{order._id.slice(-6).toUpperCase()} · placed {new Date(order.createdAt).toLocaleDateString()}
                </small>
              </div>
              <StatusTag status={order.status} />
            </div>
            <OrderStepper status={order.status} compact />
            {order.status === 'ready' && (
              <p className="ready-hint">Ready for pickup — tap to view your pickup QR code →</p>
            )}
            <div className="ot-items">
              {order.items.map((item) => (
                <span key={item.product} className="chip-static">
                  {item.quantity} {item.unit} {item.name}
                </span>
              ))}
            </div>
            <div className="ot-foot">
              <span className="muted small">
                Pickup {order.pickupDate}, {order.pickupSlot.start}–{order.pickupSlot.end}
                {order.market?.name && ` · ${order.market.name}`}
              </span>
              <strong>{money(order.totalAmount)}</strong>
            </div>
          </Link>
        ))}
      </div>
      {data && <Pagination page={data.page} pages={Math.ceil(data.total / 10)} onChange={setPage} />}
    </>
  );
}
