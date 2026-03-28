const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  // טען inventory
  const inv = await db.collection("shop_inventory").find({isActive: true}).toArray();
  console.log("Inventory items:", inv.length);
  
  // בנה map: name -> {_id, category}
  const invMap = {};
  inv.forEach(i => {
    if (i.name) invMap[i.name.trim()] = { id: i._id.toString(), category: i.category };
  });
  
  // כל המוצרים הייחודיים מה-grow_import
  const orders = await db.collection("shop_orders").find({source: "grow_import"}).toArray();
  const productNames = new Set();
  orders.forEach(o => (o.items||[]).forEach(i => { if(i.name) productNames.add(i.name.trim()); }));
  
  let matched = 0, unmatched = [];
  for (const pname of productNames) {
    // exact match
    if (invMap[pname]) { matched++; continue; }
    
    // fuzzy: הסר מספרים בסוף (תות שדה - קופסה של 0.5 ק״ג 2 → תות שדה - קופסה של 0.5 ק״ג)
    const cleaned = pname.replace(/\s+\d+$/, ).trim();
    if (invMap[cleaned]) { matched++; continue; }
    
    unmatched.push(pname);
  }
  
  console.log("Matched:", matched, "Unmatched:", unmatched.length);
  unmatched.forEach(n => console.log("  UNMATCHED:", n));
  
  await mongoose.disconnect();
}).catch(e => console.error(e.message));
