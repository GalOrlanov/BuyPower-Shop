const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Update ירקות בשקית inventory
  const r1 = await db.collection('shop_inventory').updateMany(
    { category: 'פירות וירקות', name: { $regex: 'ירקות בשקית', $options: 'i' } },
    { $set: { quantity: 500 } }
  );
  const r2 = await db.collection('shop_products').updateMany(
    { name: { $regex: 'ירקות בשקית', $options: 'i' } },
    { $set: { stock: 500 } }
  );

  console.log(`✅ ירקות בשקית → inv:${r1.modifiedCount} prod:${r2.modifiedCount}`);
  await client.close();
}
main().catch(console.error);
