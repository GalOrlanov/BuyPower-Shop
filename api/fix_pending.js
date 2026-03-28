const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

const missing = [
  'נתנאל חזן',
  'רונית אסבן',
  'dani meriesh',
  'גלי לוברמן',
  'ליאור ברודי',
  'תמר חוטר אלאון',
  'קרן שפיצר',
  'איזבל סממה',
  'הודיה אנסבכר',
];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const name of missing) {
    // Find their pending_payment order (could be any name variation)
    const regex = name.split(' ')[0]; // first name search
    const orders = await db.collection('shop_orders').find({
      customerName: { $regex: regex, $options: 'i' },
      status: 'pending_payment',
    }).sort({ createdAt: -1 }).toArray();

    if (orders.length === 0) {
      console.log(`❌ לא נמצא pending: ${name}`);
      // Try confirmed/not_paid too
      const any = await db.collection('shop_orders').find({
        customerName: { $regex: regex, $options: 'i' },
      }).sort({ createdAt: -1 }).limit(3).toArray();
      any.forEach(o => console.log(`   found: ${o.customerName} | ${o.status} | ${o.createdAt?.toISOString?.()?.slice(0,10)}`));
      continue;
    }

    // Take most recent pending_payment
    const o = orders[0];
    const items = (o.items || []).map(i => `${i.name} x${i.qty}${i.variant ? ' ('+i.variant+')' : ''}`).join(', ');
    console.log(`✅ ${o.customerName} | ${o.status} | items: ${items}`);

    // Update to paid
    await db.collection('shop_orders').updateOne(
      { _id: o._id },
      { $set: { status: 'paid', paidAt: new Date() } }
    );
  }

  await client.close();
}
main().catch(console.error);
