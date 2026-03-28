const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const growCount = await db.collection("shop_orders").countDocuments({paymentMethod: "grow"});
  const allCount = await db.collection("shop_orders").countDocuments();
  console.log("Total:", allCount, "| Grow:", growCount);
  const growOrders = await db.collection("shop_orders").find({paymentMethod: "grow"}, {projection: {paymentRef: 1, customerName: 1, phone: 1}}).limit(5).toArray();
  console.log(JSON.stringify(growOrders, null, 2));
  await mongoose.disconnect();
}).catch(e => console.error(e.message));
