const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

const names = ['מטאטא', 'תות שדה', 'מנקה אסלות', 'נייר טואלט 32 גלילים חוגלה'];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('groupPurchase');

  for (const name of names) {
    const r1 = await db.collection('shop_inventory').updateMany(
      { name: { $regex: name, $options: 'i' } },
      { $set: { quantity: 100 } }
    );
    const r2 = await db.collection('shop_products').updateMany(
      { name: { $regex: name, $options: 'i' } },
      { $set: { stock: 100 } }
    );
    console.log(`✅ ${name} → inv:${r1.modifiedCount} prod:${r2.modifiedCount}`);
  }

  await client.close();
}
main().catch(console.error);
