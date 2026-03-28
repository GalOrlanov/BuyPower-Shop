const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const inv = await db.collection("shop_inventory").find({isActive: true}).sort({sortOrder:1}).toArray();
  // סדר קטגוריות לפי הופעה ראשונה
  const catOrder = [];
  inv.forEach(i => {
    const cat = i.category || "כללי";
    if (!catOrder.includes(cat)) catOrder.push(cat);
  });
  console.log("Category order:", JSON.stringify(catOrder));
  await mongoose.disconnect();
}).catch(e => console.error(e.message));
