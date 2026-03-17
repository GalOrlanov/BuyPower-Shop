'use strict';

const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let cachedClient = null;
async function getDb() {
  if (!cachedClient || !cachedClient.topology || !cachedClient.topology.isConnected()) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db('groupPurchase');
}

/**
 * POST /api/shop/group-orders
 * Create or join a group purchase campaign
 * chargeType: 2 for group purchases (conditional charges)
 */
router.post('/group-orders', async (req, res) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    const { customerName, phone, pickupLocation, items } = req.body;
    if (!customerName || !phone || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.connect();
    const db = client.db('groupPurchase');

    // Check which items are group purchase items
    const groupItems = [];
    const regularItems = [];
    
    for (const item of items) {
      const product = await db.collection('shop_products').findOne({ _id: new ObjectId(item.id) });
      if (product && product.isGroupPurchase) {
        groupItems.push({ ...item, product });
      } else {
        regularItems.push(item);
      }
    }

    if (groupItems.length === 0) {
      return res.status(400).json({ error: 'No group purchase items in order' });
    }

    // Create or get campaign for each group item
    const campaigns = [];
    for (const groupItem of groupItems) {
      const product = groupItem.product;
      
      // Find or create campaign for this product
      let campaign = await db.collection('groupPurchaseCampaigns').findOne({
        productId: product._id,
        status: 'active'
      });

      if (!campaign) {
        // Create new campaign
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (product.groupPurchaseDeadlineDays || 3));
        
        campaign = {
          productId: product._id,
          productName: product.name,
          groupPurchaseTarget: product.groupPurchaseTarget,
          groupDealPrice: product.groupDealPrice,
          regularPrice: product.regularPrice,
          deadlineAt: deadline,
          participants: [],
          totalOrders: 0,
          status: 'active',
          createdAt: new Date()
        };
        
        const result = await db.collection('groupPurchaseCampaigns').insertOne(campaign);
        campaign._id = result.insertedId;
      }

      // Add participant
      await db.collection('groupPurchaseCampaigns').updateOne(
        { _id: campaign._id },
        {
          $push: {
            participants: {
              orderId: new ObjectId(),
              customerName,
              phone,
              qty: groupItem.qty,
              createdAt: new Date()
            }
          },
          $inc: { totalOrders: groupItem.qty }
        }
      );

      campaigns.push(campaign);
    }

    // Calculate total amount
    // If campaign target is met: use groupDealPrice; otherwise: use regularPrice
    let totalAmount = 0;
    for (const groupItem of groupItems) {
      const campaign = campaigns.find(c => c.productId.equals(groupItem.product._id));
      const meetTarget = campaign.totalOrders >= campaign.groupPurchaseTarget;
      const price = meetTarget ? campaign.groupDealPrice : campaign.regularPrice;
      totalAmount += price * groupItem.qty;
    }

    // Add regular items to total
    for (const item of regularItems) {
      totalAmount += item.price * item.qty;
    }

    // Create order
    const order = {
      customerName,
      phone,
      pickupLocation: pickupLocation || '',
      items: items,
      totalAmount,
      status: 'pending_payment',
      chargeType: 2, // Group purchase = conditional charge
      campaigns: campaigns.map(c => ({
        campaignId: c._id,
        productId: c.productId,
        qty: items.find(i => i.id === c.productId.toString())?.qty || 0
      })),
      createdAt: new Date()
    };

    const orderResult = await db.collection('shop_orders').insertOne(order);

    res.json({
      orderId: orderResult.insertedId,
      totalAmount,
      chargeType: 2,
      campaigns: campaigns.map(c => ({
        campaignId: c._id,
        participants: c.totalOrders,
        target: c.groupPurchaseTarget,
        deadlineAt: c.deadlineAt,
        currentPrice: c.totalOrders >= c.groupPurchaseTarget ? c.groupDealPrice : c.regularPrice
      }))
    });
  } catch (e) {
    console.error('[Group Purchase] Error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

/**
 * GET /api/shop/group-campaigns/:productId
 * Get campaign status for a product
 */
router.get('/group-campaigns/:productId', async (req, res) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    const { productId } = req.params;

    await client.connect();
    const db = client.db('groupPurchase');

    const campaign = await db.collection('groupPurchaseCampaigns').findOne({
      productId: new ObjectId(productId),
      status: 'active'
    });

    if (!campaign) {
      return res.status(404).json({ error: 'No active campaign' });
    }

    const meetTarget = campaign.totalOrders >= campaign.groupPurchaseTarget;
    res.json({
      campaignId: campaign._id,
      participants: campaign.totalOrders,
      target: campaign.groupPurchaseTarget,
      remainingUntilTarget: Math.max(0, campaign.groupPurchaseTarget - campaign.totalOrders),
      currentPrice: meetTarget ? campaign.groupDealPrice : campaign.regularPrice,
      regularPrice: campaign.regularPrice,
      deadlineAt: campaign.deadlineAt,
      hoursUntilDeadline: Math.ceil((campaign.deadlineAt - new Date()) / (1000 * 60 * 60)),
      targetMet: meetTarget
    });
  } catch (e) {
    console.error('[Group Campaign] Error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
