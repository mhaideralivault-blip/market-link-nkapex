import { useEffect, useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { categoriesApi, productsApi, uploadImage, errorMessage, imageUrl } from '../../services/api';
import ApprovalBanner from '../../components/ApprovalBanner';
import { PageHead, Status } from '../../components/Common';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { TAGS, timeAgo } from '../../utils';

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
    <form className="stack" onSubmit={submit}>
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

const rowFrom = (p) => ({
  id: p._id,
  price: p.price,
  quantityAvailable: p.quantityAvailable,
  available: p.available,
  tplEnabled: !!p.weeklyTemplate?.enabled,
  tplQuantity: p.weeklyTemplate?.quantity ?? 0,
});
const rowDiff = (row, p) => ({
  price: Number(row.price) !== p.price,
  quantityAvailable: Number(row.quantityAvailable) !== p.quantityAvailable,
  available: row.available !== p.available,
  weeklyTemplate: row.tplEnabled !== !!p.weeklyTemplate?.enabled || Number(row.tplQuantity || 0) !== (p.weeklyTemplate?.quantity ?? 0),
});
const rowIsDirty = (row, p) => Object.values(rowDiff(row, p)).some(Boolean);

// Spreadsheet-style bulk editor: every product's price, stock, visibility and weekly template are
// editable inline, several rows can be selected for a bulk action, and unsaved changes are saved
// (or applied on the spot for the weekly template) without opening the full edit form per product.
function ProductsTable({ products, onChanged, onEdit }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [rows, setRows] = useState(() => products.map(rowFrom));
  const [selected, setSelected] = useState(() => new Set());
  const [applying, setApplying] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const byId = Object.fromEntries(products.map((p) => [p._id, p]));

  const setRow = (id, patch) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const toggleSelected = (id) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelected((current) => (current.size === rows.length ? new Set() : new Set(rows.map((row) => row.id))));

  const dirtyRows = rows.filter((row) => rowIsDirty(row, byId[row.id]));

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const items = dirtyRows.map((row) => {
        const diff = rowDiff(row, byId[row.id]);
        const item = { id: row.id };
        if (diff.price) item.price = Number(row.price) || 0;
        if (diff.quantityAvailable) item.quantityAvailable = Number(row.quantityAvailable) || 0;
        if (diff.available) item.available = row.available;
        if (diff.weeklyTemplate) item.weeklyTemplate = { enabled: row.tplEnabled, quantity: Number(row.tplQuantity) || 0 };
        return item;
      });
      await productsApi.bulkUpdate(items);
      toast(`Saved ${items.length} product${items.length === 1 ? '' : 's'}.`);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const discard = () => setRows(products.map(rowFrom));

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

  const bulkAction = async (label, fn) => {
    setError('');
    setBusy(true);
    try {
      for (const id of selected) await fn(id);
      toast(label);
      setSelected(new Set());
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const bulkDelete = async () => {
    if (!(await confirm({ title: `Delete ${selected.size} product${selected.size === 1 ? '' : 's'}?`, message: 'Customers will no longer see these. Past orders keep their history.', confirmText: 'Delete', danger: true }))) return;
    bulkAction('Products deleted.', (id) => productsApi.remove(id));
  };

  if (!products.length) return null;

  return (
    <div className="card stack mb weekly-stock">
      <div className="between">
        <div>
          <h2>Products</h2>
          <p className="muted small">Edit price, stock and the weekly template inline. Select rows for bulk actions, or select none and just edit — a save bar appears when you have changes.</p>
        </div>
      </div>
      {selected.size > 0 && (
        <div className="bulk-bar">
          <strong>{selected.size} selected</strong>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => bulkAction('Marked sold out.', (id) => productsApi.setStatus(id, 'sold_out'))}>Mark sold out</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => bulkAction('Hidden.', (id) => productsApi.setStatus(id, 'unavailable'))}>Hide</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => bulkAction('Shown again.', (id) => productsApi.setStatus(id, 'available'))}>Show</button>
          <button type="button" className="btn btn-ghost btn-sm danger-text" disabled={busy} onClick={bulkDelete}>Delete</button>
        </div>
      )}
      <div className="table-wrap">
        <table className="table ad-table weekly-stock-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} aria-label="Select all products" /></th>
              <th>Product</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Visible</th>
              <th>Weekly template</th>
              <th>Weekly qty</th>
              <th>Last applied</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const p = byId[row.id];
              const stale = row.tplEnabled && daysSince(p.weeklyTemplate?.appliedAt) > STALE_DAYS;
              const [cls, label] = STATUS_TAG[p.status];
              return (
                <tr key={row.id} className={rowIsDirty(row, p) ? 'row-dirty' : ''}>
                  <td data-label=""><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Select ${p.name}`} /></td>
                  <td data-label="Product">
                    <div className="pt-product">
                      <span className="cart-thumb sm">{p.image ? <img src={imageUrl(p.image)} alt="" /> : <span aria-hidden>🥬</span>}</span>
                      <span>
                        <strong>{p.name}</strong>
                        <span className={cls}>{label}</span>
                        <small className="muted">{p.category?.name} / {p.unit}</small>
                      </span>
                    </div>
                  </td>
                  <td data-label="Price"><input className="qty" type="number" min="0" step="0.01" value={row.price} onChange={(event) => setRow(row.id, { price: event.target.value })} /></td>
                  <td data-label="Stock"><input className="qty" type="number" min="0" value={row.quantityAvailable} onChange={(event) => setRow(row.id, { quantityAvailable: event.target.value })} /></td>
                  <td data-label="Visible">
                    <label className="check"><input type="checkbox" checked={row.available} onChange={(event) => setRow(row.id, { available: event.target.checked })} /></label>
                  </td>
                  <td data-label="Weekly template">
                    <label className="check"><input type="checkbox" checked={row.tplEnabled} onChange={(event) => setRow(row.id, { tplEnabled: event.target.checked })} /> Enabled</label>
                  </td>
                  <td data-label="Weekly qty">
                    <input className="qty" type="number" min="0" disabled={!row.tplEnabled} value={row.tplQuantity} onChange={(event) => setRow(row.id, { tplQuantity: event.target.value })} />
                  </td>
                  <td data-label="Last applied">
                    {p.weeklyTemplate?.appliedAt ? (
                      <span className={stale ? 'danger-text' : 'muted small'}>{timeAgo(p.weeklyTemplate.appliedAt)}{stale ? ' — overdue' : ''}</span>
                    ) : (
                      <span className="muted small">{row.tplEnabled ? 'Never applied' : '—'}</span>
                    )}
                  </td>
                  <td data-label="">
                    <div className="row-gap">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(p)}>Edit</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={!p.weeklyTemplate?.enabled || applying === row.id} onClick={() => applyNow(row.id)}>
                        {applying === row.id ? 'Applying...' : 'Apply now'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {dirtyRows.length > 0 && (
        <div className="bulk-bar save-bar">
          <strong>{dirtyRows.length} unsaved change{dirtyRows.length === 1 ? '' : 's'}</strong>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save changes'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={discard}>Discard</button>
        </div>
      )}
    </div>
  );
}

export default function Products() {
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
  const closeEditor = () => setEditing(null);

  useEffect(() => {
    if (!editing) return undefined;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => event.key === 'Escape' && closeEditor();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

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
        <div className="modal-back" onMouseDown={(event) => event.target === event.currentTarget && closeEditor()}>
          <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label={editing === 'new' ? 'Add product' : 'Edit product'}>
            <button type="button" className="icon-btn modal-close" aria-label="Close" onClick={closeEditor}>
              ✕
            </button>
            <ProductForm
              key={editing === 'new' ? 'new' : editing._id}
              id={editing === 'new' ? null : editing._id}
              initial={editing === 'new' ? EMPTY : toForm(editing)}
              categories={cats.data?.categories || []}
              onCancel={closeEditor}
              onSaved={() => {
                closeEditor();
                setMsg({ type: 'info', text: 'Product saved.' });
                reload();
              }}
            />
          </div>
        </div>
      )}

      <Status loading={loading} error={error} empty={!products.length} emptyText="You have not added any products yet." />
      {!!products.length && <ProductsTable key={tick} products={products} onChanged={reload} onEdit={setEditing} />}
    </>
  );
}
