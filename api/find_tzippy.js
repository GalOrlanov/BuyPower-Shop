const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Search all order collections
  const collections = await db.listCollections().toArray();
  const orderColls = collections.filter(c => c.name.toLowerCase().includes('order'));
  console.log('Order collections:', orderColls.map(c => c.name));

  for (const col of orderColls) {
    const orders = await db.collection(col.name).find({
      $or: [
        { customerName: { $regex: 'ציפי|טוביאנה', $options: 'i' } },
        { name: { $regex: 'ציפי|טוביאנה', $options: 'i' } },
      ]
    }).toArray();
    if (orders.length) {
      console.log(`\nFound in ${col.name}:`);
      orders.forEach(o => console.log(' ', o.customerName || o.name, '|', o.status, '|', o.createdAt, '| total:', o.total));
    }

    // Also show recent orders (last 24h)
    const recent = await db.collection(col.name).find({
      createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
    }).sort({ createdAt: -1 }).toArray();
    if (recent.length) {
      console.log(`\nRecent in ${col.name} (last 24h):`);
      recent.forEach(o => console.log(' ', o.customerName || o.name, '|', o.status, '|', o.createdAt));
    }
  }

  await client.close();
}
main().catch(console.error);
