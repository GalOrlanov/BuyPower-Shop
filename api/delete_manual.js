const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  const result = await db.collection('shop_orders').deleteMany({ note: 'נוסף ידנית מגרו' });
  console.log('Deleted:', result.deletedCount);
  await client.close();
}
main().catch(console.error);
