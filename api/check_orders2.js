const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  // כמה grow orders יש עם items
  const withItems = await db.collection("shop_orders").countDocuments({paymentMethod: "grow", "items.0": {$exists: true}});
  const withoutItems = await db.collection("shop_orders").countDocuments({paymentMethod: "grow", "items.0": {$exists: false}});
  console.log("Grow with items:", withItems, "| without items:", withoutItems);
  // sample אחד עם items
  const sample = await db.collection("shop_orders").findOne({paymentMethod: "grow", "items.0": {$exists: true}});
  if(sample) console.log("Sample with items:", JSON.stringify(sample, null, 2));
  await mongoose.disconnect();
}).catch(e => console.error(e.message));
