const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Show all תמר חוטר orders
  const all = await db.collection('shop_orders').find({
    customerName: { $regex: 'תמר חוטר', $options: 'i' }
  }).sort({ createdAt: -1 }).toArray();

  console.log('כל הזמנות תמר חוטר:');
  for (const o of all) {
    const t = parseFloat(o.totalAmount || (o.items||[]).reduce((s,i)=>s+i.price*i.qty,0));
    const items = (o.items||[]).map(i=>`${i.name} x${i.qty}`).join(', ').slice(0,60);
    console.log(`  ${o.customerName} | ${Math.round(t)}₪ | ${o.status} | ${String(o._id)}`);
  }

  // Find pending and restore as paid
  const pending = all.filter(o => o.status === 'pending_payment');
  if (pending.length > 0) {
    await db.collection('shop_orders').updateOne(
      { _id: pending[0]._id },
      { $set: { status: 'paid', paidAt: new Date() } }
    );
    const t = parseFloat(pending[0].totalAmount || (pending[0].items||[]).reduce((s,i)=>s+i.price*i.qty,0));
    console.log(`✅ שוחזר: ${pending[0].customerName} | ${Math.round(t)}₪`);
  } else {
    console.log('אין pending לתמר חוטר');
  }

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','ready','confirmed'] } });
  console.log('\nסהכ:', total);
  const api_total = await db.collection('shop_orders').countDocuments({});
  console.log('כולל pending:', api_total);
  await client.close();
}
main().catch(console.error);
