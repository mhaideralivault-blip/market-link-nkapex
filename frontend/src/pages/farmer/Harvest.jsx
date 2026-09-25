import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { categoriesApi, harvestsApi, errorMessage } from '../../services/api';
import ApprovalBanner from '../../components/ApprovalBanner';
import { EmptyState, PageHead, Status } from '../../components/Common';
import { IconCalendar } from '../../components/Icons';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const EMPTY = { title: '', category: '', expectedDate: '', estimatedQuantity: '', unit: 'kg', description: '' };
const LABEL = { upcoming: 'Upcoming', available: 'Now available', cancelled: 'Cancelled' };

function HarvestForm({ initial, categories, editing, onSaved, onCancel }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (event) => setF({ ...f, [k]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const body = { title: f.title, category: f.category, expectedDate: f.expectedDate, estimatedQuantity: f.estimatedQuantity, unit: f.unit, description: f.description };
    try {
      await (editing ? harvestsApi.update(editing, body) : harvestsApi.create(body));
      onSaved(editing ? 'Harvest updated' : 'Announced! Customers who follow your stall have been alerted.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{editing ? 'Edit announcement' : 'Announce upcoming produce'}</h2>
      <div className="grid grid-2">
        <label>
          What is coming?
          <input required maxLength={80} value={f.title} onChange={set('title')} placeholder="e.g. Sindhri mangoes" />
        </label>
        <label>
          Expected on
          <input required type="date" min={today()} value={f.expectedDate} onChange={set('expectedDate')} />
        </label>
        <label>
          Category
          <select value={f.category} onChange={set('category')}>
            <option value="">Choose (optional)</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-2">
          <label>
            Estimated amount
            <input type="number" min="0" step="any" value={f.estimatedQuantity} onChange={set('estimatedQuantity')} placeholder="e.g. 100" />
          </label>
          <label>
            Unit
            <input maxLength={20} value={f.unit} onChange={set('unit')} />
          </label>
        </div>
      </div>
      <label>
        Details
        <textarea rows={2} maxLength={400} value={f.description} onChange={set('description')} placeholder="Variety, how it is grown, why customers will love it..." />
      </label>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving...' : editing ? 'Save changes' : 'Announce'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function FarmerHarvest() {
  const confirm = useConfirm();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const { data, loading, error } = useFetch(() => harvestsApi.mine(), [tick]);
  const cats = useFetch(() => categoriesApi.list(), []);
  const categories = cats.data?.categories || [];
  const harvests = data?.harvests || [];
  const refresh = () => setTick((previousTick) => previousTick + 1);

  const act = async (harvest, status) => {
    const available = status === 'available';
    const message = available
      ? `${harvest.subscriberCount} ${harvest.subscriberCount === 1 ? 'customer is' : 'customers are'} waiting and will be alerted right now. Make sure the product is listed under My Products.`
      : harvest.subscriberCount
        ? `${harvest.subscriberCount} customer${harvest.subscriberCount === 1 ? '' : 's'} will be told it is cancelled.`
        : 'This announcement will be cancelled.';
    if (!(await confirm({ title: available ? 'Mark as available now?' : 'Cancel this harvest?', message, confirmText: available ? 'Yes, notify customers' : 'Cancel harvest', danger: !available }))) return;
    setBusy(harvest._id);
    try {
      const res = (await harvestsApi.setStatus(harvest._id, status)).data;
      toast(available ? `Alert sent to ${res.notified} customer${res.notified === 1 ? '' : 's'}` : 'Harvest cancelled');
      refresh();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const editingHarvest = harvests.find((h) => h._id === editing);
  const initial = editingHarvest
    ? { title: editingHarvest.title, category: editingHarvest.category?._id || '', expectedDate: editingHarvest.expectedDate, estimatedQuantity: editingHarvest.estimatedQuantity ?? '', unit: editingHarvest.unit || 'kg', description: editingHarvest.description || '' }
    : EMPTY;

  return (
    <>
      <PageHead kicker="Harvest calendar" title="Announce what's coming" sub="Tell customers about produce before it is ready. They tap Notify me and get an alert the moment you mark it available." />
      <ApprovalBanner />
      <HarvestForm
        key={editing || 'new'}
        initial={initial}
        categories={categories}
        editing={editing}
        onCancel={editing ? () => setEditing(null) : undefined}
        onSaved={(message) => {
          toast(message);
          setEditing(null);
          refresh();
        }}
      />
      <h2 className="section-title">Your announcements</h2>
      <Status loading={loading && !data} error={error} />
      {data && !harvests.length && <EmptyState icon={IconCalendar} title="No announcements yet" text="Announce your first upcoming harvest above." />}
      <div className="stack">
        {harvests.map((harvest) => (
          <article className={`card hv-mine s-${harvest.status}`} key={harvest._id}>
            <div className="between">
              <div>
                <strong>{harvest.title}</strong>
                <div className="muted small">
                  {harvest.expectedDate}
                  {harvest.estimatedQuantity ? ` · about ${harvest.estimatedQuantity} ${harvest.unit}` : ''}
                  {harvest.category?.name ? ` · ${harvest.category.name}` : ''}
                </div>
              </div>
              <span className={`tag ${harvest.status === 'upcoming' ? 'tag-warn' : harvest.status === 'cancelled' ? 'tag-cancelled' : ''}`}>{LABEL[harvest.status]}</span>
            </div>
            <div className="between hv-mine-foot">
              <span className="small">
                <b>{harvest.subscriberCount}</b> {harvest.subscriberCount === 1 ? 'customer' : 'customers'} waiting
              </span>
              {harvest.status === 'upcoming' && (
                <span className="po-actions">
                  <button className="btn btn-sm" disabled={busy === harvest._id} onClick={() => act(harvest, 'available')}>
                    Mark available
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => setEditing(harvest._id)}>
                    Edit
                  </button>
                  <button className="btn btn-sm btn-ghost" disabled={busy === harvest._id} onClick={() => act(harvest, 'cancelled')}>
                    Cancel
                  </button>
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
