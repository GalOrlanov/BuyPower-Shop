const mongoose = require("./node_modules/mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection("shop_orders");
  
  const from = new Date("2026-03-22T00:00:00.000Z");
  const to = new Date("2026-03-28T23:59:59.000Z");
  
  const count = await col.countDocuments({
    status: {$in: ["paid", "confirmed"]},
    createdAt: {$gte: from, $lte: to}
  });
  console.log("paid/confirmed this week:", count);

  const countAll = await col.countDocuments({
    createdAt: {$gte: from, $lte: to}
  });
  console.log("All statuses this week:", countAll);

  // breakdown by status
  const byStatus = await col.aggregate([
    {$match: {createdAt: {$gte: from, $lte: to}}},
    {$group: {_id: "$status", count: {$sum: 1}}}
  ]).toArray();
  console.log("By status:", JSON.stringify(byStatus));

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
