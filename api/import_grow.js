const mongoose = require("./node_modules/mongoose");
const fs = require("fs");

const orders = JSON.parse(fs.readFileSync("/tmp/grow_orders.json", "utf-8"));

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");

  // קבל כל paymentRef קיים מה-DB
  const existing = await col.find({paymentRef: {$exists: true, $ne: null}}, {projection: {paymentRef: 1}}).toArray();
  const existingRefs = new Set(existing.map(o => String(o.paymentRef)));
  console.log("Existing refs in DB:", existingRefs.size);

  // סנן רק חדשים
  const newOrders = orders.filter(o => !existingRefs.has(o.ref));
  console.log("New orders to insert:", newOrders.length);

  if (newOrders.length === 0) {
    console.log("Nothing to insert.");
    await mongoose.disconnect();
    return;
  }

  // בנה documents
  const docs = newOrders.map(o => {
    // phone cleanup - ensure starts with 0
    let phone = String(o.phone || "").replace(/\D/g, "");
    if (phone.startsWith("972")) phone = "0" + phone.slice(3);

    const items = (o.items || []).map(item => ({
      name: item.name,
      qty: item.qty || 1,
      price: item.price || 0,
      productId: null,
      variant: null,
      vatType: "included"
    }));

    return {
      customerName: o.name || "",
      phone: phone,
      email: o.email || "",
      items: items,
      totalAmount: o.total || 0,
      pickupLocation: "פרדס חנה דרך למרחב 36 - העגלה החברתית",
      pickupDate: null,
      status: "paid",
      paymentRef: o.ref,
      paymentMethod: "grow",
      meshulam_ref: null,
      createdAt: new Date(),
      source: "grow_import"
    };
  });

  // DRY RUN - הדפס 3 ראשונים
  console.log("Sample doc:", JSON.stringify(docs[0], null, 2));
  console.log("\nTotal to insert:", docs.length);
  console.log("\nDRY RUN - not inserting yet. Set DRY_RUN=false to insert.");

  if (process.env.DRY_RUN === "false") {
    const result = await col.insertMany(docs);
    console.log("Inserted:", result.insertedCount);
  }

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
