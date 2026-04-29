// Backfill pickupLocation on orders missing it. For each order with empty pickup:
//   1. Look up the registered shop_user by normalized phone → use their pickupPoint.
//   2. Else, fall back to the same phone's most recent order with a pickup.
//   3. Else, leave the order alone (caller asked us to skip orphans).
//
// Run:  node assign_pickup.js          (dry-run, prints assignments + leftover list)
//       node assign_pickup.js --apply  (writes pickupLocation, prints leftovers)

require('dotenv').config();
const { MongoClient } = require('mongodb');

const APPLY = process.argv.includes('--apply');

function normalizePhone(input) {
  if (!input) return '';
  let p = String(input).replace(/\D/g, '');
  if (p.startsWith('972')) p = '0' + p.slice(3);
  return p;
}

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();

  const orders = await db.collection('shop_orders').find({
    $or: [
      { pickupLocation: { $exists: false } },
      { pickupLocation: '' },
      { pickupLocation: null }
    ]
  }).toArray();

  const ops = [];
  const orphans = [];

  for (const o of orders) {
    const ph = normalizePhone(o.phone);
    let pickup = '';
    let source = '';
    if (ph) {
      const user = await db.collection('shop_users').findOne({ phone: ph });
      pickup = user?.pickupPoint || user?.pickupLocation || '';
      if (pickup) source = 'user_profile';
    }
    if (!pickup && ph) {
      const prior = await db.collection('shop_orders').findOne({
        phone: ph,
        _id: { $ne: o._id },
        pickupLocation: { $exists: true, $nin: ['', null] }
      });
      if (prior) { pickup = prior.pickupLocation; source = 'prior_order'; }
    }
    if (pickup) {
      ops.push({ orderId: o._id, pickup, source, status: o.status, customer: o.customerName, phone: o.phone, createdAt: o.createdAt });
    } else {
      orphans.push(o);
    }
  }

  console.log(`Assignable: ${ops.length}  |  Orphans: ${orphans.length}`);
  console.log('');
  console.log('## Assignments');
  console.log('| # | Status | Customer | Phone | → Pickup | Source |');
  console.log('|---|--------|----------|-------|----------|--------|');
  ops.forEach((op, i) => {
    console.log(`| ${i+1} | ${op.status} | ${(op.customer||'').slice(0,18)} | ${op.phone} | ${op.pickup} | ${op.source} |`);
  });
  console.log('');

  if (APPLY) {
    const bulk = ops.map(op => ({
      updateOne: { filter: { _id: op.orderId }, update: { $set: { pickupLocation: op.pickup } } }
    }));
    if (bulk.length) {
      const r = await db.collection('shop_orders').bulkWrite(bulk);
      console.log('Modified:', r.modifiedCount);
    }
  } else {
    console.log('Dry-run. Re-run with --apply to write changes.');
  }

  console.log('');
  console.log('## Orphans (unable to auto-assign — needs manual handling)');
  console.log('| Status | Date (IL) | Customer | Phone | OrderId |');
  console.log('|--------|-----------|----------|-------|---------|');
  // Skip already-collected ones (caller asked to ignore them)
  const live = orphans.filter(o => o.status !== 'collected');
  live.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  live.forEach(o => {
    const d = o.createdAt ? new Date(o.createdAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '?';
    console.log(`| ${o.status} | ${d} | ${o.customerName || ''} | ${o.phone} | ${o._id.toString()} |`);
  });

  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
