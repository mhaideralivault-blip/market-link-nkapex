import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { harvestsApi, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, PageHead, Status } from '../components/Common';
import { IconBell, IconCalendar, IconChevronLeft, IconChevron, IconCheck } from '../components/Icons';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const fromKey = (k) => new Date(`${k}T12:00:00`);
const niceDate = (k) => fromKey(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const daysUntil = (k) => Math.round((fromKey(k) - fromKey(todayKey())) / 864e5);
const when = (k) => {
  const d = daysUntil(k);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`;
};

// Month grid: dates that have upcoming produce get a dot + count; tapping one filters the list below.
function MonthGrid({ month, onMonth, counts, selected, onSelect }) {
  const { y, m } = month;
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const total = new Date(y, m + 1, 0).getDate();
  const today = todayKey();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const shift = (delta) => {
    const d = new Date(y, m + delta, 1);
    onMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  return (
    <section className="card hv-cal" aria-label="Harvest calendar">
      <div className="between hv-cal-head">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          <IconChevronLeft />
        </button>
        <h2>
          {MONTHS[m]} {y}
        </h2>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>
          <IconChevron style={{ transform: 'rotate(-90deg)' }} />
        </button>
      </div>
      <div className="hv-grid" role="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="hv-wd" role="columnheader">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const k = key(y, m, d);
          const n = counts[k] || 0;
          return (
            <button
              type="button"
              key={k}
              role="gridcell"
              className={`hv-day ${n ? 'has' : ''} ${k === today ? 'today' : ''} ${k === selected ? 'sel' : ''}`}
              disabled={!n}
              aria-label={`${niceDate(k)}${n ? `, ${n} harvest${n > 1 ? 's' : ''} expected` : ''}`}
              aria-pressed={k === selected}
              onClick={() => onSelect(k === selected ? '' : k)}
            >
              {d}
              {n > 0 && <i>{n}</i>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HarvestCard({ harvest, canSubscribe, onChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const stall = harvest.farmer?.farmerProfile;

  const toggle = async () => {
    setBusy(true);
    try {
      const { harvest: updated } = (await (harvest.subscribed ? harvestsApi.unsubscribe(harvest._id) : harvestsApi.subscribe(harvest._id))).data;
      onChange(updated);
      toast(updated.subscribed ? `We'll alert you when ${harvest.title} is available` : 'Alert removed');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card hv-card">
      <div className="hv-date" aria-hidden>
        <b>{fromKey(harvest.expectedDate).getDate()}</b>
        <span>{MONTHS[fromKey(harvest.expectedDate).getMonth()].slice(0, 3)}</span>
      </div>
      <div className="hv-body">
        <div className="between">
          <h3>{harvest.title}</h3>
          <span className="tag tag-warn">{when(harvest.expectedDate)}</span>
        </div>
        <p className="small muted">
          by{' '}
          <Link to={`/farmers/${stall?.slug || harvest.farmer?._id}`}>{stall?.stallName || 'Local grower'}</Link>
          {harvest.category?.name && <> · {harvest.category.name}</>}
          {harvest.estimatedQuantity ? <> · about {harvest.estimatedQuantity} {harvest.unit}</> : null}
        </p>
        {harvest.description && <p className="small">{harvest.description}</p>}
        <div className="hv-foot">
          <span className="muted small">
            {harvest.subscriberCount > 0 ? `${harvest.subscriberCount} ${harvest.subscriberCount === 1 ? 'person is' : 'people are'} waiting` : 'Be the first to ask for it'}
          </span>
          {canSubscribe ? (
            <button className={`btn btn-sm ${harvest.subscribed ? 'btn-outline' : ''}`} onClick={toggle} disabled={busy} aria-pressed={harvest.subscribed}>
              {harvest.subscribed ? (
                <>
                  <IconCheck width={16} height={16} /> Alert on
                </>
              ) : (
                <>
                  <IconBell width={16} height={16} /> Notify me
                </>
              )}
            </button>
          ) : !user ? (
            <Link className="btn btn-sm btn-outline" to="/login" state={{ from: '/harvest' }}>
              Log in to get notified
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function HarvestCalendar() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initial = params.get('date') || '';
  const [selected, setSelected] = useState(initial);
  const now = new Date();
  const [month, setMonth] = useState(() => {
    const base = initial ? fromKey(initial) : now;
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const [items, setItems] = useState(null);
  const { data, loading, error } = useFetch(() => harvestsApi.upcoming({ limit: 300 }), [user?._id]);
  useEffect(() => setItems(data?.harvests || null), [data]);

  const list = items || [];
  const counts = useMemo(() => list.reduce((acc, h) => ({ ...acc, [h.expectedDate]: (acc[h.expectedDate] || 0) + 1 }), {}), [list]);
  const visible = selected ? list.filter((h) => h.expectedDate === selected) : list;
  const groups = visible.reduce((acc, h) => ((acc[h.expectedDate] = acc[h.expectedDate] || []).push(h), acc), {});
  const canSubscribe = user?.role === 'customer';
  const replace = (updated) => setItems((cur) => cur.map((h) => (h._id === updated._id ? { ...h, ...updated } : h)));
  const pick = (k) => {
    setSelected(k);
    setParams(k ? { date: k } : {}, { replace: true });
    if (k) setMonth({ y: fromKey(k).getFullYear(), m: fromKey(k).getMonth() });
  };

  return (
    <>
      <PageHead kicker="Harvest calendar" title="What's coming to the market" sub="Growers announce produce before it arrives. Tap Notify me and we'll alert you the moment it's available to order.">
        {selected && (
          <button className="btn btn-outline btn-sm" onClick={() => pick('')}>
            Show all dates
          </button>
        )}
      </PageHead>
      <Status loading={loading && !items} error={error} />
      {items && (
        <div className="hv-layout">
          <MonthGrid month={month} onMonth={setMonth} counts={counts} selected={selected} onSelect={pick} />
          <div className="hv-list">
            {!visible.length && <EmptyState icon={IconCalendar} title="Nothing announced yet" text="Growers haven't announced upcoming produce for this date. Check back soon." to="/products" cta="Browse fresh produce" />}
            {Object.keys(groups)
              .sort()
              .map((k) => (
                <section key={k} aria-label={niceDate(k)}>
                  <h2 className="hv-group">{niceDate(k)}</h2>
                  <div className="stack">
                    {groups[k].map((h) => (
                      <HarvestCard key={h._id} harvest={h} canSubscribe={canSubscribe} onChange={replace} />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
