const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  const hash = await bcrypt.hash('1234567', 10);
  const result = await db.collection('shop_users').updateOne(
    { phone: '0503558997' },
    { $set: { passwordHash: hash } }
  );

  if (result.matchedCount === 0) {
    console.log('❌ משתמש לא נמצא');
    // Search nearby
    const user = await db.collection('shop_users').findOne({ phone: { $regex: '503558997' } });
    if (user) console.log('Found similar:', user.phone, user.name);
  } else {
    console.log('✅ סיסמה אופסה בהצלחה');
  }

  await client.close();
}
main().catch(console.error);
