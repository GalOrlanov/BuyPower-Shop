const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Delete the pending_payment order for ליאת גרטנר from today
  const result = await db.collection('shop_orders').deleteOne({
    customerName: 'ליאת גרטנר',
    status: 'pending_payment',
    createdAt: { $gte: new Date('2026-03-24') }
  });
  console.log('Deleted:', result.deletedCount);

  await client.close();
}
main().catch(console.error);
