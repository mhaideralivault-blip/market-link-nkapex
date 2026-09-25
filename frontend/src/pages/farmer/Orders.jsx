import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { ordersApi, errorMessage } from '../../services/api';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import ApprovalBanner from '../../components/ApprovalBanner';
import PickupScanner from '../../components/PickupScanner';
import { EmptyState, OrderStepper, PageHead, Pagination, StatusTag } from '../../components/Common';
import { IconBasket } from '../../components/Icons';
import { money } from '../../utils';

const TABS = [['', 'All'], ['placed', 'New'], ['accepted', 'Accepted'], ['ready', 'Ready'], ['completed', 'Completed'], ['declined', 'Declined'], ['cancelled', 'Cancelled']];

// Next actions the farmer may take, per current status.
const ACTIONS = {
  placed: [['accepted', 'Accept', ''], ['declined', 'Decline', 'btn-outline']],
  accepted: [['ready', 'Mark ready for pickup', ''], ['declined', 'Decline', 'btn-outline']],
  ready: [['completed', 'Mark completed', '']],
};

export default function Orders() {
  const confirm = useConfirm();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState('');
  const [scanning, setScanning] = useState(false);
  const { data, loading, error } = useFetch(() => ordersApi.list({ status, date, page, limit: 10 }), [status, date, page, tick]);
  const orders = data?.orders || [];

  const change = async (o, next, label) => {
    if (next === 'declined' && !(await confirm({ title: 'Decline this order?', message: 'The reserved stock is released and the customer is notified.', confirmText: 'Decline order', danger: true }))) return;
    setBusy(o._id);
    try {
      await ordersApi.setStatus(o._id, next);
      toast(`Order #${o._id.slice(-6).toUpperCase()}: ${label.toLowerCase()}`);
      setTick((previousTick) => previousTick + 1);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <PageHead kicker="Orders" title="Incoming orders" sub="Accept, prepare and hand over pre-orders. Customers are notified at every step.">
        <button className="btn" onClick={() => setScanning(true)}>
          Scan pickup QR
        </button>
        <label className="inline">
          <span className="muted small">Pickup date</span>
          <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} />
        </label>
        {date && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDate('')}>
            Clear
          </button>
        )}
      </PageHead>
      <ApprovalBanner />
      <div className="chip-row inline wrap-chips" role="tablist" aria-label="Order status">
        {TABS.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={status === v} className={status === v ? 'active' : ''} onClick={() => { setStatus(v); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {loading && !orders.length && <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 22 }} />)}</div>}
      {!loading && !orders.length && <EmptyState icon={IconBasket} title="No orders match" text="New pre-orders will appear here as customers reserve your produce." />}

      <div className="order-list">
        {orders.map((order) => (
          <article className={`order-tile s-${order.status}`} key={order._id}>
            <div className="ot-top">
              <div>
                <strong className="ot-farmer">{order.customer?.name}</strong>
                <small className="muted">
                  #{order._id.slice(-6).toUpperCase()}
                  {order.customer?.phone && ` · ${order.customer.phone}`}
                </small>
              </div>
              <StatusTag status={order.status} />
            </div>
            <OrderStepper status={order.status} compact />
            <div className="ot-when">
              <strong>
                {order.pickupDate} · {order.pickupSlot.start}–{order.pickupSlot.end}
              </strong>
              {order.market?.name && <span className="muted"> at {order.market.name}</span>}
            </div>
            <ul className="ot-lines">
              {order.items.map((item) => (
                <li key={item.product}>
                  <span>
                    <b>{item.quantity}</b> {item.unit} × {item.name}
                  </span>
                  <span>{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            {order.notes && <p className="ot-note">“{order.notes}”</p>}
            <div className="ot-foot">
              <strong>Total {money(order.totalAmount)} · cash at pickup</strong>
              <span className="po-actions">
                {(ACTIONS[order.status] || []).map(([next, label, cls]) => (
                  <button key={next} className={`btn btn-sm ${cls}`} disabled={busy === order._id} onClick={() => change(order, next, label)}>
                    {label}
                  </button>
                ))}
              </span>
            </div>
          </article>
        ))}
      </div>
      {scanning && <PickupScanner onClose={() => setScanning(false)} onCompleted={() => { setScanning(false); setTick((previousTick) => previousTick + 1); }} />}
      {data && <Pagination page={data.page} pages={Math.ceil(data.total / 10)} onChange={setPage} />}
    </>
  );
}
