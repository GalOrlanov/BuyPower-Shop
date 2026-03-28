const mongoose = require("./node_modules/mongoose");
const { ObjectId } = require("./node_modules/mongodb");

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  // טען inventory - בנה map: שם נקי -> {_id, category, name}
  const inv = await db.collection("shop_inventory").find({}).toArray();
  const invByName = {};
  inv.forEach(i => { if(i.name) invByName[i.name.trim()] = i; });
  
  // פונקציה לנקות שם מ-Grow
  function cleanName(name) {
    // הסר מספר בסוף (שם + רווח + מספר)
    return name.replace(/\s+\d+(\.\d+)?$/, ).trim();
  }
  
  // גם וריאנט — שם מוצר grow בפורמט "שם מוצר - וריאנט"
  // אם inventory מוצר הוא parent, הוריאנט בתוך variants
  function findInInv(rawName) {
    const clean = cleanName(rawName);
    
    // exact
    if (invByName[clean]) return { inv: invByName[clean], variant: null };
    
    // חפש לפי prefix (שם inventory הוא prefix של שם grow)
    for (const [invName, invItem] of Object.entries(invByName)) {
      if (clean.startsWith(invName +  - ) || clean.startsWith(invName +  - )) {
        const variant = clean.slice(invName.length).replace(/^\s*-\s*/, ).trim();
        return { inv: invItem, variant };
      }
      // הפוך — grow prefix של inventory
      if (invName.startsWith(clean +  - ) || invName === clean) {
        return { inv: invItem, variant: null };
      }
    }
    return null;
  }
  
  // קבל כל הזמנות grow_import
  const orders = await db.collection("shop_orders").find({source: "grow_import"}).toArray();
  console.log("Orders to fix:", orders.length);
  
  let updatedOrders = 0;
  
  for (const order of orders) {
    let changed = false;
    const newItems = (order.items || []).map(item => {
      const found = findInInv(item.name);
      if (found) {
        const newItem = {
          ...item,
          name: found.inv.name, // שם נקי מinventory
          productId: found.inv._id.toString(),
          category: found.inv.category || כללי,
        };
        if (found.variant && !item.variant) newItem.variant = found.variant;
        if (newItem.name !== item.name || newItem.productId !== item.productId) changed = true;
        return newItem;
      }
      // לא מצא — לפחות נקה שם
      const cleaned = cleanName(item.name);
      if (cleaned !== item.name) {
        changed = true;
        return { ...item, name: cleaned };
      }
      return item;
    });
    
    if (changed) {
      await db.collection("shop_orders").updateOne(
        { _id: order._id },
        { $set: { items: newItems } }
      );
      updatedOrders++;
    }
  }
  
  console.log("Updated orders:", updatedOrders);
  
  // בדוק כמה עכשיו ללא category
  const after = await db.collection("shop_orders").find({source: "grow_import"}).toArray();
  const noCat = after.filter(o => (o.items||[]).some(i => !i.category || i.category === כללי));
  console.log("Orders still with כללי/no category:", noCat.length);

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
