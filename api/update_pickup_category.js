const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // 1. Update pickup date to Thursday 26/3
  const newDate = new Date('2026-03-26T00:00:00.000Z');
  const r1 = await db.collection('shop_settings').updateOne(
    {},
    { $set: {
      pickupInfoDate: newDate,
      pickupInfo: 'יום חמישי 26/3 בין 16:00-20:00',
      'pickupLocations.0.collectionDate': newDate,
      'pickupLocations.1.collectionDate': newDate,
    }},
    { upsert: false }
  );
  console.log('✅ Pickup date updated:', r1.modifiedCount);

  // 2. Move ירקות בשקית category to פירות וירקות
  const r2 = await db.collection('shop_inventory').updateMany(
    { category: 'ירקות בשקית - מהדרין' },
    { $set: { category: 'פירות וירקות' } }
  );
  const r3 = await db.collection('shop_products').updateMany(
    { category: 'ירקות בשקית - מהדרין' },
    { $set: { category: 'פירות וירקות' } }
  );
  console.log('✅ Category updated: inv:', r2.modifiedCount, 'prod:', r3.modifiedCount);

  // Verify settings
  const settings = await db.collection('shop_settings').findOne({});
  console.log('Settings pickup:', settings?.pickupInfo, settings?.pickupInfoDate);

  await client.close();
}
main().catch(console.error);
