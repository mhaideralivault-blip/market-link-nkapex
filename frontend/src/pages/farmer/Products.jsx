import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { categoriesApi, productsApi, uploadImage, errorMessage, imageUrl } from '../../services/api';
import ApprovalBanner from '../../components/ApprovalBanner';
import { PageHead, Status } from '../../components/Common';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { money, TAGS, timeAgo } from '../../utils';

const todayInput = () => new Date().toISOString().slice(0, 10);

const EMPTY = { name: '', category: '', price: '', unit: 'kg', quantityAvailable: '', description: '', image: '', harvestedOn: todayInput(), storage: '', tags: [], tplEnabled: false, tplQuantity: '' };

const toForm = (p) => ({
  name: p.name,
  category: p.category?._id || p.category,
  price: p.price,
  unit: p.unit,
  quantityAvailable: p.quantityAvailable,
  description: p.description || '',
  image: p.image || '',
  harvestedOn: p.harvestedOn ? p.harvestedOn.slice(0, 10) : '',
  storage: p.storage || '',
  tags: p.tags || [],
  tplEnabled: !!p.weeklyTemplate?.enabled,
  tplQuantity: p.weeklyTemplate?.quantity ?? '',
});

function ProductForm({ initial, categories, onSaved, onCancel, id }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (event) => setF({ ...f, [k]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });

  const upload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setError('');
    try {
      const res = await uploadImage(file);
      setF((cur) => ({ ...cur, image: res.data.url }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const body = {
      name: f.name.trim(),
      category: f.category,
      price: Number(f.price),
      unit: f.unit.trim(),
      quantityAvailable: Number(f.quantityAvailable),
      description: f.description.trim(),
      image: f.image,
      harvestedOn: f.harvestedOn || null,
      storage: f.storage.trim(),
      tags: f.tags,
      weeklyTemplate: { enabled: f.tplEnabled, quantity: Number(f.tplQuantity) || 0 },
    };
    try {
      await (id ? productsApi.update(id, body) : productsApi.create(body));
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack mb" onSubmit={submit}>
      <h2>{id ? 'Edit product' : 'Add product'}</h2>
      <div className="grid grid-3">
        <label>
          Name
          <input required maxLength={100} value={f.name} onChange={set('name')} />
        </label>
        <label>
          Category
          <select required value={f.category} onChange={set('category')}>
            <option value="">Select</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unit (kg, dozen, bunch...)
          <input required maxLength={20} value={f.unit} onChange={set('unit')} />
        </label>
        <label>
          Price per unit
          <input required type="number" min="0" step="0.01" value={f.price} onChange={set('price')} />
        </label>
        <label>
          Quantity available
          <input required type="number" min="0" step="1" value={f.quantityAvailable} onChange={set('quantityAvailable')} />
        </label>
        <label>
          Image (JPG, PNG or WEBP, max 2 MB)
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
        </label>
      </div>
      {f.image && (
        <div className="cart-thumb">
          <img src={imageUrl(f.image)} alt="Product preview" />
        </div>
      )}
      <label>
        Description
        <textarea rows={2} maxLength={1000} value={f.description} onChange={set('description')} />
      </label>
      <div className="grid grid-3">
        <label>
          Harvested / made on
          <input type="date" max={todayInput()} value={f.harvestedOn} onChange={set('harvestedOn')} />
          <small className="muted">Shown as a freshness badge, e.g. &quot;Harvested today&quot;.</small>
        </label>
        <label style={{ gridColumn: 'span 2' }}>
          Storage tip (optional)
          <input maxLength={200} placeholder="e.g. Refrigerate, best within 5 days" value={f.storage} onChange={set('storage')} />
        </label>
      </div>
      <fieldset>
        <legend>Badges customers can filter and trust</legend>
        <div className="tag-picker">
          {TAGS.map(([v, label]) => (
            <label key={v} className={`tag-opt ${f.tags.includes(v) ? 'on' : ''}`}>
              <input type="checkbox" checked={f.tags.includes(v)} onChange={() => setF({ ...f, tags: f.tags.includes(v) ? f.tags.filter((tag) => tag !== v) : [...f.tags, v] })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row-gap">
        <label className="check">
          <input type="checkbox" checked={f.tplEnabled} onChange={set('tplEnabled')} /> Include in weekly stock template
        </label>
        {f.tplEnabled && (
          <label className="inline">
            Weekly quantity
            <input className="qty" type="number" min="0" value={f.tplQuantity} onChange={set('tplQuantity')} />
          </label>
        )}
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving...' : 'Save product'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const STATUS_TAG = { available: ['tag', 'In stock'], sold_out: ['tag tag-warn', 'Sold out'], unavailable: ['tag tag-cancelled', 'Unavailable'] };

const STALE_DAYS = 7;
const daysSince = (date) => (date ? (Date.now() - new Date(date).getTime()) / 86_400_000 : Infinity);

// Bulk-edit table: flip a product's weekly template on/off and set its quantity without opening the full edit form,
// see each one's last-applied date at a glance, and refresh a single product's stock on the spot.
function WeeklyStock({ products, onChanged }) {
  const toast = useToast();
  const [rows, setRows] = useState(() => products.map((p) => ({ id: p._id, enabled: !!p.weeklyTemplate?.enabled, quantity: p.weeklyTemplate?.quantity ?? 0 })));
  const [applying, setApplying] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const byId = Object.fromEntries(products.map((p) => [p._id, p]));

  const setRow = (id, patch) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const dirty = rows.some((row) => {
    const p = byId[row.id];
    return !!p.weeklyTemplate?.enabled !== row.enabled || (p.weeklyTemplate?.quantity ?? 0) !== Number(row.quantity || 0);
  });

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const items = rows
        .filter((row) => {
          const p = byId[row.id];
          return !!p.weeklyTemplate?.enabled !== row.enabled || (p.weeklyTemplate?.quantity ?? 0) !== Number(row.quantity || 0);
        })
        .map((row) => ({ id: row.id, enabled: row.enabled, quantity: Number(row.quantity) || 0 }));
      await productsApi.bulkUpdateTemplates(items);
      toast('Weekly stock template updated.');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const applyNow = async (id) => {
    setError('');
    setApplying(id);
    try {
      await productsApi.applyTemplateOne(id);
      toast('Stock refreshed from the weekly template.');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setApplying(null);
    }
  };

  if (!products.length) return null;

  return (
    <div className="card stack mb weekly-stock">
      <div className="between">
        <div>
          <h2>Weekly stock</h2>
          <p className="muted small">Turn on a weekly template and set the quantity to restock automatically every Monday, or refresh a single product any time.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table ad-table weekly-stock-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Current stock</th>
              <th>Weekly template</th>
              <th>Weekly quantity</th>
              <th>Last applied</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const p = byId[row.id];
              const stale = row.enabled && daysSince(p.weeklyTemplate?.appliedAt) > STALE_DAYS;
              return (
                <tr key={row.id}>
                  <td data-label="Product">{p.name}</td>
                  <td data-label="Current stock">{p.quantityAvailable} {p.unit}</td>
                  <td data-label="Weekly template">
                    <label className="check">
                      <input type="checkbox" checked={row.enabled} onChange={(event) => setRow(row.id, { enabled: event.target.checked })} /> Enabled
                    </label>
                  </td>
                  <td data-label="Weekly quantity">
                    <input className="qty" type="number" min="0" disabled={!row.enabled} value={row.quantity} onChange={(event) => setRow(row.id, { quantity: event.target.value })} />
                  </td>
                  <td data-label="Last applied">
                    {p.weeklyTemplate?.appliedAt ? (
                      <span className={stale ? 'danger-text' : 'muted small'}>{timeAgo(p.weeklyTemplate.appliedAt)}{stale ? ' — overdue' : ''}</span>
                    ) : (
                      <span className="muted small">{row.enabled ? 'Never — apply once to start the weekly cycle' : '—'}</span>
                    )}
                  </td>
                  <td data-label="">
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!p.weeklyTemplate?.enabled || applying === row.id} onClick={() => applyNow(row.id)}>
                      {applying === row.id ? 'Applying...' : 'Apply now'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button type="button" className="btn btn-sm" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Saving...' : 'Save weekly stock'}
        </button>
      </div>
    </div>
  );
}

export default function Products() {
  const confirm = useConfirm();
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [msg, setMsg] = useState({ type: '', text: '' });
  const { data, loading, error } = useFetch(() => productsApi.mine(), [tick]);
  const cats = useFetch(() => categoriesApi.list(), []);
  const reload = () => setTick((previousTick) => previousTick + 1);

  const run = async (fn, okText) => {
    setMsg({ type: '', text: '' });
    try {
      await fn();
      if (okText) setMsg({ type: 'info', text: okText });
      reload();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  const products = data?.products || [];

  return (
    <>
      <PageHead kicker="Stock" title="My products" sub={`${products.length} product${products.length === 1 ? '' : 's'} listed. Keep quantities current so customers never order what you cannot supply.`}>
        <div className="row-gap">
          <button className="btn btn-outline btn-sm" onClick={() => run(async () => { const r = await productsApi.applyTemplate(); setMsg({ type: 'info', text: `Weekly template applied to ${r.data.updated} product(s).` }); })}>
            Apply weekly template
          </button>
          <button className="btn btn-sm" onClick={() => setEditing('new')}>
            Add product
          </button>
        </div>
      </PageHead>
      <ApprovalBanner />
      {msg.text && <p className={`alert alert-${msg.type}`}>{msg.text}</p>}

      {editing && (
        <ProductForm
          key={editing === 'new' ? 'new' : editing._id}
          id={editing === 'new' ? null : editing._id}
          initial={editing === 'new' ? EMPTY : toForm(editing)}
          categories={cats.data?.categories || []}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMsg({ type: 'info', text: 'Product saved.' });
            reload();
          }}
        />
      )}

      <Status loading={loading} error={error} empty={!products.length} emptyText="You have not added any products yet." />
      {!!products.length && <WeeklyStock key={tick} products={products} onChanged={reload} />}
      <div className="stack">
        {products.map((product) => {
          const [cls, label] = STATUS_TAG[product.status];
          return (
            <div className="card prod-row" key={product._id}>
              <div className="cart-thumb">{product.image ? <img src={imageUrl(product.image)} alt="" /> : <span aria-hidden>🥬</span>}</div>
              <div className="cart-info">
                <strong>{product.name}</strong> <span className={cls}>{label}</span>
                <div className="muted small">
                  {product.category?.name} · {money(product.price)} / {product.unit} · {product.quantityAvailable} in stock
                  {product.weeklyTemplate?.enabled && ` · weekly template: ${product.weeklyTemplate.quantity}`}
                </div>
              </div>
              <div className="row-gap">
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(product)}>
                  Edit
                </button>
                {product.status !== 'sold_out' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => productsApi.setStatus(product._id, 'sold_out'))}>
                    Mark sold out
                  </button>
                )}
                {product.available ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => productsApi.setStatus(product._id, 'unavailable'))}>
                    Hide temporarily
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => productsApi.setStatus(product._id, 'available'))}>
                    Show again
                  </button>
                )}
                <button className="btn btn-ghost btn-sm danger-text" onClick={async () => (await confirm({ title: `Delete ${product.name}?`, message: 'Customers will no longer see this product. Past orders keep their history.', confirmText: 'Delete', danger: true })) && run(() => productsApi.remove(product._id), 'Product deleted.')}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
