const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Find a pending for תמר חוטר with ~72₪
  const pending = await db.collection('shop_orders').find({
    customerName: { $regex: 'תמר חוטר', $options: 'i' },
    status: 'pending_payment'
  }).sort({ createdAt: -1 }).toArray();

  console.log('Pending for תמר חוטר:', pending.length);
  for (const o of pending) {
    const t = o.totalAmount || (o.items||[]).reduce((s,i)=>s+i.price*i.qty,0);
    console.log(' ', o.customerName, Math.round(parseFloat(t)), o.status);
  }

  if (pending.length > 0) {
    await db.collection('shop_orders').updateOne(
      { _id: pending[0]._id },
      { $set: { status: 'paid', paidAt: new Date() } }
    );
    console.log('✅ restored');
  }

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','ready','confirmed'] } });
  console.log('סהכ:', total);
  await client.close();
}
main().catch(console.error);
