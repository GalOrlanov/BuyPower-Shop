const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // 1. Fix featured order:
  // 1=יין קלאסי, 2=תות, 3=יין אסטייט, 4=כפפות, 5=יעה
  const order = [
    { id: '69a5ed526b0592b154bde474', name: 'יין קלאסי', sort: 1, featured: true },
    { id: '69aca0008449c2939db6d8c3', name: 'תות שדה', sort: 2, featured: true },
    { id: '69af25a6c7f6fb1ed6634a80', name: 'יין אסטייט', sort: 3, featured: true },
    { id: '69b85b1b63fb783166b4eff4', name: 'כפפות', sort: 4, featured: true },
    { id: '69c035afef471bc215ce36c5', name: 'יעה', sort: 5, featured: true },
  ];

  for (const p of order) {
    await db.collection('shop_products').updateOne(
      { _id: new ObjectId(p.id) },
      { $set: { isFeatured: p.featured, sortOrder: p.sort } }
    );
    console.log(`✅ ${p.name} → sort ${p.sort}`);
  }

  // 2. Fix תות שדה price: 8₪ each, deal: 2 for 15
  await db.collection('shop_products').updateOne(
    { _id: new ObjectId('69aca0008449c2939db6d8c3') },
    { $set: { shopPrice: 8, quantityDeals: [{ qty: 2, price: 15 }] } }
  );
  // Also fix inventory
  const inv = await db.collection('shop_inventory').findOne({ shopProductId: '69aca0008449c2939db6d8c3' });
  if (inv) {
    await db.collection('shop_inventory').updateOne(
      { _id: inv._id },
      { $set: { sellingPrice: 8, quantityDeals: [{ qty: 2, price: 15 }] } }
    );
    console.log('✅ תות שדה inventory updated');
  }
  console.log('✅ תות שדה price: 8₪, מבצע: 2 ב-15₪');

  await client.close();
}

main().catch(console.error);
