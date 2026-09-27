import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { farmersApi, ordersApi, errorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ApprovalBanner from '../../components/ApprovalBanner';
import { StatusTag } from '../../components/Common';
import Kpi from '../../components/admin/Kpi';
import { BarChart, HBars, Sparkline } from '../../components/admin/Charts';
import { IconBasket, IconBox, IconCash, IconStar } from '../../components/Icons';
import { money, shortDay, timeAgo } from '../../utils';

const NEXT = { placed: [['accepted', 'Accept'], ['declined', 'Decline']], accepted: [['ready', 'Mark ready']], ready: [['completed', 'Complete']] };
const prettyDate = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [dayIdx, setDayIdx] = useState(0);
  const [busy, setBusy] = useState('');
  const { data, loading, error } = useFetch(() => farmersApi.dashboard(), [tick]);
  const s = data?.stats;
  const rating = user.farmerProfile?.ratingAvg;

  const move = async (o, status, label) => {
    setBusy(o._id);
    try {
      await ordersApi.setStatus(o._id, status);
      toast(`Order for ${o.customer || 'customer'}: ${label.toLowerCase()}`);
      setTick((previousTick) => previousTick + 1);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const pick = s?.pickList?.[Math.min(dayIdx, (s?.pickList?.length || 1) - 1)];

  return (
    <>
      <header className="ad-head">
        <div>
          <span className="kicker dark">Farmer dashboard</span>
          <h1>{user.farmerProfile.stallName}</h1>
        </div>
        <div className="ad-tools">
          <Link className="btn btn-sm" to="/farmer/products">
            Manage stock
          </Link>
          <Link className="btn btn-outline btn-sm" to="/farmer/profile">
            Edit stall profile
          </Link>
        </div>
      </header>
      <ApprovalBanner />
      {!!s?.staleWeeklyStock?.length && (
        <p className="alert alert-info">
          {s.staleWeeklyStock.length} product{s.staleWeeklyStock.length === 1 ? '' : 's'} with a weekly template {s.staleWeeklyStock.length === 1 ? 'hasn\'t' : 'haven\'t'} been refreshed in 7+ days
          {' — '}
          <Link to="/farmer/products">refresh weekly stock →</Link>
        </p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      {!s && loading && <div className="ad-skeleton">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton" />)}</div>}
      {s && (
        <>
          <section className="kpis four">
            <Kpi icon={IconBox} label="Total orders" value={s.totalOrders} sub={`${s.ordersByStatus.completed || 0} completed`} spark={<Sparkline values={s.days.map((day) => day.orders)} />} />
            <Kpi icon={IconBasket} label="Pending orders" value={s.pendingOrders} sub={s.pendingOrders ? 'Waiting for your decision' : 'You are all caught up'} to="/farmer/orders" />
            <Kpi icon={IconCash} label="Revenue (paid at pickup)" value={money(s.revenue)} sub="From completed orders" spark={<Sparkline values={s.days.map((day) => day.revenue)} color="var(--orange)" />} />
            <Kpi icon={IconStar} label="Customer rating" value={rating ? `${rating.toFixed(1)} ★` : '–'} sub={user.farmerProfile?.ratingCount ? `${user.farmerProfile.ratingCount} reviews` : 'No reviews yet'} to="/farmer/reviews" />
          </section>

          <section className="ad-card print-area" style={{ marginTop: 18 }}>
            <div className="ad-card-head">
              <div>
                <h2>Market-day pick list</h2>
                <span className="muted small">Everything you need to pack, added up across open orders.</span>
              </div>
              {pick && (
                <button className="btn btn-outline btn-sm no-print" onClick={() => window.print()}>
                  Print
                </button>
              )}
            </div>
            {!pick ? (
              <div className="empty small">
                <strong>Nothing to prepare</strong>
                <span className="muted">New orders for upcoming market days will appear here.</span>
              </div>
            ) : (
              <>
                <div className="chip-row inline no-print" role="tablist" aria-label="Pickup date">
                  {s.pickList.map((d, index) => (
                    <button key={d.date} role="tab" aria-selected={index === dayIdx} className={index === dayIdx ? 'active' : ''} onClick={() => setDayIdx(index)}>
                      {prettyDate(d.date)} · {d.orders.length}
                    </button>
                  ))}
                </div>
                <div className="pick-grid">
                  <div>
                    <h3 className="pick-h">{prettyDate(pick.date)}</h3>
                    <p className="muted small">
                      {pick.orders.length} order{pick.orders.length === 1 ? '' : 's'} · {money(pick.total)} to collect at pickup
                    </p>
                    <ul className="pack-list">
                      {pick.items.map((item) => (
                        <li key={`${item.name}${item.unit}`}>
                          <span className="pack-qty">{item.quantity}</span>
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.unit}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="pick-h">Orders by pickup time</h3>
                    <ul className="pick-orders">
                      {pick.orders.map((order) => (
                        <li key={order._id}>
                          <div className="po-top">
                            <strong>
                              {order.slot.start}–{order.slot.end}
                            </strong>
                            <span>{order.customer}</span>
                            <StatusTag status={order.status} />
                          </div>
                          <small className="muted">
                            {order.items.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(', ')} · {money(order.total)}
                            {order.phone ? ` · ${order.phone}` : ''}
                          </small>
                          {order.notes && <small className="po-note">“{order.notes}”</small>}
                          <span className="po-actions no-print">
                            {(NEXT[order.status] || []).map(([st, label], index) => (
                              <button key={st} className={`btn btn-sm ${index ? 'btn-outline' : ''}`} disabled={busy === order._id} onClick={() => move(order, st, label)}>
                                {label}
                              </button>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="ad-grid two">
            <div className="ad-card">
              <div className="ad-card-head">
                <h2>Orders, last 14 days</h2>
                <span className="muted small">{s.days.reduce((total, day) => total + day.orders, 0)} orders</span>
              </div>
              <BarChart data={s.days.map((day) => ({ label: shortDay(day.day), value: day.orders, sub: `${money(day.revenue)} completed` }))} height={170} />
            </div>
            <div className="ad-card">
              <div className="ad-card-head">
                <h2>Best sellers</h2>
              </div>
              <HBars rows={s.bestSelling.map((b) => ({ label: b.name, value: b.revenue, note: `${b.unitsSold} sold` }))} format={money} empty="Sales appear here once orders are completed." />
            </div>
          </section>

          <section className="ad-grid two">
            <div className="ad-card">
              <div className="ad-card-head">
                <h2>Recent orders</h2>
                <Link to="/farmer/orders" className="arrow-link small">
                  All orders →
                </Link>
              </div>
              <ul className="feed">
                {s.recentOrders.map((recentOrder) => (
                  <li key={recentOrder._id}>
                    <span className="feed-main">
                      <strong>
                        #{recentOrder._id.slice(-6).toUpperCase()} · {recentOrder.customer?.name}
                      </strong>
                      <small>{timeAgo(recentOrder.createdAt)}</small>
                    </span>
                    <span className="feed-side">
                      <b>{money(recentOrder.totalAmount)}</b>
                      <StatusTag status={recentOrder.status} />
                    </span>
                  </li>
                ))}
                {!s.recentOrders.length && <li className="muted small">No orders yet.</li>}
              </ul>
            </div>
            <div className="ad-card">
              <div className="ad-card-head">
                <h2>Running low</h2>
                <Link to="/farmer/products" className="arrow-link small">
                  Restock →
                </Link>
              </div>
              {s.lowStock.length ? (
                <ul className="feed">
                  {s.lowStock.map((p) => (
                    <li key={p._id}>
                      <span className="feed-main">
                        <strong>{p.name}</strong>
                      </span>
                      <span className={`tag ${p.quantityAvailable === 0 ? 'tag-cancelled' : 'tag-ready'}`}>
                        {p.quantityAvailable === 0 ? 'sold out' : `${p.quantityAvailable} ${p.unit} left`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Stock levels look healthy.</p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
