const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';
MongoClient.connect(MONGODB_URI).then(async client => {
  const db = client.db('groupPurchase');
  const r0 = await db.collection('grow_payments').find({}).limit(0).toArray();
  const r200 = await db.collection('grow_payments').find({}).limit(200).toArray();
  const r300 = await db.collection('grow_payments').find({}).toArray();
  console.log('limit(0):', r0.length);
  console.log('limit(200):', r200.length);
  console.log('no limit:', r300.length);
  client.close();
}).catch(e => console.error(e.message));
