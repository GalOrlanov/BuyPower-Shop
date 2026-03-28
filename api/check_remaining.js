const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Revert שי לבטנא fix - it was wrong
  await db.collection('shop_orders').updateOne(
    { customerName: { $regex: 'ידידיה', $options: 'i' }, paidAt: { $gte: new Date(Date.now() - 60000) } },
    { $set: { status: 'pending_payment' }, $unset: { paidAt: '' } }
  );

  // Search for תמר חוטר and יפה by phone in users collection
  for (const info of [
    { name: 'תמר חוטר אלאון', phone: '528345612' },
    { name: 'יפה גולדמן', phone: '547388959' },
    { name: 'שי לבטנא', phone: '507308034' },
  ]) {
    const user = await db.collection('shop_users').findOne({ phone: { $regex: info.phone } });
    if (user) console.log(`USER: ${info.name} → ${user.name} | ${user.phone}`);

    const orders = await db.collection('shop_orders').find({
      $or: [
        { phone: { $regex: info.phone } },
        { customerPhone: { $regex: info.phone } },
      ]
    }).sort({ createdAt: -1 }).limit(3).toArray();

    for (const o of orders) {
      console.log(`  ORDER: ${o.customerName} | ${o.status} | ${o.createdAt?.toISOString()?.slice(0,10)}`);
    }
    if (!user && orders.length === 0) console.log(`  ❌ לא נמצא כלום: ${info.name}`);
  }

  await client.close();
}
main().catch(console.error);
