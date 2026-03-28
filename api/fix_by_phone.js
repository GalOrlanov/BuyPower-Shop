const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

const missing = [
  { name: 'שי לבטנא', phone: '0507308034' },
  { name: 'כהן אורנה', phone: '0506246707' },
  { name: 'תמר חוטר אלאון', phone: '0528345612' },
  { name: 'יפה גולדמן', phone: '0547388959' },
];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const p of missing) {
    const cleanPhone = p.phone.replace(/\D/g, '');
    // Search by phone (various formats)
    const orders = await db.collection('shop_orders').find({
      $or: [
        { phone: { $regex: cleanPhone.slice(-9) } },
        { customerPhone: { $regex: cleanPhone.slice(-9) } },
      ],
      status: 'pending_payment'
    }).sort({ createdAt: -1 }).toArray();

    if (orders.length > 0) {
      const o = orders[0];
      await db.collection('shop_orders').updateOne({ _id: o._id }, { $set: { status: 'paid', paidAt: new Date() } });
      const items = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 80);
      console.log(`✅ ${p.name} (${o.customerName}) | ${items}`);
    } else {
      // Try by name fuzzy
      const nameParts = p.name.split(' ');
      let found = null;
      for (const part of nameParts) {
        const res = await db.collection('shop_orders').find({
          customerName: { $regex: part, $options: 'i' },
          status: 'pending_payment'
        }).sort({ createdAt: -1 }).limit(3).toArray();
        if (res.length > 0) { found = res[0]; break; }
      }
      if (found) {
        await db.collection('shop_orders').updateOne({ _id: found._id }, { $set: { status: 'paid', paidAt: new Date() } });
        const items = (found.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 80);
        console.log(`✅ ${p.name} → ${found.customerName} | ${items}`);
      } else {
        console.log(`❌ לא נמצא: ${p.name} (${p.phone})`);
      }
    }
  }

  await client.close();
}
main().catch(console.error);
