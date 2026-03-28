const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  const hash = await bcrypt.hash('1234567', 10);
  const result = await db.collection('shop_users').updateOne(
    { phone: '0524672123' },
    { $set: { passwordHash: hash } }
  );

  if (result.matchedCount === 0) {
    console.log('❌ לא נמצא');
  } else {
    const user = await db.collection('shop_users').findOne({ phone: '0524672123' });
    console.log('✅', user.name, '| טלפון:', user.phone, '| מייל:', user.email);
  }

  await client.close();
}
main().catch(console.error);
