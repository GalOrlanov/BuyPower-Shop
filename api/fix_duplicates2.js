const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

const toSearch = ['אתי בכר', 'רחל רביבו', 'תכלת'];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const name of toSearch) {
    const pending = await db.collection('shop_orders').find({
      customerName: { $regex: name, $options: 'i' },
      status: 'pending_payment'
    }).sort({ createdAt: -1 }).toArray();

    console.log(`${name}: ${pending.length} pending`);
    for (const o of pending) {
      await db.collection('shop_orders').updateOne(
        { _id: o._id },
        { $set: { status: 'paid', paidAt: new Date() } }
      );
      const items = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 60);
      console.log(`  ✅ ${o.customerName} | ${items}`);
    }
  }

  const total = await db.collection('shop_orders').countDocuments({});
  const paid = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','confirmed','ready'] } });
  console.log(`\nסהכ הזמנות: ${total} | paid/ready: ${paid}`);
  await client.close();
}
main().catch(console.error);
