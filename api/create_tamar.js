const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // Get existing order for reference
  const existing = await db.collection('shop_orders').findOne({
    customerName: { $regex: 'תמר חוטר', $options: 'i' },
    status: 'paid'
  });

  if (!existing) {
    console.log('❌ לא נמצאה הזמנה קיימת לתמר חוטר');
    await client.close();
    return;
  }

  // Create new order based on existing with 72₪ total
  const newOrder = {
    customerName: existing.customerName,
    phone: existing.phone,
    email: existing.email || '',
    items: [
      { name: 'כרובית (3 יחידות כ 4 ק"ג)', price: 20, qty: 1 },
      { name: 'אפרסק (קופסה - 1.5 ק"ג)', price: 20, qty: 1 },
      { name: 'נטספק נקטרינה (קופסה 1 ק"ג)', price: 15, qty: 1 },
      { name: 'מלון - 2 יחידות', price: 17, qty: 1 },
    ],
    totalAmount: 72,
    status: 'paid',
    pickupLocation: existing.pickupLocation || '',
    pickupDate: existing.pickupDate || null,
    createdAt: new Date('2026-03-24T10:00:00Z'),
    paidAt: new Date(),
    meshulam_ref: null,
    source: 'manual_sync'
  };

  const result = await db.collection('shop_orders').insertOne(newOrder);
  console.log('✅ נוצרה הזמנה לתמר חוטר | 72₪ | id:', result.insertedId);

  const total = await db.collection('shop_orders').countDocuments({ status: { $in: ['paid','ready','confirmed'] } });
  console.log('סהכ:', total);
  await client.close();
}
main().catch(console.error);
