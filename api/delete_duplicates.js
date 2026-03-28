const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // רחל רביבו - מחק אחת מהשתיים של 64₪ (הישנה יותר)
  const rachels = await db.collection('shop_orders').find({
    customerName: { $regex: 'רחל רביבו', $options: 'i' },
    status: 'paid'
  }).sort({ createdAt: 1 }).toArray();
  
  const rachel_64 = rachels.filter(o => {
    const t = o.totalAmount || (o.items||[]).reduce((s,i)=>s+i.price*i.qty,0);
    return Math.round(parseFloat(t)) === 64;
  });
  
  if (rachel_64.length >= 2) {
    await db.collection('shop_orders').deleteOne({ _id: rachel_64[0]._id });
    console.log('✅ מחקתי כפילות רחל רביבו | 64₪ | ' + rachel_64[0]._id);
  }

  // תמר חוטר - מחק אחת מהשתיים של 72₪ (הישנה יותר)
  const tamars = await db.collection('shop_orders').find({
    customerName: { $regex: 'תמר חוטר', $options: 'i' },
    status: 'paid'
  }).sort({ createdAt: 1 }).toArray();

  const tamar_72 = tamars.filter(o => {
    const t = o.totalAmount || (o.items||[]).reduce((s,i)=>s+i.price*i.qty,0);
    return Math.round(parseFloat(t)) === 72;
  });

  if (tamar_72.length >= 2) {
    await db.collection('shop_orders').deleteOne({ _id: tamar_72[0]._id });
    console.log('✅ מחקתי כפילות תמר חוטר | 72₪ | ' + tamar_72[0]._id);
  }

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','ready','confirmed'] } });
  console.log('\nסהכ עכשיו:', total);
  await client.close();
}
main().catch(console.error);
