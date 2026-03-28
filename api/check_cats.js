const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const inv = await db.collection("shop_inventory").find({isActive: true}).sort({sortOrder:1}).toArray();
  const byCat = {};
  inv.forEach(i => {
    const cat = i.category || "כללי";
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(i.name);
  });
  Object.entries(byCat).forEach(([cat, names]) => {
    console.log("\n=== " + cat + " ===");
    names.forEach(n => console.log("  - " + n));
  });
  await mongoose.disconnect();
}).catch(e => console.error(e.message));
