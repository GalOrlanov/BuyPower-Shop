const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");
  
  // כל הזמנות 25.3 עם source=grow_import
  const from = new Date("2026-03-25T00:00:00.000Z");
  const to = new Date("2026-03-25T23:59:59.000Z");
  
  const orders = await col.find({createdAt: {$gte: from, $lte: to}, source: "grow_import"}).toArray();
  console.log("25.3 grow_import orders:", orders.length);
  
  // API endpoint מחזיר עם weekEnd=2026-03-28T23:59:59
  // בודק עם אותו query כמו ה-API
  const weekStart = new Date("2026-03-22T00:00:00.000Z");
  const weekEnd = new Date("2026-03-28T23:59:59.000Z");
  const apiOrders = await col.find({
    createdAt: {$gte: weekStart, $lte: weekEnd},
    status: {$in: ["paid", "confirmed", "handled"]}
  }).toArray();
  console.log("API query result:", apiOrders.length);
  
  // מי חסר?
  const apiIds = new Set(apiOrders.map(o => o._id.toString()));
  const missing = orders.filter(o => !apiIds.has(o._id.toString()));
  console.log("Missing from API:", missing.length);
  missing.forEach(o => console.log(o.paymentRef, o.customerName, o.status, o.createdAt));

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
