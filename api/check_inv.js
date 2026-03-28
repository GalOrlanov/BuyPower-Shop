const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Check all featured items in inventory
  const items = await db.collection('shop_inventory').find({ isFeatured: true }).toArray();
  console.log('Featured in inventory:');
  items.forEach(i => console.log(' ', i.sortOrder, i.name, '| shopProductId:', i.shopProductId));

  // Check יין קלאסי specifically
  const klassi = await db.collection('shop_inventory').findOne({ name: { $regex: 'קלאסי' } });
  if (klassi) console.log('\nקלאסי inv:', klassi.sortOrder, klassi.isFeatured);

  // The API returns sortOrder from inv. Let's check the GET /products response for קלאסי
  const prod = await db.collection('shop_products').findOne({ _id: new ObjectId('69a5ed526b0592b154bde474') });
  if (prod) console.log('קלאסי prod:', prod.sortOrder, prod.isFeatured);

  await client.close();
}
main().catch(console.error);
