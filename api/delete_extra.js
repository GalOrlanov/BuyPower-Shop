const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

// Need to remove: שפרה קרן(1), עליזה אטיאס(1), איימי מאירי(1), כהן אורנה(1)
// For לילך כהן: remove 1 (keep 2), תמר חוטר: keep 1
const toClean = [
  { search: 'שפרה קרן', keepCount: 1 },
  { search: 'עליזה אטיאס', keepCount: 1 },
  { search: 'איימי מאירי', keepCount: 1 },
  { search: 'כהן אורנה', keepCount: 1 },
  { search: 'לילך כהן', keepCount: 2 },
  { search: 'תמר חוטר', keepCount: 1 },
];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const p of toClean) {
    const orders = await db.collection('shop_orders').find({
      customerName: { $regex: p.search, $options: 'i' },
      status: 'paid'
    }).sort({ totalAmount: -1, createdAt: -1 }).toArray();

    console.log(`${p.search}: ${orders.length} paid, keeping ${p.keepCount}`);
    
    const toDelete = orders.slice(p.keepCount);
    for (const o of toDelete) {
      const t = o.totalAmount || (o.items||[]).reduce((s,i)=>s+i.price*i.qty,0);
      await db.collection('shop_orders').deleteOne({ _id: o._id });
      console.log(`  🗑️ מחקתי: ${o.customerName} | ${Math.round(parseFloat(t))}₪`);
    }
  }

  // Count remaining
  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','ready','confirmed'] } });
  console.log(`\nסהכ paid/ready: ${total}`);
  await client.close();
}
main().catch(console.error);
