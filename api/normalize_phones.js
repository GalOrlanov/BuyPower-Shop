// Backfill: convert any non-canonical phones in shop_users + shop_orders to the
// 10-digit "0XXXXXXXXX" canonical form. Mostly cleans up users registered with
// "+972..." (stored as "972..." by the old register flow) so /api/shop/orders
// can find them again.
//
// Run:  node normalize_phones.js          (dry-run)
//       node normalize_phones.js --apply  (write changes)

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

  // ── shop_users ─────────────────────────────────────────────────────────────
  const users = await db.collection('shop_users').find({}).toArray();
  const userOps = [];
  let userConflicts = 0;
  const seenAfter = new Map(); // canonical phone → user._id (to detect duplicates)
  users.forEach(u => seenAfter.set(normalizePhone(u.phone), u._id.toString()));

  for (const u of users) {
    const before = u.phone || '';
    const after = normalizePhone(before);
    if (after !== before) {
      // Conflict: another user already has this canonical phone.
      const ownerId = seenAfter.get(after);
      if (ownerId && ownerId !== u._id.toString()) {
        const owner = users.find(x => x._id.toString() === ownerId);
        if (owner && owner.phone === after) {
          userConflicts++;
          console.log('CONFLICT user', u._id.toString(), `phone "${before}" → "${after}" already owned by`, ownerId);
          continue;
        }
      }
      userOps.push({ updateOne: { filter: { _id: u._id }, update: { $set: { phone: after } } } });
    }
  }

  console.log('Users to update:', userOps.length, '| conflicts (skipped):', userConflicts);

  // ── shop_orders ────────────────────────────────────────────────────────────
  const orders = await db.collection('shop_orders').find({}).toArray();
  const orderOps = [];
  for (const o of orders) {
    const before = o.phone || '';
    const after = normalizePhone(before);
    if (after !== before) {
      orderOps.push({ updateOne: { filter: { _id: o._id }, update: { $set: { phone: after } } } });
    }
  }
  console.log('Orders to update:', orderOps.length);

  if (!APPLY) {
    console.log('\nDry-run. Re-run with --apply to write changes.');
    await c.close();
    return;
  }

  if (userOps.length) {
    const r = await db.collection('shop_users').bulkWrite(userOps);
    console.log('Users modified:', r.modifiedCount);
  }
  if (orderOps.length) {
    const r = await db.collection('shop_orders').bulkWrite(orderOps);
    console.log('Orders modified:', r.modifiedCount);
  }
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
