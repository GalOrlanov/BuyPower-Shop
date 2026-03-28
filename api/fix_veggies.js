const { MongoClient, ObjectId } = require('mongodb');

const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/shop_prod';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('shop_prod');

  const deal = [{ qty: 3, price: 10.5 }];

  // Find all items in the new category
  const items = await db.collection('shop_inventory').find({ category: 'ירקות בשקית - מהדרין' }).toArray();
  console.log(`Found ${items.length} items in shop_inventory`);

  for (const item of items) {
    const result = await db.collection('shop_inventory').updateOne(
      { _id: item._id },
      { $set: { quantityDeals: deal, sellingPrice: 3.5, price: 3.5 } }
    );
    console.log(`✅ Updated: ${item.name} (${item._id}) → modified: ${result.modifiedCount}`);
  }

  // Also fix shop_products
  const prods = await db.collection('shop_products').find({ category: 'ירקות בשקית - מהדרין' }).toArray();
  console.log(`Found ${prods.length} items in shop_products`);
  for (const p of prods) {
    await db.collection('shop_products').updateOne(
      { _id: p._id },
      { $set: { quantityDeals: deal, shopPrice: 3.5 } }
    );
    console.log(`✅ Updated shop_product: ${p.name}`);
  }

  await client.close();
  console.log('Done!');
}

main().catch(console.error);
