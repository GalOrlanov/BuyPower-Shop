// Backfill missing id/productId on shop_orders.items by matching name (and optional
// variant) against the shop_products catalog. These orphans came from the old
// /payment/create fallback path that wrote {name, price, qty} only.
//
// Run:  node fix_orphan_item_ids.js          (dry-run)
//       node fix_orphan_item_ids.js --apply  (write changes)

require('dotenv').config();
const { MongoClient } = require('mongodb');

const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();

  const products = await db.collection('shop_products').find({}).toArray();
  const byName = new Map(); // name → product
  const byNameVariant = new Map(); // "name|variant" → { product, variant }
  products.forEach(p => {
    byName.set(p.name, p);
    (p.variants || []).forEach(v => byNameVariant.set(`${p.name}|${v.name}`, { product: p, variant: v }));
  });

  const orders = await db.collection('shop_orders').find({
    items: { $elemMatch: { $or: [{ id: { $exists: false } }, { id: null }, { id: '' }] } }
  }).toArray();

  let touched = 0;
  let backfilled = 0;
  let unmatched = 0;
  const ops = [];
  const unmatchedSamples = [];

  for (const o of orders) {
    let dirty = false;
    const newItems = (o.items || []).map(it => {
      const hasId = it.id || it.productId;
      if (hasId) return it;
      const name = it.name;
      const variant = it.variant;
      let match = null;
      if (variant) match = byNameVariant.get(`${name}|${variant}`);
      let prod = match ? match.product : byName.get(name);
      if (!prod) {
        unmatched++;
        if (unmatchedSamples.length < 10) unmatchedSamples.push({ orderId: o._id.toString(), name, variant });
        return it;
      }
      const pid = prod._id.toString();
      dirty = true;
      backfilled++;
      return { ...it, id: pid, productId: pid };
    });
    if (dirty) {
      touched++;
      ops.push({ orderId: o._id, items: newItems });
    }
  }

  console.log('Orders scanned:', orders.length);
  console.log('Orders to update:', touched);
  console.log('Items backfilled with id:', backfilled);
  console.log('Items unmatched (will stay as-is):', unmatched);
  if (unmatchedSamples.length) {
    console.log('Unmatched samples:');
    unmatchedSamples.forEach(s => console.log(' ', s.orderId, '|', JSON.stringify(s.name), '| variant:', s.variant || '∅'));
  }

  if (!APPLY) {
    console.log('\nDry-run. Re-run with --apply to write changes.');
    await c.close();
    return;
  }

  if (ops.length) {
    const bulk = ops.map(op => ({ updateOne: { filter: { _id: op.orderId }, update: { $set: { items: op.items } } } }));
    const r = await db.collection('shop_orders').bulkWrite(bulk);
    console.log('\nApplied. Modified:', r.modifiedCount);
  }
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
