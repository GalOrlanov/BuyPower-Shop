'use strict';

const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'shop_secret_2026';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

let cachedClient = null;
async function getDb() {
  if (!cachedClient || !cachedClient.topology || !cachedClient.topology.isConnected()) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db('shop_prod');
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function verifyAdmin(req, res, next) {
  let token = null;
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token) return res.status(401).json({ error: 'לא מחובר' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: 'אין הרשאת אדמין' });
    req.adminUser = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'טוקן לא תקף' });
  }
}

// Get next Friday 08:00 (local time)
function getNextFriday8am(from) {
  const d = new Date(from || new Date());
  d.setHours(8, 0, 0, 0);
  const day = d.getDay(); // 0=Sun,5=Fri
  let diff;
  if (day < 5) diff = 5 - day;
  else if (day === 5) {
    // If it's Friday and already past 8am, jump to next week
    diff = (new Date() >= d) ? 7 : 0;
  } else { // Saturday
    diff = 6;
  }
  d.setDate(d.getDate() + diff);
  return d;
}

async function generateTicketNumber(db, weekId) {
  for (let i = 0; i < 200; i++) {
    const num = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const exists = await db.collection('shop_raffle_entries')
      .findOne({ raffleWeekId: weekId, ticketNumber: num });
    if (!exists) return num;
  }
  throw new Error('Cannot generate unique ticket number');
}

async function getOrCreateActiveWeek(db) {
  let week = await db.collection('shop_raffle_weeks').findOne({ status: 'active' });
  if (!week) {
    const now = new Date();
    const nextFriday = getNextFriday8am(now);
    const doc = {
      weekStartDate: now,
      weekEndDate: nextFriday,
      status: 'active',
      createdAt: now
    };
    const r = await db.collection('shop_raffle_weeks').insertOne(doc);
    week = { ...doc, _id: r.insertedId };
  }
  return week;
}

async function getSettings(db) {
  const defaults = {
    key: 'raffleSettings',
    minReceiptAmount: 200,
    drawDayOfWeek: 5,
    drawHour: 8,
    enabled: true,
    prizeDescription: 'פרס השבוע 🎁'
  };
  const doc = await db.collection('shop_settings').findOne({ key: 'raffleSettings' });
  return doc ? { ...defaults, ...doc } : defaults;
}

// ────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS
// ────────────────────────────────────────────────────────────

// GET /api/raffle/status
// Public view: current week info, next draw, participant count, latest winner
router.get('/status', async (req, res) => {
  try {
    const db = await getDb();
    const settings = await getSettings(db);
    const activeWeek = await getOrCreateActiveWeek(db);
    const approvedCount = await db.collection('shop_raffle_entries')
      .countDocuments({ raffleWeekId: activeWeek._id, status: 'approved' });

    // Latest drawn winner (for display on top of page)
    const lastDrawn = await db.collection('shop_raffle_weeks')
      .find({ status: 'drawn' })
      .sort({ drawnAt: -1 })
      .limit(1)
      .toArray();

    const lastWinner = lastDrawn[0] ? {
      ticketNumber: lastDrawn[0].winnerTicketNumber,
      drawnAt: lastDrawn[0].drawnAt,
      prizeDescription: lastDrawn[0].prizeDescription || settings.prizeDescription,
      totalEntries: lastDrawn[0].totalApprovedEntries
    } : null;

    res.json({
      enabled: settings.enabled !== false,
      minReceiptAmount: settings.minReceiptAmount,
      prizeDescription: settings.prizeDescription,
      nextDrawAt: activeWeek.weekEndDate,
      currentWeekStart: activeWeek.weekStartDate,
      approvedCount,
      lastWinner
    });
  } catch (e) {
    console.error('raffle/status error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/raffle/history?limit=10
// Public: only ticketNumber + date, NO personal details
router.get('/history', async (req, res) => {
  try {
    const db = await getDb();
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const weeks = await db.collection('shop_raffle_weeks')
      .find({ status: 'drawn' })
      .sort({ drawnAt: -1 })
      .limit(limit)
      .toArray();
    res.json(weeks.map(w => ({
      ticketNumber: w.winnerTicketNumber,
      drawnAt: w.drawnAt,
      prizeDescription: w.prizeDescription || 'פרס השבוע',
      totalEntries: w.totalApprovedEntries
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/raffle/register
// Public registration with receipt image
router.post('/register', async (req, res) => {
  try {
    const db = await getDb();
    const settings = await getSettings(db);
    if (settings.enabled === false) return res.status(403).json({ error: 'ההגרלה אינה פעילה כרגע' });

    const name = (req.body.name || '').trim();
    const phone = (req.body.phone || '').replace(/[^0-9]/g, '');
    const email = (req.body.email || '').trim().toLowerCase();
    const receiptImageUrl = (req.body.receiptImageUrl || '').trim();

    if (!name) return res.status(400).json({ error: 'נא להזין שם' });
    if (!phone && !email) return res.status(400).json({ error: 'נא להזין טלפון או מייל' });
    if (phone && phone.length < 9) return res.status(400).json({ error: 'מספר טלפון לא תקין' });
    if (!receiptImageUrl) return res.status(400).json({ error: 'נא להעלות תמונת קבלה' });

    const activeWeek = await getOrCreateActiveWeek(db);

    // Prevent duplicate registrations for same week
    const dupQuery = { raffleWeekId: activeWeek._id, $or: [] };
    if (phone) dupQuery.$or.push({ phone });
    if (email) dupQuery.$or.push({ email });
    if (dupQuery.$or.length) {
      const existing = await db.collection('shop_raffle_entries').findOne(dupQuery);
      if (existing) return res.status(409).json({
        error: 'כבר נרשמת השבוע',
        ticketNumber: existing.ticketNumber,
        status: existing.status
      });
    }

    const ticketNumber = await generateTicketNumber(db, activeWeek._id);
    const entry = {
      raffleWeekId: activeWeek._id,
      ticketNumber,
      name,
      phone: phone || '',
      email: email || '',
      receiptImageUrl,
      status: 'pending',
      rejectionReason: '',
      createdAt: new Date()
    };
    await db.collection('shop_raffle_entries').insertOne(entry);

    res.json({
      ok: true,
      ticketNumber,
      status: 'pending',
      message: 'נרשמת בהצלחה! הרישום שלך ממתין לאישור לאחר בדיקת הקבלה'
    });
  } catch (e) {
    console.error('raffle/register error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ────────────────────────────────────────────────────────────

// GET /api/raffle/admin/pending
router.get('/admin/pending', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const activeWeek = await getOrCreateActiveWeek(db);
    const entries = await db.collection('shop_raffle_entries')
      .find({ raffleWeekId: activeWeek._id, status: 'pending' })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(entries);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffle/admin/all
router.get('/admin/all', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const activeWeek = await getOrCreateActiveWeek(db);
    const entries = await db.collection('shop_raffle_entries')
      .find({ raffleWeekId: activeWeek._id })
      .sort({ createdAt: -1 })
      .toArray();
    const approved = entries.filter(e => e.status === 'approved').length;
    const pending = entries.filter(e => e.status === 'pending').length;
    const rejected = entries.filter(e => e.status === 'rejected').length;
    res.json({
      week: activeWeek,
      entries,
      counts: { approved, pending, rejected, total: entries.length }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/raffle/admin/:entryId/approve
router.post('/admin/:entryId/approve', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection('shop_raffle_entries').updateOne(
      { _id: new ObjectId(req.params.entryId) },
      { $set: { status: 'approved', approvedAt: new Date(), approvedBy: req.adminUser.name || 'admin' } }
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'לא נמצא' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/raffle/admin/:entryId/reject
router.post('/admin/:entryId/reject', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const reason = (req.body && req.body.rejectionReason) || '';
    const result = await db.collection('shop_raffle_entries').updateOne(
      { _id: new ObjectId(req.params.entryId) },
      { $set: { status: 'rejected', rejectionReason: reason, approvedAt: new Date(), approvedBy: req.adminUser.name || 'admin' } }
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'לא נמצא' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffle/admin/settings
router.get('/admin/settings', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const s = await getSettings(db);
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/raffle/admin/settings
router.put('/admin/settings', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const update = {
      key: 'raffleSettings',
      minReceiptAmount: parseFloat(req.body.minReceiptAmount) || 200,
      enabled: req.body.enabled !== false,
      prizeDescription: (req.body.prizeDescription || '').trim() || 'פרס השבוע 🎁',
      drawDayOfWeek: 5,
      drawHour: 8
    };
    await db.collection('shop_settings').updateOne(
      { key: 'raffleSettings' },
      { $set: update },
      { upsert: true }
    );
    res.json({ ok: true, settings: update });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/raffle/admin/draw-manual
router.post('/admin/draw-manual', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const result = await require('../../jobs/raffle.job').runDraw(db, { manual: true });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffle/admin/history
router.get('/admin/history', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const weeks = await db.collection('shop_raffle_weeks')
      .find({ status: { $in: ['drawn', 'closed'] } })
      .sort({ drawnAt: -1 })
      .limit(50)
      .toArray();

    // Enrich with winner details
    const enriched = await Promise.all(weeks.map(async w => {
      if (!w.winnerEntryId) return { ...w, winner: null };
      const entry = await db.collection('shop_raffle_entries').findOne({ _id: w.winnerEntryId });
      return { ...w, winner: entry };
    }));

    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────────────────────────────────────────────────────
// GALLERY ENDPOINTS
// ────────────────────────────────────────────────────────────

// GET /api/raffle/gallery — public list
router.get('/gallery', async (req, res) => {
  try {
    const db = await getDb();
    const items = await db.collection('shop_raffle_gallery')
      .find({})
      .sort({ sortOrder: 1, createdAt: -1 })
      .toArray();
    res.json(items.map(i => ({ _id: i._id, imageUrl: i.imageUrl, caption: i.caption || '' })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/raffle/admin/gallery — add image
router.post('/admin/gallery', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const imageUrl = (req.body.imageUrl || '').trim();
    const caption = (req.body.caption || '').trim();
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
    const doc = { imageUrl, caption, sortOrder: 0, createdAt: new Date() };
    const r = await db.collection('shop_raffle_gallery').insertOne(doc);
    res.json({ ok: true, _id: r.insertedId, ...doc });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/raffle/admin/gallery/:id
router.delete('/admin/gallery/:id', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const r = await db.collection('shop_raffle_gallery').deleteOne({ _id: new ObjectId(req.params.id) });
    if (!r.deletedCount) return res.status(404).json({ error: 'לא נמצא' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/raffle/admin/gallery/:id — update caption/sortOrder
router.put('/admin/gallery/:id', verifyAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const update = {};
    if (typeof req.body.caption === 'string') update.caption = req.body.caption.trim();
    if (req.body.sortOrder !== undefined) update.sortOrder = parseInt(req.body.sortOrder) || 0;
    if (!Object.keys(update).length) return res.status(400).json({ error: 'nothing to update' });
    await db.collection('shop_raffle_gallery').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
