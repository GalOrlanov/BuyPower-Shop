const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");

  // מדמה בדיוק את ה-API query
  const since = new Date("2026-03-22");
  const until = new Date("2026-03-28T23:59:59");
  console.log("since:", since.toISOString(), "until:", until.toISOString());
  
  const filter = { createdAt: { $gte: since, $lte: until }, status: { $ne: "pending_payment" } };
  const orders = await col.find(filter).sort({ createdAt: -1 }).toArray();
  
  console.log("Total:", orders.length);
  
  // breakdown by date
  const dates = {};
  orders.forEach(o => {
    const d = new Date(o.createdAt).toISOString().slice(0,10);
    dates[d] = (dates[d]||0) + 1;
  });
  console.log("By date:", JSON.stringify(dates));
  
  await mongoose.disconnect();
}).catch(e => console.error(e.message));
