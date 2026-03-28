const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");
  
  const from = new Date("2026-03-22");
  const to = new Date("2026-03-28T23:59:59");
  
  const all = await col.find({createdAt: {$gte: from, $lte: to}, status: {$ne: "pending_payment"}}).toArray();
  console.log("DB total:", all.length);
  
  // by source
  const bySrc = {};
  all.forEach(o => { bySrc[o.source||"none"] = (bySrc[o.source||"none"]||0)+1; });
  console.log("By source:", JSON.stringify(bySrc));
  
  // בדוק grow_import - מה ה-createdAt שלהם?
  const imports = all.filter(o => o.source === "grow_import");
  console.log("grow_import count:", imports.length);
  if(imports.length) {
    console.log("Sample createdAt:", imports[0].createdAt, typeof imports[0].createdAt);
  }
  
  await mongoose.disconnect();
}).catch(e => console.error(e.message));
