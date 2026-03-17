'use strict';

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

/**
 * POST /api/shop/group-check-deadlines
 * Manual trigger for checking campaign deadlines
 * (Also run via cron daily)
 */
router.post('/group-check-deadlines', async (req, res) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('groupPurchase');
    
    const now = new Date();
    
    // Find campaigns that have reached their deadline
    const expiredCampaigns = await db.collection('groupPurchaseCampaigns').find({
      status: 'active',
      deadlineAt: { $lte: now }
    }).toArray();

    console.log(`[Group Purchase Cron] Found ${expiredCampaigns.length} expired campaigns`);

    const processed = [];

    for (const campaign of expiredCampaigns) {
      const targetMet = campaign.totalOrders >= campaign.groupPurchaseTarget;
      const finalPrice = targetMet ? campaign.groupDealPrice : campaign.regularPrice;
      
      // Find all orders for this campaign
      const orders = await db.collection('shop_orders').find({
        campaigns: { $elemMatch: { campaignId: campaign._id } }
      }).toArray();

      console.log(`[Campaign ${campaign._id}] ${campaign.totalOrders} orders, target=${campaign.groupPurchaseTarget}, price=${finalPrice}`);

      for (const order of orders) {
        // Recalculate total with final price
        let newTotal = 0;
        for (const item of order.items || []) {
          const itemId = item.id || item.productId;
          const isCampaignItem = campaign.productId.equals(itemId);
          const price = isCampaignItem ? finalPrice : (item.price || 0);
          newTotal += price * (item.qty || 1);
        }

        // Update order with final campaign status
        await db.collection('shop_orders').updateOne(
          { _id: order._id },
          {
            $set: {
              totalAmount: newTotal,
              groupPurchaseFinalPrice: finalPrice,
              groupPurchaseTargetMet: targetMet,
              groupPurchaseClosed: true
            }
          }
        );

        processed.push({
          orderId: order._id,
          customer: order.customerName,
          phone: order.phone,
          newTotal: newTotal,
          targetMet: targetMet
        });

        // TODO: Send SMS/WhatsApp notification
        if (targetMet) {
          console.log(`[SMS] ${order.phone}: ✅ קמפיין הצליח! המחיר שלך: ₪${finalPrice}`);
        } else {
          console.log(`[SMS] ${order.phone}: ❌ קמפיין נכשל. המחיר חדש: ₪${finalPrice}`);
        }
      }

      // Close campaign
      await db.collection('groupPurchaseCampaigns').updateOne(
        { _id: campaign._id },
        {
          $set: {
            status: 'closed',
            finalPrice: finalPrice,
            targetMet: targetMet,
            closedAt: now
          }
        }
      );
    }

    res.json({
      success: true,
      campaignsProcessed: expiredCampaigns.length,
      ordersUpdated: processed.length,
      details: processed
    });
  } catch (e) {
    console.error('[Group Purchase Cron] Error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
