const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Search all statuses including pending_payment
  const orders = await db.collection('shop_orders').find({
    customerName: { $regex: 'ליאת|גרטנר', $options: 'i' }
  }).toArray();

  console.log('Found:', orders.length);
  for (const o of orders) {
    console.log(o.customerName, '|', o.status, '|', o.createdAt);
    (o.items || []).forEach(i => console.log('  -', i.name, 'x', i.qty, i.variant || ''));
    console.log('  total:', o.total);
  }

  await client.close();
}
main().catch(console.error);
