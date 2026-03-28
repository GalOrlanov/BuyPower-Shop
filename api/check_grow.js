const { MongoClient } = require("mongodb");
MongoClient.connect("mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase").then(async client => {
  const db = client.db("groupPurchase");
  const total = await db.collection("grow_payments").countDocuments();
  const weekStart = new Date("2026-03-22T00:00:00");
  const weekEnd = new Date("2026-03-28T23:59:59");
  const thisWeek = await db.collection("grow_payments").countDocuments({createdAt: {$gte: weekStart, $lte: weekEnd}});
  // Check what limit(0) does
  const all = await db.collection("grow_payments").find({}).limit(0).toArray();
  console.log("total in DB:", total);
  console.log("this week:", thisWeek);
  console.log("limit(0) returns:", all.length);
  client.close();
}).catch(e => { console.error(e.message); process.exit(1); });
