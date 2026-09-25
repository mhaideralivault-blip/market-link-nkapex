// Usage: npm run test:harvest  (server must be running; set API_URL to test a deployed backend)
// Exercises the Harvest calendar + Notify me flow through the HTTP API. Cleans up everything it creates.
require('dotenv').config();
const mongoose = require('mongoose');
const R = (m) => require('../models/' + m);
const B = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const call = async (method, path, token, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, ...(await r.json().catch(() => ({}))) };
};
const t = (label, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label} ${extra}`); if (!cond) process.exitCode = 1; };
const day = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
(async () => {
  const P = 'Password@123';
  const login = async (email) => (await call('POST', '/auth/login', null, { email, password: P })).token;
  const cust = await login('customer@marketlink.test'), farm = await login('farmer@marketlink.test'), pend = await login('pending.farmer@marketlink.test'), other = await login('bluewater.catch@marketlink.test');
  const start = new Date();
  const me = (await call('GET', '/auth/me', farm)).user;
  const custMe = (await call('GET', '/auth/me', cust)).user;

  let r = await call('GET', '/harvests');
  t('Public calendar lists upcoming harvests (guest)', r.s === 200 && r.harvests.length >= 9 && r.harvests.every((h) => h.subscribed === false && h.subscriberCount !== undefined && !h.subscribers), `count=${r.harvests?.length}`);
  t('Sorted by date, farmer stall included', r.harvests[0].farmer?.farmerProfile?.stallName && r.harvests.every((h, i, a) => !i || a[i - 1].expectedDate <= h.expectedDate));

  // permissions & validation
  r = await call('POST', '/harvests', cust, { title: 'x', expectedDate: day(3) }); t('Customer cannot create (403)', r.s === 403, String(r.s));
  r = await call('POST', '/harvests', pend, { title: 'x', expectedDate: day(3) }); t('Unapproved farmer cannot create (403)', r.s === 403, String(r.s));
  r = await call('POST', '/harvests', null, { title: 'x', expectedDate: day(3) }); t('Guest cannot create (401)', r.s === 401, String(r.s));
  r = await call('POST', '/harvests', farm, { title: '  ', expectedDate: day(3) }); t('Title required (400)', r.s === 400, r.message);
  r = await call('POST', '/harvests', farm, { title: 'QA Melons', expectedDate: day(-2) }); t('Past date rejected (400)', r.s === 400, r.message);
  r = await call('POST', '/harvests', farm, { title: 'QA Melons', expectedDate: 'soon' }); t('Bad date rejected (400)', r.s === 400, r.message);
  r = await call('POST', '/harvests', farm, { title: 'QA Melons', expectedDate: day(3), estimatedQuantity: -5 }); t('Negative quantity rejected (400)', r.s === 400, r.message);

  // customer follows the stall -> "Coming soon" alert on creation
  await call('PUT', `/customer/favorites/farmers/${me._id}`, cust);
  r = await call('POST', '/harvests', farm, { title: 'QA Melons', description: 'test', expectedDate: day(3), estimatedQuantity: 50, unit: 'kg' });
  t('Approved farmer creates harvest (201)', r.s === 201 && r.harvest.status === 'upcoming', r.message || '');
  const id = r.harvest._id;
  let notes = (await call('GET', '/notifications', cust)).notifications || [];
  t('Follower gets "Coming soon" alert', notes.some((n) => n.title === 'Coming soon' && /QA Melons/.test(n.message) && n.type === 'harvest'));

  // subscribe
  r = await call('POST', `/harvests/${id}/subscribe`, farm); t('Farmer cannot subscribe (403)', r.s === 403, String(r.s));
  r = await call('POST', `/harvests/${id}/subscribe`, cust); t('Customer taps Notify me', r.s === 200 && r.harvest.subscribed === true && r.harvest.subscriberCount === 1, JSON.stringify({ c: r.harvest?.subscriberCount }));
  r = await call('POST', `/harvests/${id}/subscribe`, cust); t('Subscribing twice does not duplicate', r.harvest.subscriberCount === 1);
  r = await call('GET', '/harvests', cust); t('Calendar shows subscribed=true for this customer', r.harvests.find((h) => h._id === id)?.subscribed === true);
  r = await call('GET', '/harvests'); t('Guest still sees subscribed=false, count only', r.harvests.find((h) => h._id === id)?.subscribed === false && r.harvests.find((h) => h._id === id)?.subscriberCount === 1);
  r = await call('GET', '/harvests/mine', farm); t('Farmer sees own harvest with subscriber count', r.harvests.find((h) => h._id === id)?.subscriberCount === 1);
  r = await call('GET', '/harvests/mine', other); t("Other farmer does not see it", !r.harvests.some((h) => h._id === id));

  // edit
  r = await call('PUT', `/harvests/${id}`, other, { title: 'Hacked' }); t("Other farmer cannot edit (404)", r.s === 404, String(r.s));
  r = await call('PUT', `/harvests/${id}`, farm, { expectedDate: day(5) }); t('Farmer changes the date', r.s === 200 && r.harvest.expectedDate === day(5), r.message || '');
  notes = (await call('GET', '/notifications', cust)).notifications;
  t('Subscriber gets "Date changed" alert', notes.some((n) => n.title === 'Date changed' && n.message.includes(day(5))));

  // unsubscribe / resubscribe
  r = await call('DELETE', `/harvests/${id}/subscribe`, cust); t('Customer can unsubscribe', r.s === 200 && r.harvest.subscribed === false && r.harvest.subscriberCount === 0);
  await call('POST', `/harvests/${id}/subscribe`, cust);

  // available
  r = await call('PATCH', `/harvests/${id}/status`, other, { status: 'available' }); t('Other farmer cannot change status (404)', r.s === 404, String(r.s));
  r = await call('PATCH', `/harvests/${id}/status`, farm, { status: 'bogus' }); t('Invalid status rejected (400)', r.s === 400);
  r = await call('PATCH', `/harvests/${id}/status`, farm, { status: 'available' }); t('Farmer marks it available, 1 subscriber notified', r.s === 200 && r.notified === 1 && r.harvest.status === 'available', r.message || '');
  notes = (await call('GET', '/notifications', cust)).notifications;
  t('Subscriber gets "Now available!" alert (restock type)', notes.some((n) => n.title === 'Now available!' && n.type === 'restock' && /QA Melons/.test(n.message)));
  r = await call('GET', '/harvests'); t('Available harvest leaves the upcoming calendar', !r.harvests.some((h) => h._id === id));
  r = await call('POST', `/harvests/${id}/subscribe`, cust); t('Cannot subscribe to an available harvest (400)', r.s === 400, r.message);
  r = await call('PUT', `/harvests/${id}`, farm, { title: 'x' }); t('Cannot edit after available (400)', r.s === 400, r.message);
  r = await call('PATCH', `/harvests/${id}/status`, farm, { status: 'cancelled' }); t('Cannot cancel after available (400)', r.s === 400, r.message);

  // cancel path
  r = await call('POST', '/harvests', farm, { title: 'QA Figs', expectedDate: day(4) }); const id2 = r.harvest._id;
  await call('POST', `/harvests/${id2}/subscribe`, cust);
  r = await call('PATCH', `/harvests/${id2}/status`, farm, { status: 'cancelled' }); t('Farmer cancels, subscriber notified', r.s === 200 && r.notified === 1 && r.harvest.status === 'cancelled');
  notes = (await call('GET', '/notifications', cust)).notifications; t('Subscriber gets "Harvest cancelled" alert', notes.some((n) => n.title === 'Harvest cancelled' && /QA Figs/.test(n.message)));

  // cleanup
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  await R('Harvest').deleteMany({ title: /^QA / });
  await R('Notification').deleteMany({ user: custMe._id, createdAt: { $gte: start }, type: { $in: ['harvest', 'restock'] } });
  await call('DELETE', `/customer/favorites/farmers/${me._id}`, cust);
  console.log('Cleanup done');
  process.exit();
})().catch((e) => { console.error(e); process.exit(1); });
