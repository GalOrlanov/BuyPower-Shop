const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Check how featured is sorted — look at inventory for these products
  const order = [
    { id: '69a5ed526b0592b154bde474', name: 'יין קלאסי', sort: 1 },
    { id: '69aca0008449c2939db6d8c3', name: 'תות שדה', sort: 2 },
    { id: '69af25a6c7f6fb1ed6634a80', name: 'יין אסטייט', sort: 3 },
    { id: '69b85b1b63fb783166b4eff4', name: 'כפפות', sort: 4 },
    { id: '69c035afef471bc215ce36c5', name: 'יעה', sort: 5 },
  ];

  for (const p of order) {
    // Update shop_products
    const r1 = await db.collection('shop_products').updateOne(
      { _id: new ObjectId(p.id) },
      { $set: { isFeatured: true, sortOrder: p.sort } }
    );

    // Update shop_inventory by shopProductId
    const r2 = await db.collection('shop_inventory').updateOne(
      { shopProductId: p.id },
      { $set: { isFeatured: true, sortOrder: p.sort } }
    );

    console.log(`${p.name} → sort ${p.sort} | prod:${r1.modifiedCount} inv:${r2.modifiedCount}`);
  }

  // Verify
  console.log('\n--- Verification (inventory) ---');
  const items = await db.collection('shop_inventory').find({ isFeatured: true }).sort({ sortOrder: 1 }).toArray();
  items.forEach(i => console.log(i.sortOrder, i.name));

  await client.close();
}

main().catch(console.error);
