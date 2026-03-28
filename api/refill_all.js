const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  const r1 = await db.collection('shop_inventory').updateMany(
    { isActive: true },
    { $set: { quantity: 500 } }
  );
  const r2 = await db.collection('shop_products').updateMany(
    { isActive: true },
    { $set: { stock: 500 } }
  );

  console.log(`✅ כל המוצרים → inv:${r1.modifiedCount} prod:${r2.modifiedCount}`);
  await client.close();
}
main().catch(console.error);
