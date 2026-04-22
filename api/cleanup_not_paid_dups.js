/**
 * One-time cleanup: flips legacy `not_paid` orders that are duplicates of paid
 * orders (same phone, within ±6h) to `cancelled_duplicate` so the admin /orders
 * endpoint hides them. Orphan `not_paid` orders (no paid sibling) are left alone.
 *
 *   node cleanup_not_paid_dups.js         # dry-run
 *   node cleanup_not_paid_dups.js apply   # write
 */
const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/shop_prod';
const APPLY = process.argv.includes('apply');

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('shop_prod');
  const orders = db.collection('shop_orders');

  const notPaid = await orders.find({ status: 'not_paid' }).sort({ createdAt: 1 }).toArray();
  let flipped = 0, kept = 0;
  for (const o of notPaid) {
    const paidSibling = await orders.findOne({
      phone: o.phone,
      _id: { $ne: o._id },
      status: { $in: ['paid', 'handled', 'collected', 'confirmed'] },
      createdAt: {
        $gte: new Date(o.createdAt.getTime() - 6 * 60 * 60 * 1000),
        $lte: new Date(o.createdAt.getTime() + 6 * 60 * 60 * 1000)
      }
    });
    if (paidSibling) {
      console.log(`  flip ${o._id}  ${o.customerName}  ₪${o.totalAmount}  → cancelled_duplicate  (paid sibling: ${paidSibling._id} ₪${paidSibling.totalAmount})`);
      if (APPLY) {
        await orders.updateOne(
          { _id: o._id },
          { $set: { status: 'cancelled_duplicate', cancelledAt: new Date(), cancelReason: 'legacy_not_paid_dup' } }
        );
      }
      flipped++;
    } else {
      console.log(`  keep ${o._id}  ${o.customerName}  ₪${o.totalAmount}  (orphan — no paid sibling)`);
      kept++;
    }
  }
  console.log(`\n${APPLY ? 'Applied' : 'Would flip'} ${flipped}, kept ${kept} orphans.`);
  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
