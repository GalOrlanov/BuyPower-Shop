const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/shop_prod';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  
  // Check all DBs
  const admin = client.db('admin');
  const dbs = await admin.admin().listDatabases();
  console.log('Available DBs:', dbs.databases.map(d => d.name).join(', '));
  
  // Check shop_prod
  const db = client.db('shop_prod');
  const inv = await db.collection('shop_inventory').find({ category: 'ירקות בשקית - מהדרין' }).toArray();
  console.log('shop_prod inventory:', inv.length);
  
  // Check groupPurchase
  const db2 = client.db('groupPurchase');
  const inv2 = await db2.collection('shop_inventory').find({ category: 'ירקות בשקית - מהדרין' }).toArray();
  console.log('groupPurchase inventory:', inv2.length);
  if (inv2.length > 0) console.log('Sample:', inv2[0].name, inv2[0].category);
  
  await client.close();
}

main().catch(console.error);
