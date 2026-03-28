const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  const deal = [{ qty: 3, price: 10.5 }];

  // Update shop_inventory
  const items = await db.collection('shop_inventory').find({ category: 'ירקות בשקית - מהדרין' }).toArray();
  console.log(`Found ${items.length} items in shop_inventory`);

  for (const item of items) {
    const result = await db.collection('shop_inventory').updateOne(
      { _id: item._id },
      { $set: { quantityDeals: deal, sellingPrice: 3.5, marketPrice: 3.5 } }
    );
    console.log(`✅ ${item.name} → modified: ${result.modifiedCount}`);
  }

  // Update shop_products too
  const prods = await db.collection('shop_products').find({ category: 'ירקות בשקית - מהדרין' }).toArray();
  console.log(`Found ${prods.length} items in shop_products`);
  for (const p of prods) {
    await db.collection('shop_products').updateOne(
      { _id: p._id },
      { $set: { quantityDeals: deal, shopPrice: 3.5 } }
    );
    console.log(`✅ shop_product: ${p.name}`);
  }

  // Verify
  const verify = await db.collection('shop_inventory').find({ category: 'ירקות בשקית - מהדרין' }, { projection: { name: 1, quantityDeals: 1, sellingPrice: 1 } }).toArray();
  console.log('\nVerification:');
  verify.forEach(v => console.log(v.name, '| price:', v.sellingPrice, '| deals:', JSON.stringify(v.quantityDeals)));

  await client.close();
}

main().catch(console.error);
