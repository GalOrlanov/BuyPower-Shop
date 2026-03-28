const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

// People who appear more times in Gro than on site
const toFix = [
  { name: 'אתי בכר', phone: '0' },        // gro=3, site=1 → need 2 more
  { name: 'רחל רביבו', phone: '0' },       // gro=2, site=1 → need 1 more
  { name: 'תכלת קובצ'י רבינוביץ', phone: '0' }, // gro=2, site=1 → need 1 more
];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const p of toFix) {
    // Find all pending_payment orders for this person
    const pending = await db.collection('shop_orders').find({
      customerName: { $regex: p.name.split(' ')[0], $options: 'i' },
      status: 'pending_payment'
    }).sort({ createdAt: -1 }).toArray();

    console.log(`${p.name}: ${pending.length} pending`);
    for (const o of pending) {
      await db.collection('shop_orders').updateOne({ _id: o._id }, { $set: { status: 'paid', paidAt: new Date() } });
      const items = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 60);
      console.log(`  ✅ עודכן: ${o.customerName} | ${items}`);
    }
  }

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','confirmed','ready'] } });
  console.log(`\nסהכ: ${total}`);
  await client.close();
}
main().catch(console.error);
