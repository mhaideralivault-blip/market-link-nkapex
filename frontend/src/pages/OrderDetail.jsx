import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { ordersApi, errorMessage } from '../services/api';
import { useCart } from '../context/CartContext';
import { OrderStepper, SlotPicker, Status, StatusTag } from '../components/Common';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import ReviewSection from '../components/ReviewSection';
import PickupQR from '../components/PickupQR';
import { directionsLinks, money } from '../utils';

const EDITABLE = ['placed', 'accepted'];

function ModifyForm({ order, onDone, onCancel }) {
  const fp = order.farmer.farmerProfile;
  const [items, setItems] = useState(order.items.map((item) => ({ product: item.product, name: item.name, unit: item.unit, quantity: item.quantity })));
  const [date, setDate] = useState(order.pickupDate);
  const [slot, setSlot] = useState(`${order.pickupSlot.start}-${order.pickupSlot.end}`);
  const [notes, setNotes] = useState(order.notes || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    const [start, end] = slot.split('-');
    setBusy(true);
    try {
      await ordersApi.modify(order._id, {
        items: items.map((item) => ({ product: item.product, quantity: item.quantity })),
        pickupDate: date,
        pickupSlot: { start, end },
        notes,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={save}>
      <h2>Modify order</h2>
      <p className="muted small">The farmer will need to confirm the changes again.</p>
      {items.map((item, idx) => (
        <div className="cart-line" key={item.product}>
          <div className="cart-info">{item.name}</div>
          <input
            className="qty"
            type="number"
            min="1"
            value={item.quantity}
            aria-label={`Quantity of ${item.name}`}
            onChange={(event) => setItems(items.map((x, index) => (index === idx ? { ...x, quantity: Math.max(1, Number(event.target.value) || 1) } : x)))}
          />
          <span className="muted small">{item.unit}</span>
          {items.length > 1 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems(items.filter((_, index) => index !== idx))}>
              Remove
            </button>
          )}
        </div>
      ))}
      <SlotPicker
        farmers={[fp]}
        date={date}
        slot={slot}
        onDate={(d) => {
          setDate(d);
          setSlot('');
        }}
        onSlot={setSlot}
      />
      <label>
        Notes
        <textarea rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button className="btn" disabled={busy || !slot}>
          {busy ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Discard
        </button>
      </div>
    </form>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const confirm = useConfirm();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const { data, loading, error } = useFetch(() => ordersApi.get(id), [id, tick]);
  if (loading || error) return <Status loading={loading} error={error} />;

  const o = data.order;
  const fp = o.farmer.farmerProfile;
  const familyView = !!o.familyView;
  const editable = EDITABLE.includes(o.status) && !familyView;

  const cancel = async () => {
    if (!(await confirm({ title: 'Cancel this order?', message: 'The reserved stock goes back to the farmer. You can reorder later.', confirmText: 'Cancel order', danger: true }))) return;
    try {
      await ordersApi.cancel(o._id);
      toast('Order cancelled');
      setTick(tick + 1);
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  const reorder = async () => {
    try {
      const { items } = (await ordersApi.reorder(o._id)).data;
      const ok = items.filter((item) => item.canOrder);
      if (!ok.length) return setMsg({ type: 'error', text: 'None of these items are currently available.' });
      ok.forEach((i) => {
        const src = o.items.find((item) => item.product === i.product);
        cart.addItem(
          { _id: i.product, name: i.name, price: i.currentPrice, unit: src.unit, farmerId: o.farmer._id, stallName: fp.stallName, max: i.quantityAvailable },
          i.requested
        );
      });
      navigate('/cart');
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  const loc = o.market;
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/orders">My orders</Link> / <span>#{o._id.slice(-6).toUpperCase()}</span>
      </nav>
      <div className="between">
        <h1>Order #{o._id.slice(-6).toUpperCase()}</h1>
        <StatusTag status={o.status} />
      </div>
      {familyView && <p className="alert alert-info">Placed by {o.customer?.name} (family account). You can view it and reorder, but only they can change it.</p>}
      <div className="ad-card" style={{ margin: '4px 0 20px' }}>
        <OrderStepper status={o.status} />
      </div>
      {msg.text && <p className={`alert alert-${msg.type}`}>{msg.text}</p>}
      {['placed', 'accepted'].includes(o.status) && (
        <p className="alert alert-info">Your pickup QR code and code will appear right here on this page once the farmer marks this order ready.</p>
      )}
      {o.status === 'ready' && o.pickupCode && !editing && <PickupQR code={o.pickupCode} />}

      {editing ? (
        <ModifyForm
          order={o}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            setMsg({ type: 'info', text: 'Order updated. Waiting for the farmer to confirm.' });
            setTick(tick + 1);
          }}
        />
      ) : (
        <div className="grid grid-3">
          <div className="card os-items">
            <h2>Items</h2>
            {o.items.map((item) => (
              <div className="between small line" key={item.product}>
                <span>
                  {item.quantity} {item.unit} × {item.name} <span className="muted">({money(item.price)} each)</span>
                </span>
                <strong>{money(item.price * item.quantity)}</strong>
              </div>
            ))}
            <div className="between line">
              <strong>Total (pay at pickup)</strong>
              <strong>{money(o.totalAmount)}</strong>
            </div>
            {o.notes && <p className="muted small mt">Note: {o.notes}</p>}
          </div>
          <div className="card">
            <h2>Pickup</h2>
            <p>
              {o.pickupDate}
              <br />
              {o.pickupSlot.start} - {o.pickupSlot.end}
            </p>
            <p className="small">
              <Link to={`/farmers/${o.farmer._id}`}>{fp.stallName}</Link>
            </p>
            {loc && (
              <p className="small">
                <Link to={`/markets/${loc._id}`}>{loc.name}</Link>
                <br />
                <span className="muted">{loc.address}</span>
                <br />
                <a href={directionsLinks(loc.latitude, loc.longitude).osm} target="_blank" rel="noreferrer">
                  Get directions
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {!editing && (
        <div className="row-gap mt">
          {editable && (
            <>
              <button className="btn btn-outline" onClick={() => setEditing(true)}>
                Modify order
              </button>
              <button className="btn btn-danger" onClick={cancel}>
                Cancel order
              </button>
            </>
          )}
          {['completed', 'cancelled', 'declined'].includes(o.status) && (
            <button className="btn" onClick={reorder}>
              Reorder
            </button>
          )}
        </div>
      )}

      {o.status === 'completed' && !editing && !familyView && <ReviewSection order={o} />}

      <h2 className="section-title">Status history</h2>
      <ol className="timeline">
        {o.statusHistory.map((h, index) => (
          <li key={index}>
            <StatusTag status={h.status} /> <span className="muted small">{new Date(h.at).toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
