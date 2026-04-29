// Repairs shop_orders items where the name was mangled by the old
// /payment/create fallback path: "<product> [(<variant>)] xN" with qty=1.
// Splits the suffix back into proper { name, variant, qty, id, productId, price }.
//
// Run:  node fix_xN_items.js          (dry-run, prints planned changes)
//       node fix_xN_items.js --apply  (writes changes to DB)

require('dotenv').config();
const { MongoClient } = require('mongodb');

const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();

  const products = await db.collection('shop_products').find({}).toArray();
  // Build lookup: full display name → { product, variant }
  const byDisplay = new Map();
  products.forEach(p => {
    byDisplay.set(p.name, { product: p, variant: null });
    (p.variants || []).forEach(v => {
      byDisplay.set(`${p.name} (${v.name})`, { product: p, variant: v });
    });
  });

  const orders = await db.collection('shop_orders').find({
    'items.name': { $regex: ' x\\d+$' }
  }).toArray();

  const xRe = / x(\d+)$/;
  let fixedItems = 0;
  let unmatchedItems = 0;
  const ops = [];

  for (const o of orders) {
    let dirty = false;
    const newItems = (o.items || []).map(it => {
      const m = (it.name || '').match(xRe);
      if (!m) return it;
      const parsedQty = parseInt(m[1], 10);
      const baseDisplay = it.name.slice(0, -m[0].length).trim();
      const found = byDisplay.get(baseDisplay);

      const existingQty = Number(it.qty) || 1;
      const newQty = parsedQty * existingQty;
      const totalPrice = Number(it.price) || 0; // mangled: price was the line total
      const unitPrice = newQty > 0 ? Math.round((totalPrice / newQty) * 100) / 100 : totalPrice;

      const repaired = { ...it, qty: newQty, price: unitPrice };
      if (found) {
        repaired.name = found.product.name;
        if (found.variant) {
          repaired.variant = found.variant.name;
        }
        const pid = found.product._id.toString();
        repaired.id = pid;
        repaired.productId = pid;
        if (!repaired.imageUrl && found.product.imageUrl) repaired.imageUrl = found.product.imageUrl;
        if (!repaired.unit && found.product.unit) repaired.unit = found.product.unit;
        fixedItems++;
      } else {
        // Couldn't match catalog — at least strip the suffix and recover qty
        repaired.name = baseDisplay;
        unmatchedItems++;
      }
      dirty = true;
      return repaired;
    });

    if (dirty) {
      ops.push({ orderId: o._id, before: o.items, after: newItems });
    }
  }

  console.log(`Orders needing repair: ${ops.length}`);
  console.log(`Items repaired (matched to catalog): ${fixedItems}`);
  console.log(`Items repaired (suffix-strip only, no catalog match): ${unmatchedItems}`);
  console.log('');
  if (unmatchedItems) {
    console.log('Unmatched (will only get suffix-stripped):');
    ops.forEach(op => op.after.forEach((a, i) => {
      const b = op.before[i];
      if (b.name !== a.name && !a.id) {
        console.log(`  order ${op.orderId.toString()}: "${b.name}" → "${a.name}"`);
      }
    }));
    console.log('');
  }
  ops.slice(0, 5).forEach(op => {
    console.log('Order', op.orderId.toString());
    op.before.forEach((b, i) => {
      const a = op.after[i];
      if (b.name !== a.name || b.qty !== a.qty || b.price !== a.price) {
        console.log(`  - "${b.name}" qty=${b.qty} price=${b.price}`);
        console.log(`  + "${a.name}"${a.variant ? ` (${a.variant})` : ''} qty=${a.qty} price=${a.price} id=${a.id || '∅'}`);
      }
    });
  });
  if (ops.length > 5) console.log(`  … and ${ops.length - 5} more orders`);

  if (!APPLY) {
    console.log('\nDry-run. Re-run with --apply to write changes.');
    await c.close();
    return;
  }

  console.log('\nApplying…');
  const bulk = ops.map(op => ({
    updateOne: {
      filter: { _id: op.orderId },
      update: { $set: { items: op.after } }
    }
  }));
  if (bulk.length) {
    const r = await db.collection('shop_orders').bulkWrite(bulk);
    console.log('Modified:', r.modifiedCount);
  }
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
