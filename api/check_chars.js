const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';
async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('groupPurchase');
  
  // Check all items with similar name
  const items = await db.collection('shop_inventory').find({
    name: { : 'צלחות', off on off off off off off off off off on off on off off off off off on off off off on on off off off off on off off off off off off off off off off off off on off off off off off off off on off on on off off off on off off on off off on off off on off on off off on off on off off off off on off off off on off off on off off off off off off off off on off on off off on off off off off off off off off off off off off on off off off on off on off on on off off off off on on on off on on off on off on on off off off off on on off off on off off off off off on off off on off off on off off off off off off on off off off off on on off on off off off off off on off on off off off off off off off off off off on on off on off off off: 'i' }
  }).toArray();
  
  for (const i of items) {
    console.log(JSON.stringify({
      _id: i._id,
      name: i.name,
      nameHex: Buffer.from(i.name).toString('hex').slice(0,40),
      isActive: i.isActive,
      sell: i.sellingPrice,
      buy: i.purchasePrice,
      pickup: i.pickupPoints
    }));
  }
  
  // Check indexes
  const indexes = await db.collection('shop_inventory').indexes();
  const uniqueIdx = indexes.find(i => i.name === 'unique_inventory_name');
  console.log('unique index exists:', !!uniqueIdx);
  
  await client.close();
}
run().catch(e => console.error('ERROR:', e.message));
