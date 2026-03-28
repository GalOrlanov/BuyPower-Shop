const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const name of ['עוזי', 'עדי וייס']) {
    const r = await db.collection('shop_orders').updateMany(
      { customerName: { $regex: name, $options: 'i' }, status: 'pending_payment' },
      { $set: { status: 'paid', paidAt: new Date() } }
    );
    const o = await db.collection('shop_orders').findOne({ customerName: { $regex: name, $options: 'i' }, status: 'paid' });
    if (o) {
      const t = o.totalAmount || (o.items||[]).reduce((s,i)=>s+i.price*i.qty,0);
      const items = (o.items||[]).map(i=>`${i.name} x${i.qty}`).join(', ').slice(0,80);
      console.log(`✅ ${o.customerName} | ${Math.round(parseFloat(t))}₪ | ${items}`);
    }
  }

  const total = (await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','ready','confirmed'] } }));
  console.log('סהכ:', total);
  await client.close();
}
main().catch(console.error);
