/**
 * One-time fix for 6 paid-but-empty orders in the last 7 days.
 *
 * Each case: webhook marked an empty order as paid while the real order (with items)
 * was cancelled_duplicate. This script migrates items from the cancelled sibling onto
 * the paid order, decrements stock, and archives the cancelled sibling.
 *
 * Run with:  node fix_empty_paid_orders.js         # dry-run, prints what would change
 * Run with:  node fix_empty_paid_orders.js apply   # actually apply
 */
const { MongoClient, ObjectId } = require('mongodb');

const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/shop_prod';
const APPLY = process.argv.includes('apply');

// (paidEmptyId, cancelledSiblingId) — confirmed by earlier investigation
const PAIRS = [
  // שמש וינשטין משה — ₪354
  { paid: '69e66c703f67d51bbb4d9900', sibling: '69e66c6b3f67d51bbb4d98ff', name: 'שמש וינשטין משה' },
  // כהן אורנה — ₪108.01
  { paid: '69e747d73f67d51bbb4d99db', sibling: '69e747d23f67d51bbb4d99da', name: 'כהן אורנה' },
  // אורנה בר-פנינה — ₪104.99 (prefer the later cancelled sibling, same items)
  { paid: '69e799203f67d51bbb4d9b2a', sibling: '69e799193f67d51bbb4d9b29', name: 'אורנה בר-פנינה' },
  // איתן ליפשיץ — ₪166
  { paid: '69e8e9574316d3e7449eb7ba', sibling: '69e8e9534316d3e7449eb7b9', name: 'איתן ליפשיץ' },
  // Geula Shavit — ₪670
  { paid: '69e8f5634316d3e7449eb826', sibling: '69e8f5614316d3e7449eb825', name: 'Geula Shavit' },
  // dani meriesh — ₪100
  { paid: '69e8fb944316d3e7449eb864', sibling: '69e8fb8f4316d3e7449eb863', name: 'dani meriesh' },
];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('shop_prod');
  const orders = db.collection('shop_orders');
  const products = db.collection('shop_products');
  const inventory = db.collection('shop_inventory');

  console.log(APPLY ? '=== APPLYING FIXES ===' : '=== DRY-RUN (pass "apply" arg to write) ===');
  console.log('');

  for (const pair of PAIRS) {
    console.log(`━━━━ ${pair.name} ━━━━`);
    const paid = await orders.findOne({ _id: new ObjectId(pair.paid) });
    const sibling = await orders.findOne({ _id: new ObjectId(pair.sibling) });
    if (!paid || !sibling) {
      console.log('  ⚠️  missing order(s) — paid?', !!paid, 'sibling?', !!sibling);
      continue;
    }
    if (paid.status !== 'paid') { console.log('  ⚠️  paid order status is', paid.status, '— skipping'); continue; }
    if (sibling.status !== 'cancelled_duplicate') { console.log('  ⚠️  sibling status is', sibling.status, '— skipping'); continue; }
    if ((paid.items || []).length > 0) { console.log('  ℹ️  paid order already has items — skipping (already fixed?)'); continue; }
    if (!(sibling.items || []).length) { console.log('  ⚠️  sibling has no items either — cannot fix'); continue; }

    const mergeData = {
      items: sibling.items,
      totalAmount: sibling.totalAmount,
      paymentLinkProcessId: sibling.paymentLinkProcessId,
      source: sibling.source || 'grow_link',
      chargeType: sibling.chargeType || null,
      paymentUrl: sibling.paymentUrl || null,
      fixedAt: new Date(),
      fixedFrom: sibling._id.toString()
    };
    if (!paid.pickupLocation && sibling.pickupLocation) mergeData.pickupLocation = sibling.pickupLocation;
    if (!paid.pickupDate && sibling.pickupDate) mergeData.pickupDate = sibling.pickupDate;

    console.log('  paid order:   ', paid._id.toString(), 'items:0 total:0 paidAmt:', paid.paidAmount);
    console.log('  sibling order:', sibling._id.toString(), 'items:', sibling.items.length, 'total:', sibling.totalAmount);
    console.log('  → merging', sibling.items.length, 'items + total=' + sibling.totalAmount, 'onto paid order');

    // Stock decrement plan
    const stockChanges = [];
    for (const item of sibling.items) {
      const prodId = item.productId || item.id;
      if (!prodId) { console.log('    ⚠️  item missing prodId:', item.name); continue; }
      let prod = null;
      try { prod = await products.findOne({ _id: new ObjectId(prodId) }, { projection: { name: 1, stock: 1, inventoryId: 1, hasUnlimitedStock: 1 } }); }
      catch(e) { console.log('    ⚠️  invalid prodId:', prodId); continue; }
      if (!prod) { console.log('    ⚠️  product not found:', prodId, '(', item.name, ')'); continue; }
      if (prod.hasUnlimitedStock) { console.log('    ∞ unlimited stock:', prod.name); continue; }
      const dec = -(Number(item.qty) || 1);
      stockChanges.push({ prodId, name: prod.name, before: prod.stock, dec, inventoryId: prod.inventoryId });
      console.log(`    − stock "${prod.name}" ${prod.stock} ${dec} → ${(prod.stock||0)+dec}`);
    }

    if (!APPLY) continue;

    // Apply order merge
    await orders.updateOne({ _id: paid._id }, { $set: mergeData });
    // Archive sibling so it's distinguishable from real cancelled_duplicate
    await orders.updateOne(
      { _id: sibling._id },
      { $set: { status: 'merged_into_paid', mergedIntoOrderId: paid._id.toString(), mergedAt: new Date() } }
    );
    // Apply stock changes
    for (const s of stockChanges) {
      await products.updateOne({ _id: new ObjectId(s.prodId) }, { $inc: { stock: s.dec } });
      if (s.inventoryId) {
        try {
          const invItem = await inventory.findOne({ _id: new ObjectId(s.inventoryId) }, { projection: { hasUnlimitedStock: 1 } });
          if (invItem && !invItem.hasUnlimitedStock) {
            await inventory.updateOne({ _id: new ObjectId(s.inventoryId) }, { $inc: { quantity: s.dec } });
          }
        } catch(e) { console.log('    ⚠️  inventory update failed:', e.message); }
      }
    }
    console.log('  ✅ applied');
  }

  console.log('\nDone.');
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
