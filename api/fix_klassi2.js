const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  // The main product entry is "יינות תשבי קלאסי — 4 ב-100₪"
  // The others (קברנה סירה, אדום סגול, etc.) are variant entries — unfeatured them
  const variantNames = ['קברנה סירה', 'אדום סגול', 'אמרלד ריזלינג', 'כחול לבן — יין יבש', "פרנץ' ריזלינג", 'יינות תשבי קלאסי אדום', 'תשבי אדום'];

  // Unfeatured all sub-variants of יין קלאסי
  const r = await db.collection('shop_inventory').updateMany(
    {
      shopProductId: '69a5ed526b0592b154bde474',
      name: { $ne: 'יינות תשבי קלאסי — 4 ב-100₪' }
    },
    { $set: { isFeatured: false, sortOrder: 0 } }
  );
  console.log('Unfeatured variants:', r.modifiedCount);

  // Make sure main entry is correct
  const r2 = await db.collection('shop_inventory').updateOne(
    { shopProductId: '69a5ed526b0592b154bde474', name: 'יינות תשבי קלאסי — 4 ב-100₪' },
    { $set: { isFeatured: true, sortOrder: 1 } }
  );
  console.log('Main entry updated:', r2.modifiedCount);

  // Verify final featured order
  console.log('\nFinal featured order:');
  const featured = await db.collection('shop_inventory').find({ isFeatured: true }).sort({ sortOrder: 1 }).toArray();
  featured.forEach(i => console.log(i.sortOrder, i.name));

  await client.close();
}
main().catch(console.error);
