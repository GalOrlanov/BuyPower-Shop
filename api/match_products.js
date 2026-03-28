const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const orders = await db.collection("shop_orders").find({source: "grow_import"}).toArray();
  
  // כל שמות המוצרים הייחודיים
  const productNames = new Set();
  orders.forEach(o => (o.items||[]).forEach(i => { if(i.name) productNames.add(i.name); }));
  console.log("Unique product names:", productNames.size);
  
  // חפש בinventory לפי שם
  const inv = await db.collection("shop_inventory").find({}).toArray();
  console.log("Inventory items:", inv.length);
  
  let matched = 0, missing = 0;
  const missing_names = new Set();
  for (const pname of productNames) {
    const found = inv.find(i => i.name === pname || (i.nameAr && pname.includes(i.nameAr)));
    if (found) {
      matched++;
    } else {
      missing++;
      missing_names.add(pname);
    }
  }
  
  console.log("Matched:", matched, "Missing:", missing);
  console.log("Missing products:");
  Array.from(missing_names).slice(0, 10).forEach(n => console.log("  -", n));

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
