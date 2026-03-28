const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  const missing = [
    { name: 'נתנאל חזן', phone: '0542240905', total: 88 },
    { name: 'רונית אסבן', phone: '0523976903', total: 51.5 },
    { name: 'דני מרי אש', phone: '0546348248', total: 109 },  // dani meriesh
    { name: 'גלי לוברמן', phone: '0505593807', total: 43.39 },
    { name: 'ליאור ברודי', phone: '0542484942', total: 39 },
    { name: 'תמר חוטר אלאון', phone: '0528345612', total: 136 },
    { name: 'קרן שפיצר', phone: '0522771512', total: 23 },
    { name: 'איזבל סממה', phone: '0544754274', total: 63.5 },
    { name: 'הודיה אנסבכר', phone: '', total: 54 },
  ];

  for (const p of missing) {
    // Check if already exists
    const existing = await db.collection('shop_orders').findOne({
      customerName: p.name,
      status: { $in: ['paid', 'confirmed', 'ready'] },
      createdAt: { $gte: new Date('2026-03-20') }
    });
    if (existing) {
      console.log(`⚠️ Already exists: ${p.name}`);
      continue;
    }

    await db.collection('shop_orders').insertOne({
      customerName: p.name,
      customerPhone: p.phone,
      status: 'paid',
      items: [{ name: 'הזמנה ידנית (גרו)', qty: 1, price: p.total, cartKey: 'manual' }],
      total: p.total,
      pickupLocation: '',
      note: 'נוסף ידנית מגרו',
      paidAt: new Date(),
      createdAt: new Date('2026-03-24T06:00:00Z'),
    });
    console.log(`✅ Added: ${p.name} — ${p.total}₪`);
  }

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','confirmed','ready'] } });
  console.log(`\nTotal orders now: ${total}`);

  await client.close();
}
main().catch(console.error);
