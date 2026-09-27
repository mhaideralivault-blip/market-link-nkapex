import { useEffect, useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { adminApi, errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { HBars } from '../../components/admin/Charts';
import { IconBox, IconChart, IconDownload, IconMap, IconUsers } from '../../components/Icons';
import { money, timeAgo } from '../../utils';

const TYPES = [
  ['summary', 'Platform summary', 'Orders, revenue, best markets and farmers in one page.', IconChart],
  ['revenue_by_market', 'Revenue by market', 'Which markets earn the most from completed orders.', IconMap],
  ['active_farmers', 'Most active farmers', 'Top 10 farmers ranked by number of orders.', IconUsers],
  ['top_products', 'Top products', 'Best-selling products by revenue and units.', IconBox],
];
const LABEL = Object.fromEntries(TYPES.map((t) => [t[0], t[1]]));

// ---- CSV built in the browser from the report data (no extra server round-trip) ----
const cell = (v) => {
  const s = String(v ?? '');
  const safe = /^[=+@]/.test(s) || /^-[^0-9.]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const rowsFor = (r) => {
  const d = r.data;
  if (r.reportType === 'revenue_by_market') return { head: ['Market', 'Completed orders', 'Revenue'], rows: d.map((m) => [m.market || 'Unspecified', m.orders, m.revenue]) };
  if (r.reportType === 'active_farmers') return { head: ['Farmer', 'Orders', 'Revenue'], rows: d.map((f) => [f.stallName || 'Removed farmer', f.orders, f.revenue]) };
  if (r.reportType === 'top_products') return { head: ['Product', 'Units sold', 'Revenue'], rows: d.map((p) => [p.product, `${p.units} ${p.unit || ''}`.trim(), p.revenue]) };
  return {
    head: ['Metric', 'Value'],
    rows: [['Total orders', d.totalOrders], ['Completed orders', d.completedOrders], ['Revenue', d.revenue], ...d.revenueByMarket.map((m) => [`Revenue - ${m.market || 'Unspecified'}`, m.revenue]), ...d.mostActiveFarmers.map((mostActiveFarmer) => [`Orders - ${mostActiveFarmer.stallName || 'Removed farmer'}`, mostActiveFarmer.orders])],
  };
};
const download = (r) => {
  const { head, rows } = rowsFor(r);
  const csv = [head, ...rows].map((row) => row.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${r.reportType}-${new Date(r.generatedAt).toISOString().slice(0, 10)}.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Excel export (xlsx, lazy-loaded so it never weighs down the normal admin bundle).
const downloadExcel = async (r) => {
  const { head, rows } = rowsFor(r);
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([head, ...rows]);
  sheet['!cols'] = head.map((_, col) => ({ wch: Math.max(head[col].length, ...rows.map((row) => String(row[col] ?? '').length)) + 2 }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, LABEL[r.reportType].slice(0, 31));
  XLSX.writeFile(book, `${r.reportType}-${new Date(r.generatedAt).toISOString().slice(0, 10)}.xlsx`);
};

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReportBody({ report }) {
  const d = report.data;
  const market = (a) => <HBars rows={a.map((m) => ({ label: m.market || 'Unspecified market', value: m.revenue, note: `${m.orders} completed order${m.orders === 1 ? '' : 's'}` }))} format={money} empty="No completed sales yet." />;
  const farmers = (a) => <HBars rows={a.map((f) => ({ label: f.stallName || 'Removed farmer', value: f.orders, note: `${money(f.revenue)} completed revenue` }))} format={(v) => `${v} orders`} empty="No orders yet." />;
  if (report.reportType === 'summary') {
    return (
      <>
        <div className="metrics">
          <Metric label="Total orders" value={d.totalOrders} />
          <Metric label="Completed orders" value={d.completedOrders} />
          <Metric label="Revenue summary" value={money(d.revenue)} />
        </div>
        <h3>Revenue across markets</h3>
        {market(d.revenueByMarket)}
        <h3>Most active farmers</h3>
        {farmers(d.mostActiveFarmers)}
      </>
    );
  }
  if (report.reportType === 'revenue_by_market') return market(d);
  if (report.reportType === 'active_farmers') return farmers(d);
  return <HBars rows={d.map((p) => ({ label: p.product, value: p.revenue, note: `${p.units} ${p.unit || 'units'} sold` }))} format={money} empty="No completed sales yet." />;
}

export default function Reports() {
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [shownId, setShownId] = useState(null);
  const [fresh, setFresh] = useState(null);
  const [busy, setBusy] = useState('');
  const history = useFetch(() => adminApi.reports(), [tick]);
  const list = history.data?.reports || [];
  const shown = fresh?._id === shownId ? fresh : list.find((r) => r._id === shownId) || (!shownId ? list[0] : null);
  useEffect(() => {
    if (!shownId && list[0]) setShownId(list[0]._id);
  }, [list, shownId]);

  const generate = async (type) => {
    setBusy(type);
    try {
      const res = await adminApi.generateReport(type);
      setFresh(res.data.report);
      setShownId(res.data.report._id);
      setTick((previousTick) => previousTick + 1);
      toast(`${LABEL[type]} generated`);
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <header className="ad-head">
        <div>
          <span className="kicker dark">Reports</span>
          <h1>Reports and analytics</h1>
          <p className="muted">Generate a snapshot from live data, review it here and download it as CSV. Every report is saved for later.</p>
        </div>
      </header>

      <section className="report-cards">
        {TYPES.map(([v, label, desc, Icon]) => (
          <button key={v} className="report-card" disabled={!!busy} onClick={() => generate(v)}>
            <span className="kpi-ico">
              <Icon width={20} height={20} />
            </span>
            <strong>{label}</strong>
            <small>{desc}</small>
            <span className="report-go">{busy === v ? 'Generating…' : 'Generate →'}</span>
          </button>
        ))}
      </section>

      <div className="report-split">
        <aside className="ad-card flush">
          <div className="ad-card-head pad">
            <h2>History</h2>
            <span className="muted small">{list.length} saved</span>
          </div>
          <ul className="report-list">
            {list.map((r) => (
              <li key={r._id}>
                <button className={shown?._id === r._id ? 'on' : ''} onClick={() => setShownId(r._id)}>
                  <strong>{LABEL[r.reportType]}</strong>
                  <small>
                    {timeAgo(r.generatedAt)} · {r.generatedBy?.name}
                  </small>
                </button>
              </li>
            ))}
            {!history.loading && !list.length && <li className="empty small">No reports yet. Generate one above.</li>}
          </ul>
        </aside>
        <div className="ad-card">
          {shown ? (
            <>
              <div className="ad-card-head">
                <div>
                  <h2>{LABEL[shown.reportType]}</h2>
                  <span className="muted small">Generated {new Date(shown.generatedAt).toLocaleString()}</span>
                </div>
                <div className="ad-tools">
                  <button className="btn btn-outline btn-sm" onClick={() => downloadExcel(shown)}>
                    <IconDownload width={16} height={16} /> Excel
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => download(shown)}>
                    <IconDownload width={16} height={16} /> CSV
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                    Print
                  </button>
                </div>
              </div>
              <ReportBody report={shown} />
            </>
          ) : (
            <div className="empty">
              <strong>Pick or generate a report</strong>
              <span className="muted">Results appear here with charts you can download.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
