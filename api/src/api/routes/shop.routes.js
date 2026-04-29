'use strict';

const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'shop_secret_2026';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/grouppurchase/uploads';
const UPLOADS_URL_BASE = process.env.UPLOADS_URL_BASE || 'https://shop.buypower.co.il/uploads';

// Ensure uploads dir exists
try { if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch(e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, 'prod-' + unique + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// POST /api/shop/upload-image — upload product image
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = UPLOADS_URL_BASE + '/' + req.file.filename;
  res.json({ ok: true, imageUrl, filename: req.file.filename });
});

function verifyShopToken(req, res, next) {
  let token = null;
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (req.cookies && req.cookies.shopToken) {
    token = req.cookies.shopToken;
  }
  if (!token) return res.status(401).json({ error: 'לא מחובר' });
  try {
    req.shopUser = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'טוקן לא תקף' });
  }
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';
const YEDIDYA_PAGE_CODE = process.env.YEDIDYA_MESHULAM_PAGE_CODE || '';
const BASE_URL = process.env.BASE_URL || 'http://64.23.156.254:8082';

let cachedClient = null;
async function getDb() {
  if (!cachedClient || !cachedClient.topology || !cachedClient.topology.isConnected()) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db(process.env.SHOP_DB_NAME || 'shop_prod');
}

// ─── Pickup-point validation helpers ─────────────────────────────────────────
// Single source of truth for "is this pickup-point name allowed?".
// Throws an object {code, msg} consumed by the route handlers below.
async function assertValidPickupPoint(db, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw { code: 400, msg: 'נקודת איסוף חסרה' };
  const doc = await db.collection('shop_settings').findOne({ key: 'pickupPoints' });
  const valid = (doc && Array.isArray(doc.points)) ? doc.points.map(p => p.name) : [];
  if (valid.length && !valid.includes(trimmed)) {
    throw { code: 400, msg: 'נקודת איסוף לא קיימת' };
  }
  return trimmed;
}

// Always write both fields together so they can never drift apart.
function userPickupUpdate(name) {
  return { pickupPoint: name, pickupLocation: name };
}

// ─── Phone normalization ─────────────────────────────────────────────────────
// Single canonical format: 10-digit Israeli "0XXXXXXXXX". Accepts inputs with
// "+972", "972", spaces, dashes, etc., and converts to the canonical form. Used
// at every entry point where we read or write a phone, so lookups (and the user
// guard in /orders POST) always see the same string regardless of how the user
// typed it.
function normalizePhone(input) {
  if (!input) return '';
  let p = String(input).replace(/\D/g, '');
  if (p.startsWith('972')) p = '0' + p.slice(3);
  return p;
}
function isValidIsraeliPhone(p) {
  return /^0\d{8,9}$/.test(p);
}

const INFORU_API_TOKEN = process.env.INFORU_API_TOKEN || 'Ym95cG93ZXI6ZjA2MDYwNTMtZjY2OS00NGQzLTkzNjAtMDYzNmNiNDE2NzVh';
const INFORU_SENDER = process.env.INFORU_SENDER || 'BuyPower';

async function sendSMS(phone, message) {
  // Format phone: ensure it starts with 972
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) formattedPhone = '972' + formattedPhone.slice(1);
  if (!formattedPhone.startsWith('972')) formattedPhone = '972' + formattedPhone;

  console.log(`[SMS Inforu] Sending to ${formattedPhone}: ${message}`);

  try {
    const https = require('https');
    const payload = JSON.stringify({
      Data: {
        Message: message,
        Recipients: [{ Phone: formattedPhone }],
        Settings: { Sender: INFORU_SENDER }
      }
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'capi.inforu.co.il',
        path: '/api/v2/SMS/SendSms',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + INFORU_API_TOKEN,
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      const req = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          console.log('[SMS Inforu] Response:', data);
          resolve(data);
        });
      });
      req.on('error', (e) => {
        console.error('[SMS Inforu] Error:', e.message);
        reject(e);
      });
      req.write(payload);
      req.end();
    });
    return result;
  } catch(e) {
    console.error('SMS send failed:', e.message);
  }
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

router.get('/products', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  try {
    const db = await getDb();
    // SINGLE SOURCE OF TRUTH: shop_inventory
    // Rule: isActive=true in inventory → show in shop. isActive=false → hidden. Period.
    const inventoryItems = await db.collection('shop_inventory')
      .find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .toArray();

    // Load linked shop_products for extra display fields (images, variants, pickupPoints, description)
    const shopProdIds = inventoryItems.map(i => i.shopProductId).filter(Boolean);
    const { ObjectId } = require('mongodb');
    const shopProds = shopProdIds.length
      ? await db.collection('shop_products').find({ _id: { $in: shopProdIds.map(id => { try { return new ObjectId(id); } catch(e) { return null; } }).filter(Boolean) } }).toArray()
      : [];
    const shopProdById = {};
    shopProds.forEach(p => { shopProdById[p._id.toString()] = p; });

    const results = inventoryItems.map(inv => {
      const prod = inv.shopProductId ? shopProdById[inv.shopProductId.toString()] : null;

      // pickupPoint filter — if product has pickupPoints, show only to matching customers
      if (req.query.pickupPoint) {
        const pp = (prod && prod.pickupPoints) || inv.pickupPoints || [];
        if (pp.length > 0 && !pp.includes(req.query.pickupPoint)) return null;
      }

      return {
        _id: (prod && prod._id) || inv._id,
        _inventoryId: inv._id,
        name: inv.name || (prod && prod.name) || '',
        description: (prod && prod.description) || inv.notes || '',
        imageUrl: (prod && prod.imageUrl) || inv.imageUrl || '',
        imageUrls: (prod && prod.imageUrls && prod.imageUrls.length) ? prod.imageUrls : (inv.imageUrl ? [inv.imageUrl] : []),
        marketPrice: inv.marketPrice != null ? inv.marketPrice : ((prod && prod.marketPrice) || 0),
        shopPrice: inv.sellingPrice || (prod && prod.shopPrice) || 0,
        stock: inv.quantity != null ? inv.quantity : ((prod && prod.stock) || 0),
        available_until: (prod && prod.available_until) || null,
        variants: (prod && prod.variants) || [],
        isActive: true,
        category: inv.category || (prod && prod.category) || 'כללי',
        vatType: inv.vatType || (prod && prod.vatType) || 'exempt',
        vatIncluded: inv.vatIncluded != null ? inv.vatIncluded : ((prod && prod.vatIncluded) || false),
        pickupPoints: (prod && prod.pickupPoints) || inv.pickupPoints || [],
        isFeatured: inv.isFeatured || false,
        sortOrder: inv.sortOrder != null ? inv.sortOrder : ((prod && prod.sortOrder) || 0),
        quantityDeals: inv.quantityDeals || (prod && prod.quantityDeals) || [],
        minQuantity: inv.minQuantity || (prod && prod.minQuantity) || 1,
        unit: inv.unit || (prod && prod.unit) || 'יח\'',
        createdAt: (prod && prod.createdAt) || inv.createdAt,
      };
    }).filter(Boolean);

    results.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || (new Date(b.createdAt) - new Date(a.createdAt)));
    res.json(results);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/products/all', async (req, res) => {
  try {
    const db = await getDb();
    const products = await db.collection('shop_products')
      .find({})
      .sort({ sortOrder: 1, createdAt: -1 })
      .toArray();
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/products/reorder', async (req, res) => {
  try {
    const db = await getDb();
    const ids = req.body.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
    const ops = ids.map((id, index) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: { $set: { sortOrder: index } },
      },
    }));
    await db.collection('shop_products').bulkWrite(ops);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/products', async (req, res) => {
  console.log('[products POST]', new Date().toISOString(), 'name:', req.body.name, 'active:', req.body.isActive, 'pickup:', JSON.stringify(req.body.pickupPoints));
  try {
    const db = await getDb();
    const imageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls.filter(Boolean) : (req.body.imageUrl ? [req.body.imageUrl] : []);
    const isActive = req.body.isActive !== false;
    const doc = {
      name: req.body.name,
      description: req.body.description || '',
      imageUrl: imageUrls[0] || req.body.imageUrl || '',
      imageUrls: imageUrls,
      marketPrice: parseFloat(req.body.marketPrice) || 0,
      shopPrice: parseFloat(req.body.shopPrice) || 0,
      stock: parseInt(req.body.stock) || 0,
      available_until: req.body.available_until || null,
      variants: Array.isArray(req.body.variants) ? req.body.variants : [],
      isActive,
      category: req.body.category || 'כללי',
      vatType: req.body.vatType || 'exempt',
      vatIncluded: req.body.vatIncluded || false,
      pickupPoints: Array.isArray(req.body.pickupPoints) ? req.body.pickupPoints : [],
      isFeatured: req.body.isFeatured || false,
      sortOrder: parseInt(req.body.sortOrder) || 0,
      minQuantity: parseInt(req.body.minQuantity) || 1,
      unit: req.body.unit || 'יח\'',
      quantityDeals: Array.isArray(req.body.quantityDeals) ? req.body.quantityDeals : [],
      createdAt: new Date(),
    };
    const result = await db.collection('shop_products').insertOne(doc);
    const shopProductId = result.insertedId;

    // AUTO-CREATE inventory entry so shop and inventory stay in sync
    // Only if no existing inventory entry for this name (prevents duplicates when syncing from inventory page)
    try {
      const existingInv = await db.collection('shop_inventory').findOne({ name: doc.name });
      if (existingInv) {
        // Link existing inventory to this shop product instead of creating duplicate
        await db.collection('shop_products').updateOne(
          { _id: shopProductId },
          { $set: { inventoryId: existingInv._id.toString() } }
        );
        await db.collection('shop_inventory').updateOne(
          { _id: existingInv._id },
          { $set: { shopProductId: shopProductId.toString(), updatedAt: new Date() } }
        );
        doc.inventoryId = existingInv._id.toString();
      } else {
      const invDoc = {
        name: doc.name,
        quantity: doc.stock,
        purchasePrice: parseFloat(req.body.purchasePrice) || 0,
        sellingPrice: doc.shopPrice,
        marketPrice: doc.marketPrice,
        unit: doc.unit,
        category: doc.category,
        imageUrl: doc.imageUrl,
        supplier: req.body.supplier || '',
        lowStockAlert: parseInt(req.body.lowStockAlert) || 5,
        expiryDate: req.body.expiryDate || null,
        notes: doc.description,
        isActive,
        vatType: doc.vatType,
        vatIncluded: doc.vatIncluded,
        pickupPoints: doc.pickupPoints,
        sortOrder: doc.sortOrder,
        quantityDeals: doc.quantityDeals,
        minQuantity: doc.minQuantity,
        shopProductId: shopProductId.toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const invResult = await db.collection('shop_inventory').insertOne(invDoc);
      // Link back inventory id on the shop product
      await db.collection('shop_products').updateOne(
        { _id: shopProductId },
        { $set: { inventoryId: invResult.insertedId.toString() } }
      );
      doc.inventoryId = invResult.insertedId.toString();
      } // end else - no existing inventory
    } catch (invErr) {
      console.warn('Auto-create inventory entry failed:', invErr.message);
    }

    res.json({ ...doc, _id: shopProductId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const db = await getDb();
    const update = {};
    const fields = ['name', 'description', 'imageUrl', 'imageUrls', 'marketPrice', 'shopPrice', 'stock', 'available_until', 'isActive', 'variants', 'minQuantity', 'isFeatured', 'unit', 'category', 'pickupPoints', 'vatIncluded', 'vatType', 'packSize', 'quantityDeals', 'sortOrder', 'hasUnlimitedStock'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === 'marketPrice' || f === 'shopPrice') update[f] = parseFloat(req.body[f]);
        else if (f === 'stock') update[f] = parseInt(req.body[f]);
        else if (f === 'isActive') update[f] = req.body[f] === true || req.body[f] === 'true';
        else if (f === 'variants') update[f] = Array.isArray(req.body[f]) ? req.body[f] : [];
        else if (f === 'minQuantity') update[f] = parseInt(req.body[f]) || 1;
        else if (f === 'imageUrls') { update[f] = Array.isArray(req.body[f]) ? req.body[f].filter(Boolean) : []; }
        else update[f] = req.body[f];
      }
    }
    // Keep imageUrl in sync with imageUrls[0]
    if (update.imageUrls && update.imageUrls.length) {
      update.imageUrl = update.imageUrls[0];
    } else if (update.imageUrl && !update.imageUrls) {
      update.imageUrls = [update.imageUrl];
    }
    await db.collection('shop_products').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('shop_products').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ANNOUNCEMENTS ───────────────────────────────────────────────────────────

router.get('/announcements', async (req, res) => {
  try {
    const db = await getDb();
    const items = await db.collection('shop_announcements')
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/announcements/all', async (req, res) => {
  try {
    const db = await getDb();
    const items = await db.collection('shop_announcements')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const db = await getDb();
    const doc = { text: req.body.text, isActive: true, createdAt: new Date() };
    const result = await db.collection('shop_announcements').insertOne(doc);
    res.json({ ...doc, _id: result.insertedId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/announcements/:id', async (req, res) => {
  try {
    const db = await getDb();
    const update = {};
    if (req.body.text !== undefined) update.text = req.body.text;
    if (req.body.isActive !== undefined) update.isActive = req.body.isActive === true || req.body.isActive === 'true';
    await db.collection('shop_announcements').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('shop_announcements').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────

router.get('/settings', async (req, res) => {
  try {
    const db = await getDb();
    let settings = await db.collection('shop_settings').findOne({ key: { $exists: false } }) || {};
    // pickupLocations is ALWAYS derived from the canonical pickupPoints doc.
    // Never read from the legacy field on the settings doc — it could be stale.
    const ppDoc = await db.collection('shop_settings').findOne({ key: 'pickupPoints' });
    settings.pickupLocations = (ppDoc?.points || []).map(p => ({
      name: p.name || '',
      address: p.address || '',
      days: p.days || '',
      hours: p.hours || '',
      collectionDate: p.collectionDate || null,
      collectionTimeFrom: p.collectionTimeFrom || '',
      collectionTimeTo: p.collectionTimeTo || '',
    }));
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const db = await getDb();
    // CRITICAL: pickup points are NOT settings — they have dedicated CRUD endpoints
    // (POST/PUT/DELETE /pickup-points). We strip pickupLocations from the body so
    // that an unrelated settings save (minOrderAmount, isClosed, etc.) cannot
    // overwrite the master pickup-points list with stale client-side state.
    const body = (function(b){ delete b._id; delete b.key; delete b.pickupLocations; return b; })(Object.assign({}, req.body));
    await db.collection('shop_settings').updateOne(
      { key: { $exists: false } },
      { $set: body },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== PICKUP POINTS CRUD =====
// Single source of truth. Settings does NOT touch this collection.

// POST /pickup-points — add ONE point (idempotent on name)
router.post('/pickup-points', async (req, res) => {
  try {
    const db = await getDb();
    const { name, address, days, hours, collectionDate, collectionTimeFrom, collectionTimeTo, managerName, managerPassword } = req.body;
    const trimmed = (name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'שם נקודה חסר' });
    const doc = await db.collection('shop_settings').findOne({ key: 'pickupPoints' });
    const existing = (doc?.points || []);
    if (existing.find(p => p.name === trimmed)) {
      return res.status(409).json({ error: 'נקודה בשם זה כבר קיימת' });
    }
    const newPoint = {
      name: trimmed,
      address: address || '',
      days: days || '',
      hours: hours || '',
      collectionDate: collectionDate || null,
      collectionTimeFrom: collectionTimeFrom || '',
      collectionTimeTo: collectionTimeTo || '',
      managerName: managerName || '',
      managerPassword: managerPassword || '',
    };
    await db.collection('shop_settings').updateOne(
      { key: 'pickupPoints' },
      { $push: { points: newPoint }, $setOnInsert: { key: 'pickupPoints' } },
      { upsert: true }
    );
    res.json({ ok: true, point: newPoint });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /pickup-points/:name — partial update of one point's fields
router.patch('/pickup-points/:name', async (req, res) => {
  try {
    const db = await getDb();
    const target = decodeURIComponent(req.params.name);
    const update = {};
    ['address','days','hours','collectionDate','collectionTimeFrom','collectionTimeTo','managerName','managerPassword'].forEach(f => {
      if (req.body[f] !== undefined) update['points.$.' + f] = req.body[f];
    });
    if (!Object.keys(update).length) return res.status(400).json({ error: 'אין שדות לעדכן' });
    const r = await db.collection('shop_settings').updateOne(
      { key: 'pickupPoints', 'points.name': target },
      { $set: update }
    );
    if (!r.matchedCount) return res.status(404).json({ error: 'נקודה לא נמצאה' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /pickup-points/:name
router.delete('/pickup-points/:name', async (req, res) => {
  try {
    const db = await getDb();
    const target = decodeURIComponent(req.params.name);
    const r = await db.collection('shop_settings').updateOne(
      { key: 'pickupPoints' },
      { $pull: { points: { name: target } } }
    );
    if (!r.matchedCount) return res.status(404).json({ error: 'מסמך לא קיים' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PICKUP POINTS ───────────────────────────────────────────────────────────

router.get('/pickup-points', async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection('shop_settings').findOne({ key: 'pickupPoints' });
    // No hardcoded fallback — fresh installs return [] and the admin adds points
    // through the settings UI. This keeps the master list under the admin's control.
    const points = (doc && Array.isArray(doc.points)) ? doc.points : [];
    // Manager auth endpoint
    if (req.query.managerLogin) {
      const { pointName, password } = req.query;
      const pt = points.find(p => p.name === pointName && p.managerPassword === password);
      return res.json({ ok: !!pt, point: pt ? pt.name : null });
    }
    // Strip passwords from public response
    res.json(points.map(p => ({ name: p.name, address: p.address, days: p.days, hours: p.hours, managerName: p.managerName || '' })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Manager login
router.post('/pickup-points/manager-login', async (req, res) => {
  try {
    const db = await getDb();
    const { pointName, password } = req.body;
    const doc = await db.collection('shop_settings').findOne({ key: 'pickupPoints' });
    if (!doc) return res.status(401).json({ error: 'לא נמצא' });
    const pt = doc.points.find(p => p.name === pointName && p.managerPassword === password);
    if (!pt) return res.status(401).json({ error: 'סיסמה שגויה' });
    res.json({ ok: true, point: pt.name, managerName: pt.managerName });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/pickup-points', async (req, res) => {
  try {
    const db = await getDb();
    const { points } = req.body;
    await db.collection('shop_settings').updateOne(
      { key: 'pickupPoints' },
      { $set: { key: 'pickupPoints', points } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ORDERS ──────────────────────────────────────────────────────────────────

router.post('/orders', async (req, res) => {
  try {
    const db = await getDb();
    const { customerName, phone, items, pickupLocation, pickupDate } = req.body;

    // 0. Reject empty carts — prevents phantom orders from being created when
    // the cart was already cleared (back-button / retry after redirect to Grow).
    if (!Array.isArray(items) || !items.length || !items.some(i => (Number(i.qty) || 0) > 0 && Number(i.price) > 0)) {
      return res.status(400).json({ error: 'סל הקניות ריק' });
    }

    // 1. Pickup must be present + exist in master list
    let cleanPickup;
    try { cleanPickup = await assertValidPickupPoint(db, pickupLocation); }
    catch (e) { return res.status(e.code || 400).json({ error: e.msg }); }

    // 2. Customer must be a registered shop_user (no anonymous / guest orders).
    // PRIMARY auth: a valid Authorization JWT — the userId in it is the source of
    // truth. This survives phone-format edge cases AND the user staying logged in
    // even if their record was somehow renamed/duplicated. Falls back to phone
    // lookup so older clients (no token in their localStorage) still work.
    const cleanPhone = normalizePhone(phone);
    if (!isValidIsraeliPhone(cleanPhone)) {
      return res.status(400).json({ error: 'מספר טלפון לא תקין' });
    }
    let user = null;
    const authHdr = req.headers['authorization'] || '';
    const token = authHdr.startsWith('Bearer ') ? authHdr.slice(7) : null;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload && payload.userId) {
          user = await db.collection('shop_users').findOne({ _id: new ObjectId(payload.userId) });
        }
      } catch (_) { /* invalid/expired — fall through to phone lookup */ }
    }
    if (!user) {
      user = await db.collection('shop_users').findOne({ phone: cleanPhone });
    }
    if (!user) {
      return res.status(401).json({ error: 'יש להירשם לפני ביצוע הזמנה' });
    }

    // 3. Order's pickup must match the user's profile pickup (no cross-point mixing)
    const userPickup = (user.pickupPoint || user.pickupLocation || '').trim();
    if (!userPickup) {
      return res.status(400).json({ error: 'חסרה נקודת איסוף בפרופיל. יש להשלים הרשמה.' });
    }
    if (userPickup !== cleanPickup) {
      return res.status(400).json({ error: 'נקודת האיסוף בהזמנה לא תואמת לפרופיל שלך' });
    }

    // Calculate total
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.price * item.qty;
    }
    if (!(totalAmount > 0)) {
      return res.status(400).json({ error: 'סכום הזמנה לא תקין' });
    }

    const doc = {
      customerName,
      phone: cleanPhone,
      items,
      totalAmount,
      pickupLocation,
      pickupDate,
      status: 'pending_payment',
      meshulam_ref: null,
      createdAt: new Date(),
    };

    const result = await db.collection('shop_orders').insertOne(doc);
    const orderId = result.insertedId.toString();
    // Update user's pickupLocation by phone
    if (cleanPhone && pickupLocation) {
      await db.collection('shop_users').updateOne(
        { phone: cleanPhone },
        { $set: { pickupLocation } },
        { upsert: false }
      ).catch(()=>{});
    }

    const successUrl = encodeURIComponent(`${BASE_URL}/shop/success.html?orderId=${orderId}`);
    const failUrl = encodeURIComponent(`${BASE_URL}/shop/cart.html?error=1`);

    let meshulam_url = null;
    if (YEDIDYA_PAGE_CODE) {
      meshulam_url = `https://secure.meshulam.co.il/payingPage?pageCode=${YEDIDYA_PAGE_CODE}&sum=${totalAmount.toFixed(2)}&successUrl=${successUrl}&failUrl=${failUrl}&description=${encodeURIComponent('הזמנה מהחנות של ידידיה')}&name=${encodeURIComponent(customerName)}&phone=${encodeURIComponent(phone)}`;
    }

    res.json({ orderId, meshulam_url, totalAmount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/shop/payments — Admin: list paid orders + Grow payment details, with date filter + pagination
router.get('/payments', async (req, res) => {
  try {
    const db = await getDb();
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;
    const skip = (page - 1) * perPage;

    // Query paid orders
    const dateField = req.query.dateField === 'paidAt' ? 'paidAt' : 'createdAt';
    const query = { status: { $in: ['paid', 'handled', 'confirmed'] } };
    if (req.query.from) query[dateField] = { $gte: new Date(req.query.from) };
    if (req.query.to) {
      const toDate = new Date(req.query.to);
      toDate.setHours(23, 59, 59, 999);
      query[dateField] = { ...query[dateField], $lte: toDate };
    }

    const [orders, total] = await Promise.all([
      db.collection('shop_orders').find(query).sort({ [dateField]: -1 }).skip(skip).limit(perPage).toArray(),
      db.collection('shop_orders').countDocuments(query)
    ]);

    // Enrich with Grow payment data where available
    const phones = orders.map(o => (o.phone || '').replace(/\D/g, '').slice(-9)).filter(Boolean);
    const orderIds = orders.map(o => o._id.toString());
    // Get the date range of orders to scope the invoice search
    const oldestOrder = orders.length ? orders[orders.length - 1].createdAt : new Date();
    const invoiceSince = new Date(oldestOrder.getTime() - 24 * 60 * 60 * 1000); // 1 day before oldest order
    const [growPayments, growInvoices] = await Promise.all([
      phones.length ? db.collection('grow_payments').find({
        type: { $ne: 'invoice' },
        $or: phones.flatMap(p => [
          { 'rawBody.data.payerPhone': { $regex: p } },
          { 'rawBody.payerPhone': { $regex: p } },
          { customerPhone: { $regex: p } }
        ])
      }).sort({ createdAt: -1 }).toArray() : [],
      // Fetch all invoice records in date range — match in JS by processId/transactionId
      db.collection('grow_payments').find({
        type: 'invoice',
        createdAt: { $gte: invoiceSince }
      }).sort({ createdAt: -1 }).toArray()
    ]);

    const enriched = orders.map(o => {
      const orderPhone = (o.phone || '').replace(/\D/g, '').slice(-9);
      const gp = growPayments.find(g => {
        const rb = g.rawBody || {};
        const gpPhone = (rb.payerPhone || (rb.data && rb.data.payerPhone) || g.customerPhone || '').replace(/\D/g, '').slice(-9);
        return gpPhone === orderPhone;
      });
      // Find invoice record by orderId, phone, or processId/transactionId
      const gpProcessId = gp && gp.rawBody && gp.rawBody.data && gp.rawBody.data.processId;
      const gpTxId = gp && gp.rawBody && gp.rawBody.data && gp.rawBody.data.transactionId;
      const inv = growInvoices.find(g =>
        (g.orderId && g.orderId === o._id.toString()) ||
        (g.phone && g.phone.replace(/\D/g, '').slice(-9) === orderPhone) ||
        (gpProcessId && (g.processId === gpProcessId || (g.rawBody && g.rawBody.processId === gpProcessId))) ||
        (gpTxId && (g.transactionId === gpTxId || (g.rawBody && g.rawBody.transactionId === gpTxId)))
      );
      const rawBody = gp && gp.rawBody ? gp.rawBody : {};
      const raw = rawBody.data || rawBody;
      const invoiceUrl = o.invoiceUrl || (inv && inv.invoiceUrl) || raw.invoiceURL || '';
      const invoiceNumber = o.invoiceNumber || (inv && inv.invoiceNumber) || '';
      return {
        _id: o._id,
        customerName: o.customerName,
        phone: o.phone,
        totalAmount: o.totalAmount,
        pickupLocation: o.pickupLocation,
        status: o.status,
        items: o.items,
        invoiceUrl,
        invoiceNumber,
        createdAt: o.createdAt,
        paidAt: o.paidAt || null,
        growRef: o.growRef || (gp && gp.asmachta) || raw.asmachta || '',
        cardSuffix: o.cardSuffix || (gp && gp.cardSuffix) || raw.cardSuffix || '',
        cardBrand: o.cardBrand || raw.cardBrand || '',
        paymentMethod: o.paymentMethod || raw.transactionType || ({ '1': 'כרטיס אשראי', '2': 'הוראת קבע', '3': 'זיכוי', '6': 'Bit', '7': 'Apple Pay', '8': 'PayPal', '9': 'Google Pay', '10': 'מזומן', '11': 'העברה בנקאית', '13': 'Google Pay', '14': 'Apple Pay' }[raw.transactionTypeId] || ''),
        payerEmail: o.payerEmail || raw.payerEmail || '',
        payerPhone: raw.payerPhone || o.phone || '',
        webhookData: raw,
      };
    });

    res.json({ payments: enriched, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/payments/my', async (req, res) => {
  try {
    const db = await getDb();
    const phone = (req.query.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const payments = await db.collection('grow_payments')
      .find({ $or: [
        { 'rawBody.payerPhone': { $regex: phone.slice(-9) } },
        { customerPhone: { $regex: phone.slice(-9) } }
      ]})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/orders/my', async (req, res) => {
  try {
    const db = await getDb();
    const phone = (req.query.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const orders = await db.collection('shop_orders')
      .find({ phone, $or: [{ confirmed: true }, { status: 'paid' }, { status: 'confirmed' }, { paymentStatus: 'paid' }] })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const db = await getDb();
    // default: this week (Monday → now)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const defaultMonday = new Date(now);
    defaultMonday.setDate(now.getDate() + mondayOffset);
    defaultMonday.setHours(0, 0, 0, 0);

    const dateField = req.query.dateField === 'paidAt' ? 'paidAt' : 'createdAt';
    const since = req.query.since ? new Date(req.query.since) : defaultMonday;
    const filter = { [dateField]: { $gte: since }, status: { $nin: ['pending_payment', 'cancelled_duplicate', 'merged_into_paid'] } };
    if (req.query.until) filter[dateField].$lte = new Date(req.query.until);
    const orders = await db.collection('shop_orders')
      .find(filter)
      .sort({ [dateField]: -1 })
      .toArray();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/orders/summary', async (req, res) => {
  try {
    const db = await getDb();
    const since = req.query.since
      ? new Date(req.query.since)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const orders = await db.collection('shop_orders')
      .find({ createdAt: { $gte: since }, status: { $nin: ['pending_payment', 'cancelled_duplicate', 'merged_into_paid'] } })
      .toArray();
    // Build summary per product
    const summary = {};
    for (const order of orders) {
      for (const item of (order.items || [])) {
        const key = item.name;
        if (!summary[key]) summary[key] = { name: key, totalQty: 0, totalRevenue: 0, variants: {} };
        summary[key].totalQty += item.qty;
        summary[key].totalRevenue += item.price * item.qty;
        if (item.variant) {
          summary[key].variants[item.variant] = (summary[key].variants[item.variant] || 0) + item.qty;
        }
      }
    }
    res.json(Object.values(summary));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// GET /api/shop/orders/:id
router.get('/orders/summary/products', async (req, res) => {
  try {
    const db = await getDb();
    const filter = {};
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) { const to = new Date(req.query.to); to.setHours(23,59,59,999); filter.createdAt.$lte = to; }
    }
    filter.status = { $ne: 'pending_payment' };
    const orders = await db.collection('shop_orders').find(filter).toArray();
    const summary = {};
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const key = item.variant ? item.name + '|' + item.variant : item.name;
        if (!summary[key]) summary[key] = { name: item.name, variant: item.variant || null, qty: 0, unit: item.unit || '' };
        summary[key].qty += (item.qty || 1);
      });
    });
    const result = Object.values(summary).sort((a,b) => a.name.localeCompare(b.name, 'he'));
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/shop/users/me - current user info (updates lastLogin)
router.get('/users/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'no token' });
    const token = auth.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'buypower-secret-2024';
    const payload = jwt.verify(token, JWT_SECRET);
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    await db.collection('shop_users').updateOne(
      { _id: new ObjectId(payload.userId) },
      { $set: { lastLogin: new Date() } }
    );
    const user = await db.collection('shop_users').findOne({ _id: new ObjectId(payload.userId) }, { projection: { passwordHash: 0 } });
    res.json({ user });
  } catch(e) { res.status(401).json({ error: 'invalid token' }); }
});

// GET /api/shop/users - all users (admin only)
router.get('/orders/:id', async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.collection('shop_orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ error: 'not found' });
    res.json(order);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/orders/:id/status', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('shop_orders').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: req.body.status || 'handled' } }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/orders/:id/confirm', async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.collection('shop_orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    await db.collection('shop_orders').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'paid', meshulam_ref: req.body.meshulam_ref || null } }
    );

    // Decrease stock in shop_products + sync shop_inventory
    for (const item of order.items) {
      const prodId = item.productId || item.id;
      if (!prodId) continue;
      try {
        const prod = await db.collection('shop_products').findOne(
          { _id: new ObjectId(prodId) },
          { projection: { inventoryId: 1, hasUnlimitedStock: 1 } }
        );
        if (!prod || prod.hasUnlimitedStock) continue; // skip unlimited stock items
        await db.collection('shop_products').updateOne(
          { _id: new ObjectId(prodId) },
          { $inc: { stock: -item.qty } }
        );
        if (prod.inventoryId) {
          const invItem = await db.collection('shop_inventory').findOne({ _id: new ObjectId(prod.inventoryId) }, { projection: { hasUnlimitedStock: 1 } });
          if (!invItem || !invItem.hasUnlimitedStock) {
            await db.collection('shop_inventory').updateOne(
              { _id: new ObjectId(prod.inventoryId) },
              { $inc: { quantity: -item.qty } }
            );
          }
        }
      } catch (_) {}
    }

    // Try to notify Yedidya via WhatsApp (best-effort)
    try {
      const axios = require('axios');
      const itemsList = order.items.map(i => `${i.name}${i.variant ? ' ('+i.variant+')' : ''} x${i.qty}`).join(', ');
      const msg = `🛒 הזמנה חדשה שולמה!\nשם: ${order.customerName}\nטלפון: ${order.phone}\nמוצרים: ${itemsList}\nסכום: ₪${order.totalAmount}\nאיסוף: ${order.pickupLocation || order.pickupInfo || ''}`;
      await axios.post('http://localhost:3001/api/send-message', {
        phone: '972538286227',
        message: msg,
      }).catch(() => {});
    } catch (_) {}

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SEED ─────────────────────────────────────────────────────────────────────

router.post('/seed', async (req, res) => {
  try {
    const db = await getDb();

    // Clear existing
    await db.collection('shop_products').deleteMany({});
    await db.collection('shop_announcements').deleteMany({});
    await db.collection('shop_settings').deleteMany({});

    // Products
    await db.collection('shop_products').insertMany([
      {
        name: 'יין אדום ביתי — גפן הגולן',
        description: 'יין אדום עשיר ומלא גוף, יוצר בכרמים מקומיים. בקבוק 750 מ"ל.',
        imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80',
        marketPrice: 89,
        shopPrice: 65,
        stock: 20,
        available_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true,
        vatType: inv.vatType || 'exempt',
        createdAt: new Date(),
      },
      {
        name: 'סל פירות עונתיים',
        description: 'סל מגוון עם פירות טריים מהשדה: תפוחים, אגסים, ענבים ועוד. כ-3 ק"ג.',
        imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&q=80',
        marketPrice: 75,
        shopPrice: 55,
        stock: 15,
        available_until: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
      },
      {
        name: 'ירקות טריים מהחווה',
        description: 'חבילת ירקות טריים: עגבניות, מלפפונים, פלפלים ובצל. כ-2 ק"ג.',
        imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80',
        marketPrice: 45,
        shopPrice: 32,
        stock: 30,
        available_until: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
      },
    ]);

    // Settings
    await db.collection('shop_settings').insertOne({
      pickupLocations: [
        { name: 'פרדס חנה — רחוב הדקל 5', address: 'רחוב הדקל 5, פרדס חנה' },
        { name: 'נשלח לכתובת (עלות משלוח נוספת)', address: '' },
      ],
    });

    // Announcements
    await db.collection('shop_announcements').insertOne({
      text: 'ברוכים הבאים לחנות! הזמנות לשבוע הקרוב פתוחות עד יום חמישי בצהריים 🌿',
      isActive: true,
      createdAt: new Date(),
    });

    res.json({ ok: true, message: 'Seeded successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});





// DELETE /api/shop/orders/:id
// PUT /api/shop/orders/:id — update order items/status
router.put('/orders/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const { items, totalAmount, status } = req.body;
    const update = { updatedAt: new Date() };
    if (items !== undefined) update.items = items;
    if (totalAmount !== undefined) update.totalAmount = totalAmount;
    if (status !== undefined) update.status = status;
    const result = await db.collection('shop_orders').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    res.json({ ok: true, ...result });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const result = await db.collection('shop_orders').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true, deleted: result.deletedCount });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/shop/orders/summary/products
// GET /api/shop/users/activity — user activity stats (VIP/active/inactive)
router.get('/users/activity', async (req, res) => {
  try {
    const db = await getDb();
    const { MongoClient } = require('mongodb');
    const client2 = new MongoClient(MONGODB_URI);
    await client2.connect();
    const db2 = client2.db(process.env.SHOP_DB_NAME || 'shop_prod');
    const users = await db2.collection('shop_users').find({}).toArray();
    await client2.close();

    const now = new Date();
    const d30 = new Date(now - 30*24*60*60*1000);
    const d60 = new Date(now - 60*24*60*60*1000);
    const orders = await db.collection('shop_orders').find({ status: { $ne: 'pending_payment' }, createdAt: { $gte: d60 } }).toArray();

    const phoneToOrders = {};
    orders.forEach(o => {
      const p = (o.phone||'').replace(/\D/g,'');
      if (!phoneToOrders[p]) phoneToOrders[p] = [];
      phoneToOrders[p].push(o);
    });

    const result = users.map(u => {
      const p = (u.phone||'').replace(/\D/g,'');
      const userOrders = phoneToOrders[p] || [];
      const recent30 = userOrders.filter(o => new Date(o.createdAt) >= d30);
      const isVip = recent30.length >= 2;
      const isActive = userOrders.length > 0;
      return { ...u, orderCount: userOrders.length, recent30Count: recent30.length, isVip, isActive, tier: isVip ? 'vip' : isActive ? 'active' : 'inactive' };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/users', async (req, res) => {
  try {
    const { MongoClient } = require('mongodb');
    const client2 = new MongoClient(MONGODB_URI);
    await client2.connect();
    const db2 = client2.db(process.env.SHOP_DB_NAME || 'shop_prod');
    const users = await db2.collection('shop_users').find({}).sort({ createdAt: -1 }).toArray();
    await client2.close();
    res.json(users);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/shop/users/:id - update user fields (name/email/phone/isBlocked)
router.put('/users/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { name, email, phone, isBlocked, pickupPoint, pickupLocation } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (isBlocked !== undefined) update.isBlocked = isBlocked;
    // Pickup fields are write-locked through the validator + always synced as a pair.
    const incomingPickup = pickupPoint !== undefined ? pickupPoint
                          : pickupLocation !== undefined ? pickupLocation
                          : undefined;
    if (incomingPickup !== undefined) {
      try {
        const cleanPickup = await assertValidPickupPoint(db, incomingPickup);
        Object.assign(update, userPickupUpdate(cleanPickup));
      } catch (e) { return res.status(e.code || 400).json({ error: e.msg }); }
    }
    if (req.body.internalNotes !== undefined) update.internalNotes = req.body.internalNotes;
    await db.collection('shop_users').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/shop/users/:id - delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('shop_users').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/shop/users/:id/password - set password
router.put('/users/:id/password', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(req.body.password, 10);
    await db.collection('shop_users').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { passwordHash: hash } });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/users/register
router.post('/users/register', async (req, res) => {
  try {
    const db = await getDb();
    const { name, phone, email, city, idNumber, password } = req.body;
    let bcrypt; try { bcrypt = require('bcryptjs'); } catch(e) { bcrypt = null; }
    const pickupPoint = (req.body.pickupPoint || '').trim();
    const cleanPhone = normalizePhone(phone);
    if (!name || !isValidIsraeliPhone(cleanPhone)) return res.status(400).json({ error: 'פרטים חסרים או טלפון לא תקין' });

    // Validate pickup point is required and must be a valid location
    if (!pickupPoint) return res.status(400).json({ error: 'נא לבחור נקודת איסוף' });
    const shopDb = await getDb();
    const ppDoc = await shopDb.collection('shop_settings').findOne({ key: 'pickupPoints' });
    const validPoints = ppDoc && Array.isArray(ppDoc.points) ? ppDoc.points.map(p => p.name) : [];
    if (validPoints.length && !validPoints.includes(pickupPoint)) {
      return res.status(400).json({ error: 'נקודת האיסוף שנבחרה אינה קיימת' });
    }

    const existingUser = await db.collection('shop_users').findOne({ phone: cleanPhone });
    if (existingUser) return res.status(409).json({ error: 'מספר הטלפון כבר רשום במערכת' });
    let passwordHash = '';
    if (password && bcrypt) passwordHash = await bcrypt.hash(password, 10);
    const user = { name, phone: cleanPhone, email: email||'', city: city||'', idNumber: idNumber||'', pickupPoint, pickupLocation: pickupPoint, passwordHash, createdAt: new Date() };
    const result = await db.collection('shop_users').insertOne(user);
    user._id = result.insertedId;
    const { passwordHash: _ph, ...safeUser } = user;
    // Issue a fresh JWT so the client can call /users/me etc. without dragging
    // a stale token from a previous session (which would resolve to the wrong user on refresh).
    const token = jwt.sign(
      { userId: user._id.toString(), phone: cleanPhone, name, isAdmin: false, isEmployee: false, pickupPoint },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ user: safeUser, token });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/users/login
router.post('/users/login', async (req, res) => {
  try {
    const db = await getDb();
    const cleanPhone = normalizePhone(req.body.phone);
    const password = req.body.password || '';
    const user = await db.collection('shop_users').findOne({ phone: cleanPhone });
    if (!user) return res.json({ user: null, error: 'טלפון לא נמצא' });
    // Always require password
    if (!password) return res.json({ user: null, error: 'נא להזין סיסמה' });
    if (user.passwordHash) {
      const bcrypt = require('bcryptjs');
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.json({ user: null, error: 'סיסמה שגויה' });
    } else {
      // User has no password set — ask them to register again to set one
      return res.json({ user: null, error: 'לא הוגדרה סיסמה — אנא הירשם שוב כדי להגדיר סיסמה' });
    }
    // Track last login
    await db.collection('shop_users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    const { passwordHash, ...safeUser } = user;
    safeUser.lastLogin = new Date();
    const token = jwt.sign({ userId: user._id.toString(), phone: safeUser.phone, name: safeUser.name, isAdmin: safeUser.isAdmin || false, isEmployee: user.isEmployee || user.role === 'employee' || false, pickupPoint: user.pickupPoint || '' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: safeUser, token });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// POST /api/shop/admin/auth — Get admin JWT token using admin password
const ADMIN_PASSWORD = process.env.SHOP_ADMIN_PASSWORD || 'yedidya2024';
router.post('/admin/auth', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'סיסמה שגויה' });
  const token = jwt.sign({ isAdmin: true, name: 'מנהל', role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

// POST /api/shop/users/send-otp
router.post('/users/send-otp', async (req, res) => {
  try {
    const db = await getDb();
    const cleanPhone = normalizePhone(req.body.phone);
    if (!isValidIsraeliPhone(cleanPhone)) return res.status(400).json({ error: 'מספר טלפון לא תקין' });
    const user = await db.collection('shop_users').findOne({ phone: cleanPhone });
    if (!user) return res.json({ error: 'מספר הטלפון לא נמצא — אנא הירשם תחילה' });
    const method = req.body.method || 'sms';
    // If client is asking for available methods, return that info
    if (method === 'query') {
      return res.json({ ok: true, hasEmail: !!(user.email) });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await db.collection('shop_users').updateOne({ phone: cleanPhone }, { $set: { otp: code, otpExpires: new Date(Date.now() + 10*60*1000) } });
    if (method === 'email') {
      if (!user.email) return res.status(400).json({ error: 'לא נמצאה כתובת מייל למשתמש זה' });
      console.log(`[OTP] Phone: ${cleanPhone} Email: ${user.email} Code: ${code}`);
      const nodemailer = require('nodemailer');
      if (process.env.SMTP_HOST) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT||'587'),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: 'קוד הכניסה שלך — נלחמים ביוקר המחיה',
          html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f0fdf4;padding:32px;border-radius:16px">
            <h2 style="color:#15803d;font-size:24px;margin-bottom:16px">נלחמים ביוקר המחיה</h2>
            <p style="font-size:18px;color:#374151;margin-bottom:24px">שלום ${user.name || 'לקוח יקר'},</p>
            <p style="font-size:18px;color:#374151;margin-bottom:16px">קוד האימות שלך לכניסה לחנות:</p>
            <div style="background:white;border-radius:12px;padding:24px;text-align:center;border:2px solid #15803d;margin-bottom:24px">
              <span style="font-size:40px;font-weight:900;letter-spacing:8px;color:#15803d">${code}</span>
            </div>
            <p style="font-size:15px;color:#6b7280">הקוד תקף ל-10 דקות. אל תשתף אותו עם אף אחד.</p>
          </div>`
        });
      } else {
        console.log(`[OTP EMAIL] To: ${user.email} Code: ${code}`);
      }
    } else {
      await sendSMS(cleanPhone, 'קוד האימות שלך: ' + code + ' (תקף ל-10 דקות)');
    }
    res.json({ ok: true });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /api/shop/users/verify-otp
router.post('/users/verify-otp', async (req, res) => {
  try {
    const db = await getDb();
    const cleanPhone = normalizePhone(req.body.phone);
    const otp = (req.body.otp||'').trim();
    const user = await db.collection('shop_users').findOne({ phone: cleanPhone });
    if (!user) return res.json({ error: 'מספר הטלפון לא נמצא' });
    if (user.otp !== otp) return res.json({ error: 'קוד שגוי' });
    if (!user.otpExpires || user.otpExpires < new Date()) return res.json({ error: 'הקוד פג תוקף — בקש קוד חדש' });
    await db.collection('shop_users').updateOne({ _id: user._id }, { $unset: { otp: '', otpExpires: '' }, $set: { lastLogin: new Date() } });
    const { passwordHash, otp: _otp, otpExpires: _exp, ...safeUser } = user;
    safeUser.lastLogin = new Date();
    const token = jwt.sign({ userId: user._id.toString(), phone: safeUser.phone, name: safeUser.name, isAdmin: safeUser.isAdmin || false, isEmployee: user.isEmployee || user.role === 'employee' || false, pickupPoint: user.pickupPoint || '' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: safeUser, token });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /api/shop/users/forgot-password
router.post('/users/forgot-password', async (req, res) => {
  try {
    const db = await getDb();
    const method = req.body.method || 'email'; // 'email' or 'sms'
    const email = (req.body.email||'').trim().toLowerCase();
    const phone = normalizePhone(req.body.phone);

    let user = null;
    if (method === 'sms') {
      if (!isValidIsraeliPhone(phone)) return res.status(400).json({ error: 'נא להזין מספר טלפון תקין' });
      user = await db.collection('shop_users').findOne({ phone });
    } else {
      if (!email) return res.status(400).json({ error: 'נא להזין כתובת מייל' });
      user = await db.collection('shop_users').findOne({ email });
    }

    // Don't reveal if user exists
    if (!user) return res.json({ ok: true });

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60*60*1000); // 1 hour
    await db.collection('shop_users').updateOne({ _id: user._id }, { $set: { resetToken: token, resetExpires: expires } });

    const resetUrl = (process.env.SHOP_URL || 'https://shop.buypower.co.il') + '/reset-password.html?token=' + token;

    if (method === 'sms') {
      // Send SMS via Inforu
      const smsMessage = `איפוס סיסמה - BuyPower\nלחץ על הקישור לאיפוס:\n${resetUrl}\nתקף לשעה אחת.`;
      await sendSMS(phone, smsMessage);
      console.log('[FORGOT PASSWORD] SMS sent to', phone);
    } else {
      // Send email
      const nodemailer = require('nodemailer');
      if (process.env.SMTP_HOST) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT||'587'),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email || email,
          subject: 'איפוס סיסמה — BuyPower',
          html: (() => {
            try {
              const fs = require('fs');
              const tmplPath = require('path').join(__dirname, '../../email-templates/reset-password.html');
              let html = fs.readFileSync(tmplPath, 'utf8');
              html = html.replace(/\{\{name\}\}/g, user.name || 'לקוח יקר');
              html = html.replace(/\{\{resetUrl\}\}/g, resetUrl);
              return html;
            } catch(e) {
              return '<div dir="rtl" style="font-family:Arial"><h2>איפוס סיסמה</h2><p>לחץ: <a href="' + resetUrl + '">' + resetUrl + '</a></p><p>תקף לשעה.</p></div>';
            }
          })()
        });
      } else {
        console.log('PASSWORD RESET URL for', email, ':', resetUrl);
      }
    }
    res.json({ ok: true });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /api/shop/users/reset-password
router.post('/users/reset-password', async (req, res) => {
  try {
    const db = await getDb();
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) return res.status(400).json({ error: 'פרטים לא תקינים' });
    const user = await db.collection('shop_users').findOne({ resetToken: token, resetExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: 'הקישור לא תקף או פג תוקף' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    await db.collection('shop_users').updateOne({ _id: user._id }, { $set: { passwordHash: hash }, $unset: { resetToken: '', resetExpires: '' } });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/payment/create — Create Grow payment link via Make webhook
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || 'https://hook.eu1.make.com/b352vm6lybm0r4w8t5feyv0mekydnve7';
const MAKE_API_KEY = process.env.MAKE_API_KEY || 'n2nEueqeU9tjHh-';

router.post('/payment/create', async (req, res) => {
  try {
    const {
      title, full_name, phone, email,
      invoice_name, invoice_license_number,
      charge_type: raw_charge_type,
      chargeType: raw_chargeType,
      payment_type = 'Payments',
      max_or_custom = 'Max Payments',
      message_text = '',
      products = [],
      cartItems,
      totalAmount: passedTotalAmount,
      pickupLocation: passedPickupLocation,
      success_url: custom_success_url,
      fail_url: custom_fail_url,
      notify_url: custom_notify_url,
      notify_invoice_url: custom_notify_invoice_url,
    } = req.body;

    // Resolve chargeType (numeric) and charge_type (string label) from either input
    // chargeType: 1 = Regular Charge, 2 = Group Charge (tofeset misgerit)
    let chargeTypeNum = parseInt(raw_chargeType) || (raw_charge_type === 'Group Charge' ? 2 : 1);
    const chargeTypeLabel = chargeTypeNum === 2 ? 'Group Charge' : 'Regular Charge';

    if (!title || !full_name || !phone || !products.length) {
      return res.status(400).json({ error: 'חסרים שדות חובה: title, full_name, phone, products' });
    }

    const BASE_URL_PAY = process.env.SHOP_URL || 'https://shop.buypower.co.il';
    const payload = {
      message_text,
      full_name,
      phone,
      email: email || '',
      invoice_name: invoice_name || '',
      invoice_license_number: invoice_license_number || '',
      charge_type: chargeTypeLabel,  // string label for Make
      chargeType: chargeTypeNum,     // numeric (1 or 2) for Make
      title,
      payment_type,
      max_or_custom,
      success_url: custom_success_url || `${BASE_URL_PAY}/success.html`,
      fail_url: custom_fail_url || `${BASE_URL_PAY}/cart.html?error=1`,
      notify_url: custom_notify_url || `${BASE_URL_PAY}/api/shop/payment/webhook`,
      notify_invoice_url: custom_notify_invoice_url || `${BASE_URL_PAY}/api/shop/payment/notify-invoice`,
      products: products.map(p => {
        const qty = Number(p.quantity) || 1;
        const minQty = Number(p.minQuantity ?? p.minimum_quantity) || qty;
        return {
          catalog_number: p.catalog_number || p.id || '0',
          name: p.name,
          price: Number(p.price),
          quantity: qty,
          minQuantity: minQty,
          productUrl: p.productUrl || p.imageUrl || '',
          vatType: 1
        };
      })
    };

    console.log('[PAYMENT CREATE] Payload to Make.com:', JSON.stringify({
      products_count: payload.products.length,
      products: payload.products.map(p => ({name:p.name, price:p.price, qty:p.quantity, vatType:p.vatType})),
      total_calc: payload.products.reduce((s,p)=>s+p.price*p.quantity, 0)
    }, null, 2));
    const https = require('https');
    const body = JSON.stringify(payload);

    const result = await new Promise((resolve, reject) => {
      const url = new URL(MAKE_WEBHOOK_URL);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-make-apikey': MAKE_API_KEY,
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const reqHttp = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try { resolve({ status: resp.statusCode, body: JSON.parse(data) }); }
          catch(e) { resolve({ status: resp.statusCode, body: data }); }
        });
      });
      reqHttp.on('error', reject);
      reqHttp.write(body);
      reqHttp.end();
    });

    if (result.status >= 500) {
      return res.status(502).json({ error: 'שגיאה ביצירת קישור תשלום', details: result.body });
    }

    // Extract payment URL from Grow response
    console.log('[PAYMENT CREATE] Make.com response:', JSON.stringify(result, null, 2));
    const growData = result.body;
    const paymentUrl = growData?.data?.url || null;
    const paymentLinkProcessId = growData?.data?.paymentLinkProcessId || null;

    // Save payment link to existing pending order (don't create a duplicate!)
    const db = await getDb();
    const cleanPhone = normalizePhone(phone);
    // Resolve pickup: explicit body param wins, else lookup from user profile.
    // This guarantees orders created via the Grow flow always carry a pickup so
    // they show up correctly in the Orders/Summary tabs.
    let resolvedPickup = (passedPickupLocation || req.body.pickupPoint || '').trim();
    if (!resolvedPickup) {
      const user = await db.collection('shop_users').findOne({ phone: cleanPhone });
      resolvedPickup = (user?.pickupPoint || user?.pickupLocation || '').trim();
    }
    const existingOrder = await db.collection('shop_orders').findOne(
      { phone: cleanPhone, status: 'pending_payment' },
      { sort: { createdAt: -1 } }
    );
    let orderId;
    if (existingOrder) {
      // Update existing order with payment link info; backfill pickup if it was missing.
      const setFields = { paymentUrl, paymentLinkProcessId, source: 'grow_link', chargeType: chargeTypeLabel };
      if (resolvedPickup && !existingOrder.pickupLocation) setFields.pickupLocation = resolvedPickup;
      await db.collection('shop_orders').updateOne(
        { _id: existingOrder._id },
        { $set: setFields }
      );
      orderId = existingOrder._id;
      console.log('[PAYMENT CREATE] Updated existing order:', orderId, 'pickup:', existingOrder.pickupLocation || resolvedPickup || '(none)');
    } else {
      // No existing order — create one (e.g. admin-created payment links, or cart flow
      // where the prior /api/shop/orders POST failed silently).
      // PREFER cartItems (real cart structure) over `products` — `products` is the Grow
      // payload where names get suffixed with " xN" and quantity is forced to 1.
      let orderItems;
      let orderTotal;
      if (Array.isArray(cartItems) && cartItems.length) {
        orderItems = cartItems.map(i => {
          const pid = i._id || i.id || i.productId || null;
          const item = {
            name: i.name,
            price: Number(i.price) || 0,
            qty: Number(i.qty) || 1,
          };
          if (pid) { item.id = pid; item.productId = pid; }
          if (i.variant) item.variant = i.variant;
          if (i.imageUrl) item.imageUrl = i.imageUrl;
          if (i.unit) item.unit = i.unit;
          return item;
        });
        orderTotal = Number(passedTotalAmount) > 0
          ? Number(passedTotalAmount)
          : orderItems.reduce((s, i) => s + i.price * i.qty, 0);
      } else {
        // Last-resort fallback (legacy admin payment-link flow): use products as-is.
        orderItems = products.map(p => ({ name: p.name, price: Number(p.price), qty: Number(p.quantity) || 1 }));
        orderTotal = products.reduce((s, p) => s + Number(p.price) * (Number(p.quantity) || 1), 0);
      }
      const orderDoc = {
        customerName: full_name,
        phone: cleanPhone,
        email: email || '',
        invoiceName: invoice_name || '',
        items: orderItems,
        totalAmount: orderTotal,
        pickupLocation: resolvedPickup || '',
        status: 'pending_payment',
        source: 'grow_link',
        paymentUrl,
        paymentLinkProcessId,
        chargeType: chargeTypeLabel,
        createdAt: new Date(),
      };
      const inserted = await db.collection('shop_orders').insertOne(orderDoc);
      orderId = inserted.insertedId;
      console.log('[PAYMENT CREATE] New order saved:', orderId,
        'pickup:', resolvedPickup || '(none)',
        '| items source:', Array.isArray(cartItems) && cartItems.length ? 'cartItems' : 'products');
    }

    res.json({
      ok: true,
      paymentUrl,
      paymentLinkProcessId,
      orderId,
      raw: growData
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Legal Document Comments (no auth required — shared review tool) ───────────
router.get('/legal-comments', async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase');
  try {
    await client.connect();
    const db = client.db(process.env.SHOP_DB_NAME || 'shop_prod');
    const comments = await db.collection('legal_comments').find({}).sort({ createdAt: 1 }).toArray();
    res.json(comments);
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

router.post('/legal-comments', async (req, res) => {
  const { sectionId, sectionTitle, name, text, parentId } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'חסר שם או הערה' });
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase');
  try {
    await client.connect();
    const db = client.db(process.env.SHOP_DB_NAME || 'shop_prod');
    const doc = { sectionId: sectionId || 'general', sectionTitle: sectionTitle || '', name, text, createdAt: new Date(), resolved: false };
    if (parentId) doc.parentId = parentId;
    const result = await db.collection('legal_comments').insertOne(doc);
    res.json({ ...doc, _id: result.insertedId });
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

router.delete('/legal-comments/:id', async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase');
  try {
    await client.connect();
    const db = client.db(process.env.SHOP_DB_NAME || 'shop_prod');
    // Delete comment and all its replies
    await db.collection('legal_comments').deleteMany({
      $or: [{ _id: new ObjectId(req.params.id) }, { parentId: req.params.id }]
    });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

router.patch('/legal-comments/:id/resolve', async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase');
  try {
    await client.connect();
    const db = client.db(process.env.SHOP_DB_NAME || 'shop_prod');
    await db.collection('legal_comments').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { resolved: !req.body.resolved, resolvedAt: new Date() } });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});


// ============================================
// PICKUP SMS SYSTEM
// ============================================

// POST /api/shop/admin/send-pickup-sms
router.post('/admin/send-pickup-sms', verifyShopToken, async (req, res) => {
  if (!req.shopUser.isAdmin) return res.status(403).json({ error: 'אין הרשאה' });
  try {
    const db = await getDb();
    const { orderId, weekStart, weekEnd, pickupPoint } = req.body;
    const crypto = require('crypto');
    const https = require('https');

    let query = { status: { $in: ['paid', 'ready'] } };
    if (orderId) {
      query = { _id: new ObjectId(orderId) };
    } else {
      if (weekStart) query.createdAt = { $gte: new Date(weekStart) };
      if (weekEnd) { query.createdAt = query.createdAt || {}; query.createdAt.$lte = new Date(weekEnd); }
      if (pickupPoint) query.pickupLocation = pickupPoint;
    }

    const orders = await db.collection('shop_orders').find(query).toArray();
    const sent = [];
    const failed = [];

    for (const order of orders) {
      try {
        // Generate pickupToken
        const pickupToken = crypto.randomBytes(32).toString('hex');
        await db.collection('shop_orders').updateOne(
          { _id: order._id },
          { $set: { pickupToken, pickupTokenSentAt: new Date() } }
        );

        let customerPhone = order.customerPhone || order.phone || '';
        let customerName = order.customerName || order.name || 'לקוח יקר';

        // Try to get from shop_users
        if (order.userId) {
          try {
            const customer = await db.collection('shop_users').findOne({ _id: new ObjectId(order.userId) });
            if (customer) {
              if (customer.phone) customerPhone = customer.phone;
              if (customer.name) customerName = customer.name;
            }
          } catch(e) {}
        }

        if (!customerPhone) { failed.push({ orderId: order._id, reason: 'אין טלפון' }); continue; }

        const pickupUrl = `https://shop.buypower.co.il/pickup/${pickupToken}`;
        const msg = `שלום ${customerName}, ההזמנה שלך מוכנה לאיסוף! לצפייה ואישור: ${pickupUrl}`;

        const inforuUser = process.env.INFORU_USER;
        const inforuPassword = process.env.INFORU_PASSWORD;
        const inforuSender = process.env.INFORU_SENDER || 'BuyPower';

        if (!inforuUser || !inforuPassword) {
          console.log(`[PICKUP SMS] Phone: ${customerPhone} | Token: ${pickupToken} | Msg: ${msg}`);
          sent.push(order._id);
          continue;
        }

        const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
        const xml = `<Inforu><User><Username>${inforuUser}</Username><ApiToken>${inforuPassword}</ApiToken></User><Content Type="sms"><Message>${msg}</Message></Content><Recipients><PhoneNumber>${cleanPhone}</PhoneNumber></Recipients></Inforu>`;
        const url = `https://api.inforu.co.il/SendMessageXml.ashx?InforuXML=${encodeURIComponent(xml)}`;

        await new Promise((resolve, reject) => {
          https.get(url, (r) => { resolve(r); }).on('error', reject);
        });
        sent.push(order._id);
      } catch(e) {
        console.error('SMS failed for order', order._id, e.message);
        failed.push({ orderId: order._id, reason: e.message });
      }
    }

    res.json({ ok: true, sent: sent.length, failed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/shop/pickup/:token — ציבורי
router.get('/pickup/:token', async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.collection('shop_orders').findOne({ pickupToken: req.params.token });
    if (!order) return res.status(404).json({ error: 'קישור לא תקין או שפג תוקפו' });
    const { _id, customerName, items, cart, pickupLocation, totalAmount, pickedUp, pickedUpItems, pickedUpAt } = order;
    res.json({ order: { _id, customerName, items: items || cart || [], pickupLocation, totalAmount, pickedUp: !!pickedUp, pickedUpItems: pickedUpItems || [], pickedUpAt } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/pickup/:token/confirm — ציבורי
router.post('/pickup/:token/confirm', async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.collection('shop_orders').findOne({ pickupToken: req.params.token });
    if (!order) return res.status(404).json({ error: 'קישור לא תקין' });
    const { pickedUpItems } = req.body;
    await db.collection('shop_orders').updateOne(
      { pickupToken: req.params.token },
      { $set: { pickedUp: true, pickedUpItems: pickedUpItems || [], pickedUpAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// SMS PICKUP SYSTEM
// ============================================

// POST /api/shop/admin/send-pickup-sms
router.post('/admin/send-pickup-sms', verifyShopToken, async (req, res) => {
  try {
    const db = await getDb();
    const { orderId, weekStart, weekEnd, pickupPoint } = req.body;
    const crypto = require('crypto');
    const https = require('https');

    let query = { status: { $in: ['paid', 'ready', 'confirmed', 'handled'] } };
    if (orderId) {
      query = { _id: new ObjectId(orderId) };
    } else {
      if (weekStart) query.createdAt = { $gte: new Date(weekStart) };
      if (weekEnd) { query.createdAt = query.createdAt || {}; query.createdAt.$lte = new Date(weekEnd); }
      if (pickupPoint) query.pickupLocation = pickupPoint;
    }

    const orders = await db.collection('shop_orders').find(query).toArray();
    const sent = [];
    const failed = [];

    for (const order of orders) {
      try {
        const pickupToken = crypto.randomBytes(32).toString('hex');
        await db.collection('shop_orders').updateOne(
          { _id: order._id },
          { $set: { pickupToken, pickupTokenSentAt: new Date() } }
        );

        let customerPhone = order.phone || order.customerPhone || '';
        let customerName = order.customerName || order.name || 'לקוח יקר';

        if (order.userId) {
          try {
            const customer = await db.collection('shop_users').findOne({ _id: new ObjectId(order.userId) });
            if (customer) {
              if (customer.phone) customerPhone = customer.phone;
              if (customer.name) customerName = customer.name;
            }
          } catch(e) {}
        }

        if (!customerPhone) { failed.push({ orderId: order._id, reason: 'אין טלפון' }); continue; }

        const pickupUrl = `https://shop.buypower.co.il/pickup/${pickupToken}`;
        const msg = `שלום ${customerName}, ההזמנה שלך מוכנה לאיסוף! לצפייה ואישור: ${pickupUrl}`;

        const inforuUser = process.env.INFORU_USER;
        const inforuPassword = process.env.INFORU_PASSWORD;
        const inforuSender = process.env.INFORU_SENDER || 'BuyPower';

        if (!inforuUser || !inforuPassword) {
          console.log(`[PICKUP SMS] Phone: ${customerPhone} | Token: ${pickupToken}`);
          sent.push(order._id);
          continue;
        }

        const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
        const xml = `<Inforu><User><Username>${inforuUser}</Username><ApiToken>${inforuPassword}</ApiToken></User><Content Type=sms><Message>${msg}</Message></Content><Recipients><PhoneNumber>${cleanPhone}</PhoneNumber></Recipients></Inforu>`;
        const url = `https://api.inforu.co.il/SendMessageXml.ashx?InforuXML=${encodeURIComponent(xml)}`;

        await new Promise((resolve, reject) => {
          https.get(url, (r) => { resolve(r); }).on('error', reject);
        });
        sent.push(order._id);
      } catch(e) {
        failed.push({ orderId: order._id, reason: e.message });
      }
    }

    res.json({ ok: true, sent: sent.length, failed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/shop/pickup/:token — ציבורי
router.get('/pickup/:token', async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.collection('shop_orders').findOne({ pickupToken: req.params.token });
    if (!order) return res.status(404).json({ error: 'קישור לא תקין' });
    const { _id, customerName, items, cart, pickupLocation, totalAmount, pickedUp, pickedUpItems, pickedUpAt } = order;
    res.json({ order: { _id, customerName, items: items || cart || [], pickupLocation, totalAmount, pickedUp: !!pickedUp, pickedUpItems: pickedUpItems || [], pickedUpAt } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/pickup/:token/confirm — ציבורי
router.post('/pickup/:token/confirm', async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.collection('shop_orders').findOne({ pickupToken: req.params.token });
    if (!order) return res.status(404).json({ error: 'קישור לא תקין' });
    const { pickedUpItems } = req.body;
    await db.collection('shop_orders').updateOne(
      { pickupToken: req.params.token },
      { $set: { pickedUp: true, pickedUpItems: pickedUpItems || [], pickedUpAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// INVENTORY MANAGEMENT
// ============================================

// GET /api/shop/inventory — list all inventory items
router.get('/inventory', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  try {
    const db = await getDb();
    const { category, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: 'i' };
    const items = await db.collection('shop_inventory').find(filter).sort({ name: 1 }).toArray();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/inventory — add item
router.post('/inventory', async (req, res) => {
  try {
    const db = await getDb();
    const { name, quantity, purchasePrice, sellingPrice, unit, category, imageUrl, supplier, lowStockAlert, expiryDate, serialNumber, notes, pickupPoints, vatType, isUnlimited, isFeatured, quantityDeals, sortOrder, marketPrice } = req.body;
    console.log('[inventory POST]', new Date().toISOString(), 'name:', name, 'buy:', purchasePrice, 'sell:', sellingPrice, 'pickup:', pickupPoints);
    if (!name || quantity == null) return res.status(400).json({ error: 'שם וכמות הם שדות חובה' });

    // Prevent duplicates — if item with same name exists, update it instead
    const existing = await db.collection('shop_inventory').findOne({ name });
    if (existing) {
      const update = {
        quantity: parseInt(quantity), purchasePrice: parseFloat(purchasePrice)||0,
        sellingPrice: parseFloat(sellingPrice)||0, unit: unit||existing.unit||'יח\'',
        category: category||existing.category||'כללי', imageUrl: imageUrl||existing.imageUrl||'',
        supplier: supplier||existing.supplier||'',
        pickupPoints: pickupPoints || existing.pickupPoints || [],
        vatType: vatType || existing.vatType || 'exempt',
        updatedAt: new Date()
      };
      await db.collection('shop_inventory').updateOne({ _id: existing._id }, { $set: update });
      return res.json({ ...existing, ...update, _id: existing._id });
    }

    const item = {
      name, quantity: parseInt(quantity), purchasePrice: parseFloat(purchasePrice)||0,
      sellingPrice: parseFloat(sellingPrice)||0, unit: unit||'יח\'',
      category: category||'כללי', imageUrl: imageUrl||'', supplier: supplier||'',
      lowStockAlert: parseInt(lowStockAlert)||5, expiryDate: expiryDate||null,
      serialNumber: serialNumber||'', notes: notes||'',
      pickupPoints: pickupPoints || [],
      vatType: vatType || 'exempt',
      isUnlimited: isUnlimited || false,
      isFeatured: isFeatured || false,
      quantityDeals: quantityDeals || [],
      sortOrder: sortOrder || 0,
      marketPrice: parseFloat(marketPrice)||0,
      createdAt: new Date(), updatedAt: new Date()
    };
    const result = await db.collection('shop_inventory').insertOne(item);
    res.json({ ...item, _id: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/shop/inventory/:id — update item
router.put('/inventory/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    if (update.quantity != null) update.quantity = parseInt(update.quantity);
    if (update.purchasePrice != null) update.purchasePrice = parseFloat(update.purchasePrice);
    if (update.sellingPrice != null) update.sellingPrice = parseFloat(update.sellingPrice);
    await db.collection('shop_inventory').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });

    // NOTE: No auto-sync here — frontend (syncToShop) handles all shop product updates
    // Having both caused duplicate products on every save

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/shop/inventory/:id
router.delete('/inventory/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    await db.collection('shop_inventory').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/shop/inventory/categories — list distinct categories (merged with defaults)
router.get('/inventory/categories', async (req, res) => {
  try {
    const db = await getDb();
    const [inventoryCats, settings] = await Promise.all([
      db.collection('shop_inventory').distinct('category'),
      db.collection('shop_settings').findOne({ key: 'inventoryCategories' })
    ]);
    const defaultCats = (settings && settings.categories) || [];
    const all = [...new Set([...defaultCats, ...inventoryCats.filter(Boolean)])];
    res.json(all.sort((a,b) => {
      const di = defaultCats.indexOf(a), dj = defaultCats.indexOf(b);
      if (di >= 0 && dj >= 0) return di - dj;
      if (di >= 0) return -1;
      if (dj >= 0) return 1;
      return a.localeCompare(b, 'he');
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/inventory/:id/adjust — adjust quantity (+ or -)
router.post('/inventory/:id/adjust', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const { delta, reason } = req.body;
    const result = await db.collection('shop_inventory').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $inc: { quantity: parseInt(delta) }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    res.json({ ok: true, newQuantity: result.quantity });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/inventory/:id/activate — create/activate shop product from inventory item
router.post('/inventory/:id/activate', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const inv = await db.collection('shop_inventory').findOne({ _id: new ObjectId(req.params.id) });
    if (!inv) return res.status(404).json({ error: 'not found' });

    let productId = inv.shopProductId;
    const deadline = new Date(); deadline.setDate(deadline.getDate() + 30);

    if (productId) {
      // Existing product — just activate it
      await db.collection('shop_products').updateOne(
        { _id: new ObjectId(productId) },
        { $set: { isActive: true, shopPrice: inv.sellingPrice || inv.shopPrice || 0, stock: inv.quantity || 0, updatedAt: new Date() } }
      );
    } else {
      // Create new product from inventory data
      const newProd = {
        name: inv.name,
        description: inv.description || '',
        shopPrice: inv.sellingPrice || 0,
        originalPrice: inv.originalPrice || null,
        unit: inv.unit || '',
        category: inv.category || 'כללי',
        imageUrl: inv.imageUrl || '',
        minQuantity: inv.minQuantity || 1,
        maxQuantity: inv.maxQuantity || 99,
        stock: inv.quantity || 0,
        available_until: deadline,
        isActive: true,
        isFeatured: false,
        inventoryId: inv._id.toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const inserted = await db.collection('shop_products').insertOne(newProd);
      productId = inserted.insertedId.toString();
      // Save link back to inventory
      await db.collection('shop_inventory').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { shopProductId: productId, isActive: true } }
      );
    }

    await db.collection('shop_inventory').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isActive: true, shopProductId: productId } }
    );

    res.json({ ok: true, productId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/inventory/:id/deactivate — deactivate shop product
router.post('/inventory/:id/deactivate', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const inv = await db.collection('shop_inventory').findOne({ _id: new ObjectId(req.params.id) });
    if (!inv) return res.status(404).json({ error: 'not found' });

    if (inv.shopProductId) {
      await db.collection('shop_products').updateOne(
        { _id: new ObjectId(inv.shopProductId) },
        { $set: { isActive: false, updatedAt: new Date() } }
      );
    }
    await db.collection('shop_inventory').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isActive: false } }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== EXPENSES =====
// GET /api/shop/expenses
router.get('/expenses', async (req, res) => {
  try {
    const db = await getDb();
    const { from, to, type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to + 'T23:59:59');
    }
    const items = await db.collection('shop_expenses').find(filter).sort({ date: -1 }).toArray();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/expenses
router.post('/expenses', async (req, res) => {
  try {
    const db = await getDb();
    const doc = { ...req.body, amount: parseFloat(req.body.amount) || 0, date: req.body.date ? new Date(req.body.date) : new Date(), createdAt: new Date() };
    const r = await db.collection('shop_expenses').insertOne(doc);
    res.json({ ok: true, id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/shop/expenses/:id
router.put('/expenses/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const update = { ...req.body, amount: parseFloat(req.body.amount) || 0, updatedAt: new Date() };
    delete update._id;
    await db.collection('shop_expenses').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/shop/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    await db.collection('shop_expenses').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/orders/mark-ready — mark all paid orders as ready for pickup
router.post('/orders/mark-ready', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection('shop_orders').updateMany(
      { status: { $in: ['paid', 'handled', 'confirmed'] } },
      { $set: { status: 'ready', readyAt: new Date() } }
    );
    res.json({ ok: true, updated: result.modifiedCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/orders/close-week — archive all orders, mark week as closed
router.post('/orders/close-week', async (req, res) => {
  try {
    const db = await getDb();
    const weekLabel = req.body.weekLabel || new Date().toLocaleDateString('he-IL');
    // Archive: add weekClosed label + set status to collected for ready orders
    await db.collection('shop_orders').updateMany(
      { status: { $in: ['ready', 'paid', 'handled', 'confirmed'] } },
      { $set: { status: 'collected', weekClosed: weekLabel, closedAt: new Date() } }
    );
    // Log the week close
    await db.collection('shop_settings').updateOne(
      { key: 'lastWeekClose' },
      { $set: { key: 'lastWeekClose', closedAt: new Date(), weekLabel } },
      { upsert: true }
    );
    res.json({ ok: true, weekLabel });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// BROADCAST WHATSAPP
// ============================================

router.post('/broadcast-whatsapp', async (req, res) => {
  try {
    const db = await getDb();
    const { message, weekOnly } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    let phones = [];

    if (weekOnly) {
      const now = new Date();
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const orders = await db.collection('shop_orders').find({
        status: { $in: ['paid', 'confirmed', 'ready'] },
        createdAt: { $gte: monday }
      }).toArray();

      const phoneSet = new Set();
      for (const o of orders) {
        const p = o.phone || o.customerPhone;
        if (p) phoneSet.add(p.replace(/\D/g, '').replace(/^0/, '972'));
      }
      phones = Array.from(phoneSet);
    }

    if (!phones.length) {
      return res.json({ ok: true, sent: 0, message: 'אין לקוחות לשליחה' });
    }

    const axios = require('axios');
    let sent = 0;
    const errors = [];

    for (const phone of phones) {
      try {
        await axios.post('http://localhost:3001/api/send-message', { phone, message });
        sent++;
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        errors.push(phone);
      }
    }

    res.json({ ok: true, sent, total: phones.length, errors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// PICKUP TRACKING
// ============================================

// GET /api/shop/admin/pickup-tracking
router.get('/admin/pickup-tracking', verifyShopToken, async (req, res) => {
  try {
    const db = await getDb();
    // Determine week start (default: Monday of current week)
    let weekStart;
    if (req.query.weekStart) {
      weekStart = new Date(req.query.weekStart);
    } else {
      weekStart = new Date();
      const day = weekStart.getDay();
      const diff = (day === 0) ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
    }
    weekStart.setHours(0, 0, 0, 0);
    let weekEnd;
    if (req.query.weekEnd) {
      weekEnd = new Date(req.query.weekEnd);
    } else {
      weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const query = {
      createdAt: { $gte: weekStart, $lte: weekEnd },
      status: { $in: ['paid', 'confirmed', 'handled', 'collected', 'ready'] }
    };
    if (req.query.pickupPoint) {
      query.pickupLocation = req.query.pickupPoint;
    }

    const orders = await db.collection('shop_orders').find(query).sort({ createdAt: -1 }).toArray();

    // Enrich with customer data
    const userIds = [...new Set(orders.map(o => o.userId).filter(Boolean))];
    let userMap = {};
    if (userIds.length > 0) {
      const objectIds = userIds.map(id => { try { return new ObjectId(id); } catch(e) { return null; } }).filter(Boolean);
      const users = await db.collection('shop_users').find({ _id: { $in: objectIds } }).toArray();
      users.forEach(u => { userMap[u._id.toString()] = u; });
    }

    const enrichedOrders = orders.map(o => {
      const customer = o.userId ? userMap[o.userId.toString()] : null;
      return {
        ...o,
        pickedUp: o.pickedUp || false,
        customerName: customer ? customer.name : (o.customerName || o.name || 'לא ידוע'),
        customerPhone: customer ? customer.phone : (o.phone || o.customerPhone || ''),
        customerEmail: customer ? customer.email : (o.email || o.customerEmail || ''),
      };
    });

    // Stats
    const totalOrders = enrichedOrders.length;
    const pickedUpCount = enrichedOrders.filter(o => o.pickedUp).length;

    // Product summary
    const productMap = {};
    for (const order of enrichedOrders) {
      const items = order.items || order.cart || [];
      for (const item of items) {
        const key = `${item.productId || item._id}_${item.variant || ''}`;
        if (!productMap[key]) {
          productMap[key] = {
            productId: item.productId || item._id,
            name: item.name || item.productName || '',
            variant: item.variant || '',
            totalOrdered: 0,
            totalPickedUp: 0,
          };
        }
        productMap[key].totalOrdered += (item.quantity || item.qty || 1);
        if (order.pickedUp) {
          productMap[key].totalPickedUp += (item.quantity || item.qty || 1);
        }
      }
    }
    const productSummary = Object.values(productMap);

    res.json({ orders: enrichedOrders, stats: { totalOrders, pickedUpCount, productSummary } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/admin/pickup-tracking/:orderId/mark
router.post('/admin/pickup-tracking/:orderId/mark', verifyShopToken, async (req, res) => {
  try {
    const db = await getDb();
    const { pickedUp, markedBy } = req.body;
    const update = { pickedUp: !!pickedUp, pickedUpBy: markedBy || req.shopUser.name || '' };
    if (pickedUp) {
      update.pickedUpAt = new Date();
    } else {
      update.pickedUpAt = null;
    }
    await db.collection('shop_orders').updateOne(
      { _id: new ObjectId(req.params.orderId) },
      { $set: update }
    );
    const order = await db.collection('shop_orders').findOne({ _id: new ObjectId(req.params.orderId) });
    res.json(order);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/admin/pickup-tracking/:orderId/send-email
router.post('/admin/pickup-tracking/:orderId/send-email', verifyShopToken, async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.collection('shop_orders').findOne({ _id: new ObjectId(req.params.orderId) });
    if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

    let customerEmail = order.customerEmail || order.email || '';
    if (!customerEmail) {
      // Try lookup by userId
      if (order.userId) {
        try {
          const customer = await db.collection('shop_users').findOne({ _id: new ObjectId(order.userId) });
          if (customer && customer.email) customerEmail = customer.email;
        } catch(e) {}
      }
      // Try lookup by phone
      if (!customerEmail && order.phone) {
        try {
          const customer = await db.collection('shop_users').findOne({ phone: order.phone });
          if (customer && customer.email) customerEmail = customer.email;
        } catch(e) {}
      }
    }
    if (!customerEmail) return res.status(400).json({ error: 'אין כתובת מייל רשומה ללקוח זה' });

    const customerName = order.customerName || order.name || 'לקוח יקר';
    const items = order.items || order.cart || [];
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${item.name || item.productName || ''}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${item.variant || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity || item.qty || 1}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left">₪${((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}</td>
      </tr>`).join('');
    const totalPrice = order.totalPrice || order.total || items.reduce((s, i) => s + (i.price || 0) * (i.quantity || i.qty || 1), 0);

    const nodemailer = require('nodemailer');
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: customerEmail,
        subject: 'פרטי הזמנתך — נלחמים ביוקר המחיה',
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f0fdf4;padding:32px;border-radius:16px">
          <h2 style="color:#15803d;font-size:22px;margin-bottom:8px">נלחמים ביוקר המחיה 🌿</h2>
          <p style="font-size:17px;color:#374151;margin-bottom:16px">שלום ${customerName},</p>
          <p style="font-size:16px;color:#374151;margin-bottom:20px">להלן פרטי ההזמנה שלך:</p>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;margin-bottom:20px">
            <thead>
              <tr style="background:#15803d;color:white">
                <th style="padding:10px;text-align:right">מוצר</th>
                <th style="padding:10px;text-align:center">וריאנט</th>
                <th style="padding:10px;text-align:center">כמות</th>
                <th style="padding:10px;text-align:left">מחיר</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="text-align:left;font-size:18px;font-weight:700;color:#15803d;margin-bottom:20px">סה"כ: ₪${parseFloat(totalPrice).toFixed(2)}</div>
          <p style="font-size:14px;color:#6b7280">אנא הגיעו לנקודת האיסוף לאסוף את ההזמנה שלכם. תודה!</p>
        </div>`
      });
    } else {
      console.log(`[PICKUP EMAIL] To: ${customerEmail} Order: ${order._id}`);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/admin/pickup-tracking/:orderId/send-sms
router.post('/admin/pickup-tracking/:orderId/send-sms', verifyShopToken, async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.collection('shop_orders').findOne({ _id: new ObjectId(req.params.orderId) });
    if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

    let customerPhone = order.customerPhone || order.phone || '';
    let customerName = order.customerName || order.name || '';
    if (order.userId) {
      try {
        const customer = await db.collection('shop_users').findOne({ _id: new ObjectId(order.userId) });
        if (customer) {
          if (customer.phone) customerPhone = customer.phone;
          if (customer.name) customerName = customer.name;
        }
      } catch(e) {}
    }
    if (!customerPhone) return res.status(400).json({ error: 'אין מספר טלפון ללקוח' });

    const msg = `שלום ${customerName}, תזכורת לאיסוף הזמנתך. הגיעו לנקודת האיסוף לאסוף את ההזמנה שלכם. תודה!`;
    await sendSMS(customerPhone, msg);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// EMPLOYEE (STAFF) MANAGEMENT
// ============================================

// GET /api/shop/admin/staff
router.get('/admin/staff', verifyShopToken, async (req, res) => {
  if (!req.shopUser.isAdmin) return res.status(403).json({ error: 'אין הרשאה' });
  try {
    const db = await getDb();
    const staff = await db.collection('shop_staff').find({}).sort({ createdAt: -1 }).toArray();
    res.json(staff);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/admin/staff
router.post('/admin/staff', verifyShopToken, async (req, res) => {
  if (!req.shopUser.isAdmin) return res.status(403).json({ error: 'אין הרשאה' });
  try {
    const db = await getDb();
    const bcrypt = require('bcryptjs');
    const { name, phone, email, notes, pickupPoint } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'שם וטלפון הם שדות חובה' });
    // Pickup point is mandatory for staff (defines which point's data they manage)
    let cleanPickup;
    try { cleanPickup = await assertValidPickupPoint(db, pickupPoint); }
    catch (e) { return res.status(e.code || 400).json({ error: 'חובה לבחור נקודת איסוף לעובד מתוך הרשימה' }); }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    // Generate 4-digit temp password
    const tempPassword = Math.floor(1000 + Math.random() * 9000).toString();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const employeeDoc = {
      name,
      phone: cleanPhone,
      email: email || '',
      notes: notes || '',
      pickupPoint: cleanPickup,
      passwordHash,
      role: 'employee',
      isActive: true,
      hourLogs: [],
      createdAt: new Date(),
    };
    const result = await db.collection('shop_staff').insertOne(employeeDoc);
    employeeDoc._id = result.insertedId;

    // Also insert into shop_users so they can log in
    const existingUser = await db.collection('shop_users').findOne({ phone: cleanPhone });
    if (!existingUser) {
      await db.collection('shop_users').insertOne({
        name,
        phone: cleanPhone,
        email: email || '',
        passwordHash,
        role: 'employee',
        isEmployee: true,
        isAdmin: false,
        isActive: true,
        ...userPickupUpdate(cleanPickup),
        createdAt: new Date(),
      });
    } else {
      await db.collection('shop_users').updateOne(
        { phone: cleanPhone },
        { $set: { role: 'employee', isEmployee: true, passwordHash, ...userPickupUpdate(cleanPickup) } }
      );
    }

    const { passwordHash: _ph, ...safeEmployee } = employeeDoc;
    res.json({ employee: safeEmployee, tempPassword });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/shop/admin/staff/:id
router.put('/admin/staff/:id', verifyShopToken, async (req, res) => {
  if (!req.shopUser.isAdmin) return res.status(403).json({ error: 'אין הרשאה' });
  try {
    const db = await getDb();
    const { name, phone, email, notes, isActive, pickupPoint } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone.replace(/[^0-9]/g, '');
    if (email !== undefined) update.email = email;
    if (notes !== undefined) update.notes = notes;
    if (isActive !== undefined) update.isActive = isActive;
    if (pickupPoint !== undefined) update.pickupPoint = pickupPoint;
    await db.collection('shop_staff').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    // Also update shop_users
    const updated = await db.collection('shop_staff').findOne({ _id: new ObjectId(req.params.id) });
    if (updated && updated.phone) {
      const userUpdate = {};
      if (name !== undefined) userUpdate.name = name;
      if (pickupPoint !== undefined) userUpdate.pickupPoint = pickupPoint;
      if (Object.keys(userUpdate).length) {
        await db.collection('shop_users').updateOne({ phone: updated.phone }, { $set: userUpdate });
      }
    }
    const { passwordHash: _ph, ...safe } = updated;
    res.json(safe);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/shop/admin/staff/:id
router.delete('/admin/staff/:id', verifyShopToken, async (req, res) => {
  if (!req.shopUser.isAdmin) return res.status(403).json({ error: 'אין הרשאה' });
  try {
    const db = await getDb();
    const staff = await db.collection('shop_staff').findOne({ _id: new ObjectId(req.params.id) });
    if (!staff) return res.status(404).json({ error: 'עובד לא נמצא' });
    await db.collection('shop_staff').deleteOne({ _id: new ObjectId(req.params.id) });
    // Remove from shop_users as well
    if (staff.phone) {
      await db.collection('shop_users').deleteOne({ phone: staff.phone, role: 'employee' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/admin/staff/:id/hours
router.post('/admin/staff/:id/hours', verifyShopToken, async (req, res) => {
  if (!req.shopUser.isAdmin) return res.status(403).json({ error: 'אין הרשאה' });
  try {
    const db = await getDb();
    const { date, hours, notes } = req.body;
    if (!date || hours === undefined) return res.status(400).json({ error: 'תאריך ושעות הם שדות חובה' });
    const logEntry = { date: new Date(date), hours: parseFloat(hours), notes: notes || '', addedAt: new Date() };
    await db.collection('shop_staff').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $push: { hourLogs: logEntry } }
    );
    res.json({ ok: true, logEntry });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/shop/admin/staff/:id/report
router.get('/admin/staff/:id/report', verifyShopToken, async (req, res) => {
  if (!req.shopUser.isAdmin) return res.status(403).json({ error: 'אין הרשאה' });
  try {
    const db = await getDb();
    const staff = await db.collection('shop_staff').findOne({ _id: new ObjectId(req.params.id) });
    if (!staff) return res.status(404).json({ error: 'עובד לא נמצא' });
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const filteredLogs = (staff.hourLogs || []).filter(log => {
      const d = new Date(log.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
    const totalHours = filteredLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
    const { passwordHash: _ph, ...safeStaff } = staff;
    res.json({ staff: safeStaff, hourLogs: filteredLogs, totalHours, month, year });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GROW PAYMENT WEBHOOK ────────────────────────────────────────────────────
// POST /api/shop/payment/webhook — Grow/Make.com calls this after successful payment
// This is the ONLY place where orders get marked as paid
router.post('/payment/webhook', async (req, res) => {
  try {
    const db = await getDb();
    console.log('[GROW WEBHOOK] received:', JSON.stringify(req.body));

    // Grow sends data nested in req.body.data
    const raw = req.body.data || req.body;
    const { orderId, order_id, status, amount, reference, phone, full_name, fullName, name,
            asmachta, cardSuffix, cardBrand, cardType, transactionType, transactionTypeId, payerPhone, payerEmail,
            paymentSum, sum, paymentDesc, description, webhookKey, transactionCode, transactionId,
            invoiceURL, invoiceName, processId, paymentLinkProcessId, productData } = raw;

    const id = orderId || order_id || null;
    const ref = asmachta || reference || transactionId || transactionCode || null;
    const paidAmount = sum || amount || paymentSum || null;
    const customerPhone = payerPhone || phone || '';
    const customerName = fullName || full_name || name || '';

    // Save raw payment data to grow_payments
    await db.collection('grow_payments').insertOne({
      source: 'grow',
      orderId: id,
      asmachta: asmachta || ref,
      cardSuffix: cardSuffix || '',
      cardBrand: cardBrand || '',
      cardType: cardType || '',
      status: 'paid',
      totalAmount: paidAmount ? Number(paidAmount) : 0,
      customerName,
      customerPhone,
      customerEmail: payerEmail || '',
      rawBody: req.body,
      createdAt: new Date()
    });

    // Find and update the order
    let order = null;
    const updateData = {
      status: 'paid',
      paidAt: new Date(),
      growRef: ref,
      paidAmount: paidAmount ? Number(paidAmount) : null,
      cardSuffix: cardSuffix || '',
      cardBrand: cardBrand || '',
      paymentMethod: transactionType || '',
      payerEmail: payerEmail || '',
      invoiceUrl: invoiceURL || '',
      invoiceName: invoiceName || ''
    };

    // Try by orderId first
    if (id) {
      try {
        order = await db.collection('shop_orders').findOne({ _id: new ObjectId(id), status: { $ne: 'paid' } });
        if (order) {
          await db.collection('shop_orders').updateOne({ _id: order._id }, { $set: updateData });
          console.log('[GROW WEBHOOK] updated by id:', id);
        }
      } catch(e) {
        console.log('[GROW WEBHOOK] invalid orderId:', id);
      }
    }

    // Try by paymentLinkProcessId — deterministic 1:1 mapping set when the Grow link was created.
    // Prevents mis-matches when a phantom pending_payment order exists for the same phone.
    if (!order && paymentLinkProcessId) {
      order = await db.collection('shop_orders').findOne({
        paymentLinkProcessId: Number(paymentLinkProcessId),
        status: { $ne: 'paid' }
      });
      if (order) {
        await db.collection('shop_orders').updateOne({ _id: order._id }, { $set: updateData });
        console.log('[GROW WEBHOOK] updated by paymentLinkProcessId:', paymentLinkProcessId);
      }
    }

    // Try by phone if still no match. Prefer an order whose total matches the paid amount
    // and has real items — fall back to newest only if nothing better matches.
    if (!order && customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '').replace(/^972/, '0');
      // Skip if another order with same asmachta already marked paid (prevent double-submit duplicates)
      if (ref) {
        const alreadyPaid = await db.collection('shop_orders').findOne({ growRef: ref, status: { $in: ['paid', 'handled', 'confirmed'] } });
        if (alreadyPaid) {
          console.log('[GROW WEBHOOK] skipping duplicate — asmachta already used:', ref);
          return res.json({ ok: true, duplicate: true });
        }
      }
      const candidates = await db.collection('shop_orders').find(
        { phone: cleanPhone, status: 'pending_payment' }
      ).sort({ createdAt: -1 }).toArray();
      if (candidates.length) {
        const paidNum = paidAmount ? Number(paidAmount) : null;
        const amountMatch = paidNum
          ? candidates.find(c => (c.items || []).length > 0 && Math.abs((c.totalAmount || 0) - paidNum) < 0.5)
          : null;
        const itemsMatch = candidates.find(c => (c.items || []).length > 0 && (c.totalAmount || 0) > 0);
        order = amountMatch || itemsMatch || candidates[0];
        await db.collection('shop_orders').updateOne({ _id: order._id }, { $set: updateData });
        console.log('[GROW WEBHOOK] updated by phone:', cleanPhone, '→', order._id.toString(),
          amountMatch ? '(amount-match)' : itemsMatch ? '(items-match)' : '(newest)');
      }
    }

    // Cancel other pending orders for the same phone (prevents double-submit duplicates)
    if (order && order.phone) {
      const cancelled = await db.collection('shop_orders').updateMany(
        { phone: order.phone, status: 'pending_payment', _id: { $ne: order._id } },
        { $set: { status: 'cancelled_duplicate', cancelledAt: new Date() } }
      );
      if (cancelled.modifiedCount > 0) {
        console.log('[GROW WEBHOOK] cancelled', cancelled.modifiedCount, 'duplicate pending orders for', order.phone);
      }

      // SAFETY NET: ensure the paid order has a pickupLocation. If somehow missing,
      // backfill from the user's profile (or any prior order). This guarantees no
      // paid order ever lives without a pickup tag — they'll always show up in the
      // Orders/Summary tabs filtered by point.
      if (!order.pickupLocation) {
        const ph = (order.phone || '').replace(/\D/g, '');
        let pickup = '';
        const user = await db.collection('shop_users').findOne({ phone: ph });
        pickup = user?.pickupPoint || user?.pickupLocation || '';
        if (!pickup) {
          const prior = await db.collection('shop_orders').findOne({ phone: ph, pickupLocation: { $exists: true, $ne: '' } });
          pickup = prior?.pickupLocation || '';
        }
        if (pickup) {
          await db.collection('shop_orders').updateOne({ _id: order._id }, { $set: { pickupLocation: pickup } });
          console.log('[GROW WEBHOOK] backfilled pickup for', order._id.toString(), '→', pickup);
        }
      }
    }

    // Decrease stock + send WhatsApp notification
    if (order) {
      // Decrease stock
      for (const item of (order.items || [])) {
        const prodId = item.productId || item.id;
        if (!prodId) continue;
        try {
          const prod = await db.collection('shop_products').findOne(
            { _id: new ObjectId(prodId) },
            { projection: { inventoryId: 1, hasUnlimitedStock: 1 } }
          );
          if (!prod || prod.hasUnlimitedStock) continue;
          await db.collection('shop_products').updateOne(
            { _id: new ObjectId(prodId) },
            { $inc: { stock: -(item.qty || 1) } }
          );
          if (prod.inventoryId) {
            const invItem = await db.collection('shop_inventory').findOne({ _id: new ObjectId(prod.inventoryId) }, { projection: { hasUnlimitedStock: 1 } });
            if (!invItem || !invItem.hasUnlimitedStock) {
              await db.collection('shop_inventory').updateOne(
                { _id: new ObjectId(prod.inventoryId) },
                { $inc: { quantity: -(item.qty || 1) } }
              );
            }
          }
        } catch (_) {}
      }

      // WhatsApp notification
      try {
        const axios = require('axios');
        const itemsList = (order.items || []).map(i => `${i.name}${i.variant ? ' ('+i.variant+')' : ''} x${i.qty}`).join(', ');
        const msg = `🛒 הזמנה חדשה שולמה!\nשם: ${order.customerName}\nטלפון: ${order.phone}\nמוצרים: ${itemsList}\nסכום: ₪${order.totalAmount}\nאיסוף: ${order.pickupLocation || ''}\n💳 ${transactionType || ''} ${cardSuffix ? '****'+cardSuffix : ''}`;
        await axios.post('http://localhost:3001/api/send-message', {
          phone: '972538286227',
          message: msg,
        }).catch(() => {});
      } catch (_) {}

      console.log('[GROW WEBHOOK] order fully processed:', order._id);
    } else {
      console.log('[GROW WEBHOOK] no matching order found for phone:', customerPhone);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[GROW WEBHOOK] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});


// POST /api/shop/payment/notify — Grow calls this when payment is completed
router.post('/payment/notify', async (req, res) => {
  try {
    const db = await getDb();
    console.log('[PAYMENT NOTIFY] received:', JSON.stringify(req.body));
    const { orderId, order_id, transaction_id, status, amount, reference, phone, full_name } = req.body;
    const id = orderId || order_id;

    // Store the notification
    await db.collection('grow_payments').insertOne({
      type: 'notify',
      orderId: id,
      transactionId: transaction_id || reference,
      status,
      amount,
      phone,
      fullName: full_name,
      rawBody: req.body,
      createdAt: new Date()
    });

    // Update order status if orderId provided (only if not already paid)
    if (id) {
      const { ObjectId } = require('mongodb');
      try {
        const updated = await db.collection('shop_orders').updateOne(
          { _id: new ObjectId(id), status: { $nin: ['paid', 'handled', 'confirmed'] } },
          { $set: { status: 'paid', paidAt: new Date(), growRef: reference || transaction_id || null, paidAmount: amount || null } }
        );
        if (updated.modifiedCount === 0) {
          console.log('[PAYMENT NOTIFY] order already paid or not found, skipping:', id);
        }
      } catch(e) { console.log('[PAYMENT NOTIFY] invalid orderId:', id); }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[PAYMENT NOTIFY] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/payment/notify-invoice — Grow calls this with invoice/receipt URL
router.post('/payment/notify-invoice', async (req, res) => {
  try {
    const db = await getDb();
    console.log('[INVOICE NOTIFY] received:', JSON.stringify(req.body));
    // Data may be nested in req.body.data (like main webhook) or flat at req.body
    const nested = req.body.data || {};
    const flat = req.body;
    const orderId = flat.orderId || flat.order_id || nested.orderId || null;
    const url = flat.invoice_url || flat.invoiceUrl || nested.invoiceUrl || nested.invoice_url || '';
    const invNum = flat.invoice_number || flat.invoiceNumber || nested.invoiceNumber || nested.invoice_number || '';
    const txId = flat.transactionId || flat.transaction_id || nested.transactionId || '';
    const procId = flat.processId || nested.processId || '';
    const ref = flat.reference || nested.asmachta || txId || procId || '';
    const phone = flat.phone || flat.payerPhone || nested.payerPhone || null;

    // Store invoice data
    await db.collection('grow_payments').insertOne({
      type: 'invoice',
      orderId: orderId,
      invoiceUrl: url,
      invoiceNumber: invNum,
      transactionId: txId,
      processId: procId,
      phone,
      rawBody: req.body,
      createdAt: new Date()
    });

    // Only try to match and update order if we actually have an invoice URL
    if (!url) {
      console.log('[INVOICE NOTIFY] no invoiceUrl — skipping order update (payment notification, not invoice)');
      return res.json({ ok: true, skipped: true });
    }

    const { ObjectId } = require('mongodb');
    let matched = false;

    // 1. Try by orderId
    if (orderId) {
      try {
        const res = await db.collection('shop_orders').updateOne(
          { _id: new ObjectId(orderId) },
          { $set: { invoiceUrl: url, invoiceNumber: invNum } }
        );
        if (res.modifiedCount > 0) matched = true;
      } catch(e) {}
    }

    // 2. Try by processId/transactionId via grow_payments → order phone
    if (!matched && (procId || txId)) {
      const paymentRecord = await db.collection('grow_payments').findOne({
        type: { $ne: 'invoice' },
        $or: [
          ...(procId ? [{ 'rawBody.data.processId': procId }] : []),
          ...(txId ? [{ 'rawBody.data.transactionId': txId }] : [])
        ]
      });
      if (paymentRecord && paymentRecord.customerPhone) {
        const cleanPhone = paymentRecord.customerPhone.replace(/\D/g, '').replace(/^972/, '0');
        const order = await db.collection('shop_orders').findOne(
          { phone: cleanPhone, status: { $in: ['paid', 'handled', 'confirmed'] } },
          { sort: { createdAt: -1 } }
        );
        if (order && url) {
          await db.collection('shop_orders').updateOne({ _id: order._id }, { $set: { invoiceUrl: url, invoiceNumber: invNum } });
          matched = true;
          console.log('[INVOICE NOTIFY] matched by processId to order:', order._id.toString());
        }
      }
    }

    // 3. Try by phone or growRef directly
    if (!matched && (phone || ref)) {
      const query = { status: { $in: ['paid', 'handled', 'confirmed'] } };
      if (phone) {
        const cleanPhone = phone.replace(/\D/g, '').replace(/^972/, '0');
        query.phone = cleanPhone;
      } else if (ref) {
        query.growRef = ref;
      }
      const order = await db.collection('shop_orders').findOne(query, { sort: { createdAt: -1 } });
      if (order && url) {
        await db.collection('shop_orders').updateOne(
          { _id: order._id },
          { $set: { invoiceUrl: url, invoiceNumber: invNum } }
        );
        console.log('[INVOICE NOTIFY] matched by phone/ref to order:', order._id.toString());
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[INVOICE NOTIFY] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/shop/orders/:id/invoice — Get invoice URL for an order
router.get('/orders/:id/invoice', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const order = await db.collection('shop_orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
    if (!order.invoiceUrl) return res.status(404).json({ error: 'לא נמצאה קבלה להזמנה זו' });
    res.json({ invoiceUrl: order.invoiceUrl, invoiceNumber: order.invoiceNumber || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// PICKUP SMS SYSTEM
// ============================================


// ========== SUPPLIERS ==========

router.get('/suppliers', async (req, res) => {
  try {
    const db = await getDb();
    const suppliers = await db.collection('shop_suppliers').find({}).sort({ name: 1 }).toArray();
    res.json(suppliers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suppliers', async (req, res) => {
  try {
    const db = await getDb();
    const { name, phone, agentName, companyName, taxId, address, email, contactName, paymentTerms, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'שם ספק הוא שדה חובה' });
    const doc = { name, phone: phone||'', agentName: agentName||'', companyName: companyName||'', taxId: taxId||'', address: address||'', email: email||'', contactName: contactName||'', paymentTerms: paymentTerms||'', notes: notes||'', createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('shop_suppliers').insertOne(doc);
    res.json({ ...doc, _id: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/suppliers/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    await db.collection('shop_suppliers').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/suppliers/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    await db.collection('shop_suppliers').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/suppliers/:id/orders', async (req, res) => {
  try {
    const db = await getDb();
    // Optional ?pickupPoint=X — return only purchase orders generated for that point.
    const filter = { supplierId: req.params.id };
    if (req.query.pickupPoint) filter.pickupPoint = req.query.pickupPoint;
    const orders = await db.collection('shop_purchase_orders').find(filter).sort({ createdAt: -1 }).toArray();
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suppliers/:id/orders', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const { items, dateRange, notes, pickupPoint, totalCost } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'אין פריטים' });
    // Pickup point is required so each purchase-order row is owned by one point.
    // Otherwise orders from different points get aggregated into the same supplier sheet.
    if (!pickupPoint) return res.status(400).json({ error: 'חובה לבחור נקודת איסוף להפקת דף לספק' });
    try { await assertValidPickupPoint(db, pickupPoint); }
    catch (e) { return res.status(e.code || 400).json({ error: e.msg }); }
    const supplier = await db.collection('shop_suppliers').findOne({ _id: new ObjectId(req.params.id) });
    if (!supplier) return res.status(404).json({ error: 'ספק לא נמצא' });
    const doc = {
      supplierId: req.params.id,
      supplierName: supplier.name,
      pickupPoint,
      items,
      dateRange: dateRange || '',
      notes: notes || '',
      totalCost: typeof totalCost === 'number' ? totalCost : null,
      totalItems: items.reduce((s,i)=>s+(i.qty||0),0),
      createdAt: new Date(),
    };
    const result = await db.collection('shop_purchase_orders').insertOne(doc);
    res.json({ ...doc, _id: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/suppliers/:supplierId/orders/:orderId', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    await db.collection('shop_purchase_orders').deleteOne({ _id: new ObjectId(req.params.orderId) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ========== ITEM-LEVEL COLLECTION ==========

// PUT /api/shop/orders/:id/collect-item — mark single item as collected
router.put('/orders/:id/collect-item', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const { itemIndex, collected } = req.body; // itemIndex: number, collected: bool
    const order = await db.collection('shop_orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
    const items = order.items || [];
    if (itemIndex < 0 || itemIndex >= items.length) return res.status(400).json({ error: 'פריט לא נמצא' });
    items[itemIndex].collected = !!collected;
    items[itemIndex].collectedAt = collected ? new Date() : null;
    // If all items collected → auto-set status to collected
    const allCollected = items.every(i => i.collected);
    const update = { items, updatedAt: new Date() };
    if (allCollected) update.status = 'collected';
    await db.collection('shop_orders').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ ok: true, allCollected, status: allCollected ? 'collected' : order.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/shop/orders/:id/collection-status — get real-time collection status
router.get('/orders/:id/collection-status', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const order = await db.collection('shop_orders').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { items: 1, status: 1, customerName: 1, phone: 1, pickupLocation: 1 } }
    );
    if (!order) return res.status(404).json({ error: 'לא נמצא' });
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ========== SUPPLIER PAYMENTS ==========

router.get('/suppliers/:id/payments', async (req, res) => {
  try {
    const db = await getDb();
    const payments = await db.collection('shop_supplier_payments').find({ supplierId: req.params.id }).sort({ date: -1, createdAt: -1 }).toArray();
    res.json(payments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suppliers/:id/payments', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const supplier = await db.collection('shop_suppliers').findOne({ _id: new ObjectId(req.params.id) });
    if (!supplier) return res.status(404).json({ error: 'ספק לא נמצא' });
    const { type, docNum, amount, date, method, notes } = req.body;
    if (!amount) return res.status(400).json({ error: 'סכום חובה' });
    const doc = { supplierId: req.params.id, supplierName: supplier.name, type: type||'חשבונית', docNum: docNum||'', amount: parseFloat(amount)||0, date: date ? new Date(date) : new Date(), method: method||'', notes: notes||'', createdAt: new Date() };
    const result = await db.collection('shop_supplier_payments').insertOne(doc);
    res.json({ ...doc, _id: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/suppliers/:supplierId/payments/:paymentId', async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    await db.collection('shop_supplier_payments').deleteOne({ _id: new ObjectId(req.params.paymentId) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
