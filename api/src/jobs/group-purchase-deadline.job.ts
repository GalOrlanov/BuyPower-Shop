import { MongoClient } from 'mongodb';
import { captureGroupPayment, releaseGroupPayment } from '../services/tranzila.service';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

/**
 * Daily job: check group purchase campaign deadlines
 * - If deadline passed: notify customers, finalize pricing
 * - If target met before deadline: trigger auto-charge (chargeType: 2)
 */
export async function checkGroupPurchaseDeadlines() {
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

    console.log(`[Group Purchase Job] Found ${expiredCampaigns.length} expired campaigns`);

    for (const campaign of expiredCampaigns) {
      const targetMet = campaign.totalOrders >= campaign.groupPurchaseTarget;
      const finalPrice = targetMet ? campaign.groupDealPrice : campaign.regularPrice;
      
      // Update all related orders
      const orders = await db.collection('shop_orders').find({
        campaigns: { $elemMatch: { campaignId: campaign._id } }
      }).toArray();

      console.log(`[Group Purchase] Campaign ${campaign._id}: ${campaign.totalOrders} orders, target=${campaign.groupPurchaseTarget}, finalPrice=${finalPrice}`);

      for (const order of orders) {
        // Recalculate order amount with final price
        let newTotal = 0;
        for (const item of order.items || []) {
          const isCampaignItem = campaign.productId.equals((item as any).id);
          const price = isCampaignItem ? finalPrice : (item as any).price;
          newTotal += price * ((item as any).qty || 1);
        }

        // Mark campaign as closed
        await db.collection('shop_orders').updateOne(
          { _id: order._id },
          {
            $set: {
              totalAmount: newTotal,
              'campaigns.$[elem].status': 'closed',
              'campaigns.$[elem].finalPrice': finalPrice,
              'campaigns.$[elem].targetMet': targetMet,
              'campaigns.$[elem].closedAt': now
            }
          },
          { arrayFilters: [{ 'elem.campaignId': campaign._id }] }
        );

        // ── TRANZILA: Capture or Release credit hold ──────────────────
        if (order.tranzilaTK && order.tranzilaExpdate) {
          if (targetMet) {
            // Campaign succeeded → capture (charge) the card
            const captureResult = await captureGroupPayment({
              token: order.tranzilaTK,
              expdate: order.tranzilaExpdate,
              amount: newTotal,
              orderId: `CAPTURE_${order._id}_${Date.now()}`,
            });
            if (captureResult.success) {
              await db.collection('shop_orders').updateOne(
                { _id: order._id },
                { $set: { paymentStatus: 'charged', chargeConfirmCode: captureResult.confirmationCode } }
              );
            } else {
              console.error(`[Group Purchase] Capture FAILED for order ${order._id}:`, captureResult.error);
              await db.collection('shop_orders').updateOne(
                { _id: order._id },
                { $set: { paymentStatus: 'capture_failed' } }
              );
            }
          } else {
            // Campaign failed → void the hold, don't charge
            const voidResult = await releaseGroupPayment({
              token: order.tranzilaTK,
              expdate: order.tranzilaExpdate,
              amount: order.tranzilaHoldAmount || newTotal,
              confirmationCode: order.tranzilaConfirmCode || '',
              orderId: `VOID_${order._id}_${Date.now()}`,
            });
            if (voidResult.success) {
              await db.collection('shop_orders').updateOne(
                { _id: order._id },
                { $set: { paymentStatus: 'voided' } }
              );
            } else {
              console.error(`[Group Purchase] Void FAILED for order ${order._id}:`, voidResult.error);
            }
          }
        }
        // ─────────────────────────────────────────────────────────────

        // Send notification to customer
        try {
          await notifyCustomer(order, campaign, targetMet, finalPrice);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Group Purchase] Notification error for order ${order._id}:`, errMsg);
        }
      }

      // Mark campaign as closed
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

    // Check for campaigns that met target before deadline (early close)
    const metTargetCampaigns = await db.collection('groupPurchaseCampaigns').find({
      status: 'active',
      totalOrders: { $gte: (await db.collection('shop_products').findOne({}))?.groupPurchaseTarget || 2 }
    }).toArray();

    for (const campaign of metTargetCampaigns) {
      console.log(`[Group Purchase] Campaign ${campaign._id} met target early! Triggering early close.`);
      
      // Early close with discounted price
      await db.collection('groupPurchaseCampaigns').updateOne(
        { _id: campaign._id },
        {
          $set: {
            status: 'closed',
            finalPrice: campaign.groupDealPrice,
            targetMet: true,
            closedAt: now
          }
        }
      );

      // Notify customers of early win
      const orders = await db.collection('shop_orders').find({
        campaigns: { $elemMatch: { campaignId: campaign._id } }
      }).toArray();

      for (const order of orders) {
        await notifyCustomer(order, campaign, true, campaign.groupDealPrice, true);
      }
    }

    return { processed: expiredCampaigns.length };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[Group Purchase Job] Error:', errMsg);
    throw e;
  } finally {
    await client.close();
  }
}

async function notifyCustomer(order: any, campaign: any, targetMet: boolean, finalPrice: number, earlyWin: boolean = false) {
  const campaignItem = (order.items || []).find((i: any) => campaign.productId.toString() === i.id);
  const message = earlyWin
    ? `🎉 קמפיין הקנייה הקבוצתית הגיע ליעד מוקדם! המחיר שלך: ₪${finalPrice} ל${campaignItem?.qty || 1}`
    : targetMet
    ? `✅ קמפיין הקנייה הקבוצתית הצליח! המחיר שלך: ₪${finalPrice} ל${campaignItem?.qty || 1}`
    : `❌ קמפיין הקנייה הקבוצתית לא הצליח (פחות מ${campaign.groupPurchaseTarget} קוניים). המחיר המעודכן שלך: ₪${finalPrice}. אישור דרוש בצעד בא.`;

  console.log(`[Notification] ${order.customerName} (${order.phone}): ${message}`);
  
  // TODO: Send SMS/WhatsApp to customer
  // await sendSMS(order.phone, message);
}
