const mongoose = require("./node_modules/mongoose");
const fs = require("fs");

const orders = JSON.parse(fs.readFileSync("/tmp/grow_orders.json", "utf-8"));

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");

  // כמה הזמנות grow_import קיימות?
  const imported = await col.find({source: "grow_import"}, {projection: {paymentRef: 1, createdAt: 1, customerName: 1}}).toArray();
  console.log("Imported orders:", imported.length);
  
  // מה ה-createdAt שלהם?
  const dates = {};
  imported.forEach(o => {
    const d = String(o.createdAt).slice(0, 10);
    dates[d] = (dates[d] || 0) + 1;
  });
  console.log("By date:", JSON.stringify(dates, null, 2));

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
