const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Find all inventory entries for יין קלאסי
  const items = await db.collection('shop_inventory').find({ shopProductId: '69a5ed526b0592b154bde474' }).toArray();
  console.log('Found', items.length, 'inventory entries for יין קלאסי:');
  items.forEach(i => console.log(' ', i._id, i.name, 'sort:', i.sortOrder, 'featured:', i.isFeatured));

  // Update ALL of them to sort=1, isFeatured=true
  const r = await db.collection('shop_inventory').updateMany(
    { shopProductId: '69a5ed526b0592b154bde474' },
    { $set: { sortOrder: 1, isFeatured: true } }
  );
  console.log('Updated:', r.modifiedCount);

  // Verify final order
  console.log('\nFinal featured order:');
  const featured = await db.collection('shop_inventory').find({ isFeatured: true }).sort({ sortOrder: 1 }).toArray();
  featured.forEach(i => console.log(i.sortOrder, i.name));

  await client.close();
}
main().catch(console.error);
