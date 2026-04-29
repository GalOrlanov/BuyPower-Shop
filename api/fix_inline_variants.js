// Repairs shop_orders.items where the variant is baked into the name string
// (e.g. "ירקות בשקית - מהדרין 🌿 (כוסברה)" or "ירקות בשקית - מהדרין  - כוסברה")
// instead of being its own field. The pickup tab groups by itemKey(), which
// falls back to `name` when no productId — so each spelling appears as its own
// row in the dropdown.
//
// Strategy per item:
//   1. If item already has an id and the name matches a catalog product → leave alone.
//   2. Try to peel a trailing variant from the name with a few separator patterns:
//        " (X)"   " - X"   " — X"   " – X"
//   3. For each match, look up base in shop_products by name. If found AND X is one
//      of its variants (case-insensitive, ignoring extra emoji/punct), rewrite the
//      item: { name: catalog.name, variant: variant.name, id, productId }.
//   4. Else leave the item alone (no false rewrites).
//
// Run:  node fix_inline_variants.js          (dry-run)
//       node fix_inline_variants.js --apply  (write changes)

require('dotenv').config();
const { MongoClient } = require('mongodb');

const APPLY = process.argv.includes('--apply');

// Strip diacritics, extra spaces, emojis (rough), lowercase. Used only for
// fuzzy variant matching — never written back to the DB.
function fuzzy(s) {
  return String(s || '')
    .normalize('NFKD')
    // Strip emoji range (basic — covers most herbs)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Try to split a string into base + variant. Returns the longest legitimate split,
// or null if none looks plausible.
function splitNameVariant(s) {
  // Pattern 1: "base (variant)" — variant inside parens at end.
  const m1 = s.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (m1) return { base: m1[1].trim(), variant: m1[2].trim() };
  // Pattern 2: "base — variant" / "base - variant" / "base – variant"
  // We want the LAST occurrence of the separator (so "ירקות בשקית - מהדרין - כוסברה"
  // splits to base="ירקות בשקית - מהדרין", variant="כוסברה").
  const m2 = s.match(/^(.+)\s+[-—–]\s+([^-—–]+)\s*$/);
  if (m2) return { base: m2[1].trim(), variant: m2[2].trim() };
  return null;
}

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();

  const products = await db.collection('shop_products').find({}).toArray();
  // Build fuzzy lookup: fuzzy(productName) → product
  const byFuzzyName = new Map();
  products.forEach(p => byFuzzyName.set(fuzzy(p.name), p));

  const orders = await db.collection('shop_orders').find({}).toArray();
  const ops = [];
  let touchedItems = 0;
  let touchedOrders = 0;
  const samples = [];

  for (const o of orders) {
    let dirty = false;
    const newItems = (o.items || []).map(it => {
      if (it.id || it.productId) return it; // already linked, skip
      const split = splitNameVariant(it.name || '');
      if (!split) return it;
      const product = byFuzzyName.get(fuzzy(split.base));
      if (!product || !Array.isArray(product.variants) || !product.variants.length) return it;
      const variant = product.variants.find(v => fuzzy(v.name) === fuzzy(split.variant));
      if (!variant) return it;

      const pid = product._id.toString();
      const repaired = {
        ...it,
        name: product.name,
        variant: variant.name,
        id: pid,
        productId: pid,
      };
      touchedItems++;
      dirty = true;
      if (samples.length < 8) {
        samples.push({ orderId: o._id.toString(), before: it.name, after: `${product.name} (${variant.name})` });
      }
      return repaired;
    });
    if (dirty) {
      touchedOrders++;
      ops.push({ orderId: o._id, items: newItems });
    }
  }

  console.log(`Orders to update: ${touchedOrders}  |  Items repaired: ${touchedItems}`);
  console.log('');
  console.log('Sample rewrites:');
  samples.forEach(s => console.log(`  order ${s.orderId}`, '\n    -', JSON.stringify(s.before), '\n    +', JSON.stringify(s.after)));

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
