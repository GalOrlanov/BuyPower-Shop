const mongoose = require("./node_modules/mongoose");
const fs = require("fs");

const refDates = JSON.parse(fs.readFileSync("/tmp/ref_dates.json", "utf-8"));

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");

  let updated = 0;
  for (const [ref, isoDate] of Object.entries(refDates)) {
    const result = await col.updateOne(
      {paymentRef: ref, source: "grow_import"},
      {$set: {createdAt: new Date(isoDate)}}
    );
    if (result.modifiedCount > 0) updated++;
  }
  
  console.log("Updated:", updated, "orders");
  
  // verify
  const byDate = await col.aggregate([
    {$match: {source: "grow_import"}},
    {$group: {_id: {$dateToString: {format: "%Y-%m-%d", date: "$createdAt"}}, count: {$sum: 1}}}
  ]).toArray();
  console.log("By date after fix:", JSON.stringify(byDate, null, 2));

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
