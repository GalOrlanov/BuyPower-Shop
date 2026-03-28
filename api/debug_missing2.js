const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");

  // ה-API מחזיר 218 — נבדוק מה ה-12 החסרות
  // API מחזיר 66 מ-25.3, אנחנו צפויים 84
  // אז 18 חסרות מ-25.3
  
  const from = new Date("2026-03-25T00:00:00.000Z");
  const to = new Date("2026-03-25T23:59:59.000Z");
  
  // כל הזמנות מ-25.3
  const all25 = await col.find({createdAt: {$gte: from, $lte: to}}).toArray();
  console.log("All 25.3:", all25.length);
  
  // קבל refs שה-API מחזיר
  const weekStart = new Date("2026-03-22T00:00:00.000Z");
  const weekEnd = new Date("2026-03-28T23:59:59.000Z");
  const apiOrders = await col.find({
    createdAt: {$gte: weekStart, $lte: weekEnd},
    status: {$in: ["paid", "confirmed", "handled"]}
  }).sort({createdAt: -1}).toArray();
  
  const apiOn25 = apiOrders.filter(o => {
    const d = new Date(o.createdAt);
    return d >= from && d <= to;
  });
  console.log("API on 25.3:", apiOn25.length);
  
  // מה ה-18 החסרות?
  const apiIds = new Set(apiOn25.map(o => o._id.toString()));
  const missing = all25.filter(o => !apiIds.has(o._id.toString()));
  console.log("Missing:", missing.length);
  missing.slice(0,5).forEach(o => console.log(o.paymentRef, o.customerName, o.status, o.createdAt));

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
