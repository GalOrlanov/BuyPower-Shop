const mongoose = require("./node_modules/mongoose");
const fs = require("fs");

const orders = JSON.parse(fs.readFileSync("/tmp/grow_orders.json", "utf-8"));

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");

  // כל הזמנות ה-22-28/3
  const from = new Date("2026-03-22T00:00:00Z");
  const to = new Date("2026-03-28T23:59:59Z");
  const dbOrders = await col.find({
    createdAt: {$gte: from, $lte: to}
  }, {projection: {paymentRef: 1, customerName: 1, phone: 1, createdAt: 1}}).toArray();

  console.log("DB orders this week:", dbOrders.length);

  // כל refs ב-DB
  const dbRefs = new Set(dbOrders.map(o => String(o.paymentRef || "")));
  
  // מי חסר מהקובץ
  const missing = orders.filter(o => !dbRefs.has(o.ref));
  console.log("Missing from DB:", missing.length);
  missing.forEach(o => console.log(o.ref, o.name, o.phone));

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
