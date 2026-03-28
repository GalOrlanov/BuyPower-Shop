const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // 1. Remove featured from יין קלאסי, set יעה as sort=1
  // יין קלאסי _id: 69a5ed526b0592b154bde474
  // יעה _id: 69c035afef471bc215ce36c5
  await db.collection('shop_products').updateOne(
    { _id: new ObjectId('69a5ed526b0592b154bde474') },
    { $set: { isFeatured: false, sortOrder: 99 } }
  );
  console.log('✅ יין קלאסי removed from featured');

  // Set יעה as sort=1 (first)
  await db.collection('shop_products').updateOne(
    { _id: new ObjectId('69c035afef471bc215ce36c5') },
    { $set: { isFeatured: true, sortOrder: 1 } }
  );
  // Shift others: אסטייט→2, תות→3, כפפות→4
  await db.collection('shop_products').updateOne(
    { _id: new ObjectId('69af25a6c7f6fb1ed6634a80') },
    { $set: { sortOrder: 2 } }
  );
  await db.collection('shop_products').updateOne(
    { _id: new ObjectId('69aca0008449c2939db6d8c3') },
    { $set: { sortOrder: 3 } }
  );
  await db.collection('shop_products').updateOne(
    { _id: new ObjectId('69b85b1b63fb783166b4eff4') },
    { $set: { sortOrder: 4 } }
  );
  console.log('✅ Featured order updated: יעה, אסטייט, תות, כפפות');

  // 2. Add כרפס + סלק עלים to ירקות בשקית variants
  const vegProd = await db.collection('shop_products').findOne({ category: 'ירקות בשקית - מהדרין' });
  if (vegProd) {
    const existingVariants = vegProd.variants || [];
    const newVariants = [
      ...existingVariants,
      { name: 'כרפס 🌿', price_modifier: 0 },
      { name: 'סלק עלים 🌿', price_modifier: 0 },
    ];
    await db.collection('shop_products').updateOne(
      { _id: vegProd._id },
      { $set: { variants: newVariants } }
    );
    // Also update inventory
    await db.collection('shop_inventory').updateOne(
      { category: 'ירקות בשקית - מהדרין' },
      { $set: { } }
    );
    console.log('✅ Added כרפס + סלק עלים. Total variants:', newVariants.length);
    newVariants.forEach(v => console.log(' -', v.name));
  } else {
    console.log('❌ Veggie product not found');
  }

  await client.close();
}

main().catch(console.error);
