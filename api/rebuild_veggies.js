const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // 1. Delete existing 5 separate veggie products
  const existing = await db.collection('shop_inventory').find({ category: 'ירקות בשקית - מהדרין' }).toArray();
  for (const item of existing) {
    await db.collection('shop_inventory').deleteOne({ _id: item._id });
    if (item.shopProductId) {
      try { await db.collection('shop_products').deleteOne({ _id: new ObjectId(item.shopProductId) }); } catch(e) {}
    }
    console.log('Deleted:', item.name);
  }
  // Also delete by category from shop_products
  await db.collection('shop_products').deleteMany({ category: 'ירקות בשקית - מהדרין' });

  // 2. Create single product with variants
  const variants = [
    { name: 'חסה 🥬', price_modifier: 0 },
    { name: 'פטרוזיליה 🌿', price_modifier: 0 },
    { name: 'כוסברה 🌿', price_modifier: 0 },
    { name: 'שמיר 🌿', price_modifier: 0 },
    { name: 'נענע 🌿', price_modifier: 0 },
  ];

  const prodDoc = {
    name: 'ירקות בשקית - מהדרין 🌿',
    description: 'ירקות טריים מהדרין בשקית | מחיר ליחידה 3.5₪ | מבצע 3 ב-10.5₪',
    imageUrl: '',
    imageUrls: [],
    marketPrice: 0,
    shopPrice: 3.5,
    stock: 0,
    available_until: null,
    variants: variants,
    isActive: true,
    category: 'ירקות בשקית - מהדרין',
    vatType: 'exempt',
    vatIncluded: false,
    pickupPoints: [],
    isFeatured: false,
    sortOrder: 0,
    minQuantity: 1,
    unit: 'שקית',
    quantityDeals: [{ qty: 3, price: 10.5 }],
    createdAt: new Date(),
  };

  const prodResult = await db.collection('shop_products').insertOne(prodDoc);
  const prodId = prodResult.insertedId;
  console.log('Created shop_product:', prodId);

  // 3. Create inventory entry
  const invDoc = {
    name: 'ירקות בשקית - מהדרין 🌿',
    category: 'ירקות בשקית - מהדרין',
    sellingPrice: 3.5,
    marketPrice: 0,
    quantity: 999,
    isActive: true,
    shopProductId: prodId.toString(),
    quantityDeals: [{ qty: 3, price: 10.5 }],
    sortOrder: 0,
    createdAt: new Date(),
  };

  const invResult = await db.collection('shop_inventory').insertOne(invDoc);
  console.log('Created inventory:', invResult.insertedId);

  // Link inventoryId back to product
  await db.collection('shop_products').updateOne(
    { _id: prodId },
    { $set: { inventoryId: invResult.insertedId.toString() } }
  );

  console.log('Done! ✅');
  await client.close();
}

main().catch(console.error);
