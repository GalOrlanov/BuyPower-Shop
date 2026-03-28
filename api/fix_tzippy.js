const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  const result = await db.collection('shop_orders').updateOne(
    { customerName: 'ציפי טוביאנה', status: 'pending_payment', createdAt: { $gte: new Date('2026-03-23') } },
    { $set: { status: 'paid', paidAt: new Date() } }
  );
  console.log('Updated:', result.modifiedCount);

  // Verify
  const order = await db.collection('shop_orders').findOne({ customerName: 'ציפי טוביאנה', createdAt: { $gte: new Date('2026-03-23') } });
  console.log('Order:', order?.customerName, '|', order?.status, '| items:', JSON.stringify(order?.items?.map(i => i.name + ' x' + i.qty)));
  
  await client.close();
}
main().catch(console.error);
