const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

const missing = [
  { name: 'שפרה קרן', phone: '506878410', amount: 102 },
  { name: 'איימי מאירי', phone: '549010441', amount: 137 },
  { name: 'טובה חיה גולדין', phone: '522352627', amount: 286.4 },
  { name: 'כהן אורנה', phone: '506246707', amount: 170.5 },
];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const p of missing) {
    // Search by phone first
    let orders = await db.collection('shop_orders').find({
      $or: [
        { phone: { $regex: p.phone } },
        { customerPhone: { $regex: p.phone } },
      ]
    }).sort({ createdAt: -1 }).toArray();

    if (orders.length === 0) {
      // Search by name
      const firstName = p.name.split(' ')[0];
      orders = await db.collection('shop_orders').find({
        customerName: { $regex: firstName, $options: 'i' }
      }).sort({ createdAt: -1 }).toArray();
    }

    if (orders.length === 0) {
      console.log(`❌ לא נמצא: ${p.name}`);
      continue;
    }

    // Show all orders and pick pending or closest
    const pending = orders.filter(o => o.status === 'pending_payment');
    const toUpdate = pending.length > 0 ? pending[0] : null;

    if (toUpdate) {
      await db.collection('shop_orders').updateOne(
        { _id: toUpdate._id },
        { $set: { status: 'paid', paidAt: new Date() } }
      );
      const items = (toUpdate.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 80);
      const t = toUpdate.totalAmount || (toUpdate.items||[]).reduce((s,i)=>s+i.price*i.qty,0);
      console.log(`✅ ${p.name} → ${toUpdate.customerName} | ${Math.round(t)}₪ | ${items}`);
    } else {
      // Already paid or no pending
      const o = orders[0];
      console.log(`ℹ️  ${p.name} → ${o.customerName} | status: ${o.status}`);
    }
  }

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','ready','confirmed'] } });
  console.log(`\nסהכ: ${total}`);
  await client.close();
}
main().catch(console.error);
