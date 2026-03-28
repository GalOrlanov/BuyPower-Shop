const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const orders = await db.collection("shop_orders").find({source: "grow_import"}).toArray();
  const unmatched = new Set();
  orders.forEach(o => (o.items||[]).forEach(i => {
    if (!i.category || i.category === "כללי") unmatched.add(i.name);
  }));
  console.log("Unmatched product names (" + unmatched.size + "):");
  Array.from(unmatched).sort().forEach(n => console.log(" -", n));
  await mongoose.disconnect();
}).catch(e => console.error(e.message));
