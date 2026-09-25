import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { errorMessage, familyApi, ordersApi } from '../services/api';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, PageHead, ProductCard, Status, StatusTag } from '../components/Common';
import { IconUsers } from '../components/Icons';
import { money } from '../utils';

const TABS = [['members', 'Members'], ['orders', 'Family orders'], ['favorites', 'Family favorites']];

export default function Family() {
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState('members');
  const [tick, setTick] = useState(0);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { data, loading, error: loadError } = useFetch(() => familyApi.get(), [tick]);
  const inGroup = !!data?.group;
  const orders = useFetch(() => (inGroup && tab === 'orders' ? ordersApi.list({ family: 1, limit: 30 }) : Promise.resolve({ data: null })), [inGroup, tab, tick]);
  const favorites = useFetch(() => (inGroup && tab === 'favorites' ? familyApi.favorites() : Promise.resolve({ data: null })), [inGroup, tab, tick]);

  const run = async (action, success) => {
    setError('');
    setBusy(true);
    try {
      await action();
      if (success) toast(success);
      setTick((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const invite = (event) => {
    event.preventDefault();
    run(async () => {
      await familyApi.invite(email.trim());
      setEmail('');
    }, 'Invitation sent');
  };

  const leave = async () => {
    const owner = data.group.isOwner;
    const ok = await confirm({
      title: owner ? 'Disband the family group?' : 'Leave the family group?',
      message: owner ? 'Everyone will be removed from the group. Your accounts and orders stay untouched.' : 'You will no longer see each other\'s orders and favorites.',
      confirmText: owner ? 'Disband' : 'Leave',
      danger: true,
    });
    if (ok) run(() => familyApi.leave(), owner ? 'Family group disbanded' : 'You left the group');
  };

  const removeMember = async (member) => {
    if (await confirm({ title: `Remove ${member.name}?`, message: 'They will no longer share orders and favorites with the group.', confirmText: 'Remove', danger: true })) {
      run(() => familyApi.removeMember(member._id), 'Member removed');
    }
  };

  if (loading || loadError) return <Status loading={loading} error={loadError} />;
  const group = data.group;
  const canInvite = !group || group.isOwner;

  return (
    <>
      <PageHead kicker="Household" title="Family account" sub="Share orders and favorites with people you shop with. Everyone keeps their own login; only the person who placed an order can change or cancel it." />
      {error && <p className="alert alert-error">{error}</p>}

      {data.invites.length > 0 && !group && (
        <div className="card mt">
          <h2>Invitations</h2>
          {data.invites.map((item) => (
            <div key={item.from} className="between" style={{ padding: '8px 0' }}>
              <span>
                <strong>{item.fromName}</strong> invited you to their family account.
              </span>
              <span className="row-gap">
                <button className="btn" disabled={busy} onClick={() => run(() => familyApi.accept(item.from), 'You joined the family group')}>
                  Accept
                </button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => familyApi.decline(item.from))}>
                  Decline
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {group && (
        <div className="seg" role="tablist">
          {TABS.map(([value, label]) => (
            <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <>
          {!group && <EmptyState icon={IconUsers} title="You are not in a family group yet" text="Invite a family member by the e-mail of their MarketLink customer account to start sharing." />}
          {group && (
            <div className="card mt">
              <h2>Members ({group.members.length})</h2>
              {group.members.map((member) => (
                <div key={member._id} className="between" style={{ padding: '8px 0' }}>
                  <span>
                    <strong>{member.name}</strong> {member._id === group.owner && <span className="chip-static">Owner</span>}
                    {member._id === data.me && ' (you)'}
                    <br />
                    <small className="muted">{member.email}</small>
                  </span>
                  {group.isOwner && member._id !== group.owner && (
                    <button className="btn btn-ghost" disabled={busy} onClick={() => removeMember(member)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canInvite && (
            <form className="card mt" onSubmit={invite}>
              <h2>Invite a family member</h2>
              <label>
                Their MarketLink e-mail
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
              </label>
              <button className="btn" disabled={busy}>
                {busy ? 'Sending...' : 'Send invitation'}
              </button>
            </form>
          )}

          {group && (
            <button className="btn btn-danger mt" disabled={busy} onClick={leave}>
              {group.isOwner ? 'Disband family group' : 'Leave family group'}
            </button>
          )}
        </>
      )}

      {group && tab === 'orders' && (
        <>
          <Status loading={orders.loading} error={orders.error} />
          {orders.data && !orders.data.orders.length && <EmptyState icon={IconUsers} title="No family orders yet" text="Orders placed by anyone in the group show up here." />}
          <div className="order-list mt">
            {orders.data?.orders.map((order) => (
              <Link to={`/orders/${order._id}`} className="order-tile" key={order._id}>
                <div className="ot-top">
                  <div>
                    <strong className="ot-farmer">{order.farmer?.farmerProfile?.stallName}</strong>
                    <small className="muted">
                      #{order._id.slice(-6).toUpperCase()} · by {order.customer?.name}
                    </small>
                  </div>
                  <StatusTag status={order.status} />
                </div>
                <div className="ot-foot">
                  <span className="muted small">
                    Pickup {order.pickupDate}, {order.pickupSlot.start}–{order.pickupSlot.end}
                  </span>
                  <strong>{money(order.totalAmount)}</strong>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {group && tab === 'favorites' && (
        <>
          <Status loading={favorites.loading} error={favorites.error} />
          {favorites.data && !favorites.data.favorites.products.length && <EmptyState icon={IconUsers} title="No shared favorites yet" text="Products anyone in the group hearts appear here." to="/products" cta="Browse products" />}
          <div className="grid grid-products mt">
            {favorites.data?.favorites.products.map((item) => (
              <div key={item._id}>
                <ProductCard product={{ ...item, quantityAvailable: item.available ? item.quantityAvailable : 0 }} />
                <small className="muted">Saved by {item.savedBy.join(', ')}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
