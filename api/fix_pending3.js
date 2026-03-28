const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

const missing = [
  { name: 'שי לבטנא', phone: '507308034' },
  { name: 'אלינור גנדלמן', phone: '523760299' },
  { name: 'ארנה מריאש', phone: '544773669' },
  { name: 'כהן שמואל', phone: '548882192' },
  { name: 'צורי צעדה', phone: '506014339' },
  { name: 'תמר חוטר אלאון', phone: '528345612' },
  { name: 'יונת בורמיל וקסלר', phone: '542404179' },
  { name: 'טלי אשקר', phone: '506401790' },
  { name: 'יונית אוחיון', phone: '523686061' },
  { name: 'שפרה קרן', phone: '506878410' },
  { name: 'יפה גולדמן', phone: '547388959' },
  { name: 'מרים אלון', phone: '506355520' },
];

async function findAndUpdate(db, p) {
  // 1. Try by phone in pending_payment
  let orders = await db.collection('shop_orders').find({
    $or: [
      { phone: { $regex: p.phone } },
      { customerPhone: { $regex: p.phone } },
    ],
    status: 'pending_payment'
  }).sort({ createdAt: -1 }).toArray();

  if (orders.length > 0) {
    const o = orders[0];
    await db.collection('shop_orders').updateOne({ _id: o._id }, { $set: { status: 'paid', paidAt: new Date() } });
    const items = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 70);
    console.log(`✅ ${p.name} → ${o.customerName} | ${items}`);
    return;
  }

  // 2. Try any status by phone
  orders = await db.collection('shop_orders').find({
    $or: [
      { phone: { $regex: p.phone } },
      { customerPhone: { $regex: p.phone } },
    ]
  }).sort({ createdAt: -1 }).limit(1).toArray();

  if (orders.length > 0) {
    const o = orders[0];
    if (o.status === 'paid') {
      console.log(`ℹ️  ${p.name} כבר paid → ${o.customerName}`);
    } else {
      await db.collection('shop_orders').updateOne({ _id: o._id }, { $set: { status: 'paid', paidAt: new Date() } });
      const items = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 70);
      console.log(`✅ ${p.name} (${o.status}→paid) → ${o.customerName} | ${items}`);
    }
    return;
  }

  console.log(`❌ לא נמצא: ${p.name} (${p.phone})`);
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const p of missing) {
    await findAndUpdate(db, p);
  }

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','confirmed','ready','handled'] } });
  console.log(`\nסהכ paid/confirmed/ready: ${total}`);
  await client.close();
}
main().catch(console.error);
