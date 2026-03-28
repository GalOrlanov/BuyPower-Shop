const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  const orders = await db.collection('shop_orders').find({
    customerName: { $regex: 'לילך', $options: 'i' }
  }).sort({ createdAt: -1 }).toArray();

  console.log('Found:', orders.length, 'orders for לילך');
  for (const o of orders) {
    const total = (o.items || []).reduce((s,i) => s + (i.price||0)*(i.qty||1), 0);
    console.log(`${o.customerName} | ${o.status} | ${o.createdAt?.toISOString()?.slice(0,16)} | total: ${total.toFixed(1)}₪ | items: ${(o.items||[]).length}`);
  }

  await client.close();
}
main().catch(console.error);
