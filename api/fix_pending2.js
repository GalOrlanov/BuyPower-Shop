const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

const missing = [
  'אבבה אנניה', 'סמדר גושן', 'מורן קופל', 'סיון אובלבסקי', 'שי לבטנא',
  'נעה אופיר', 'כהן אורנה', 'שני כהני', 'אתי בכר', 'איימי מאירי',
  'תמר חוטר אלאון', 'מליט אטיאס', 'גיא כהנוביץ', 'שרונה מאירוביץ',
  'דבורה שוהם', 'נגה גוטמן', 'דיאנה שיינקמן', 'יסמין וינגרוד',
  'Einat Capeluto', 'יפה גולדמן', 'שולה שילון', 'לילך ארבל טולדנו',
  'לביה גבאי', 'טל רוזנטל'
];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const name of missing) {
    // Search by first name
    const firstName = name.split(' ')[0];
    const orders = await db.collection('shop_orders').find({
      customerName: { $regex: firstName, $options: 'i' },
      status: 'pending_payment',
    }).sort({ createdAt: -1 }).toArray();

    if (orders.length === 0) {
      // Try confirmed/not_paid
      const any = await db.collection('shop_orders').find({
        customerName: { $regex: firstName, $options: 'i' },
        status: { $in: ['not_paid', 'failed'] }
      }).sort({ createdAt: -1 }).limit(1).toArray();
      if (any.length > 0) {
        const o = any[0];
        await db.collection('shop_orders').updateOne({ _id: o._id }, { $set: { status: 'paid', paidAt: new Date() } });
        const items = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 60);
        console.log(`✅ (not_paid→paid) ${o.customerName} | ${items}`);
      } else {
        console.log(`❌ לא נמצא: ${name}`);
      }
      continue;
    }

    const o = orders[0];
    const items = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 60);
    await db.collection('shop_orders').updateOne({ _id: o._id }, { $set: { status: 'paid', paidAt: new Date() } });
    console.log(`✅ ${o.customerName} | ${items}`);
  }

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','confirmed','ready'] } });
  console.log(`\nסהכ הזמנות עכשיו: ${total}`);

  await client.close();
}
main().catch(console.error);
