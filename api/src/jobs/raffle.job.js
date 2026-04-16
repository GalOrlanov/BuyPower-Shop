'use strict';

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gal:12321@cluster0-7hpz1.gcp.mongodb.net/groupPurchase';

let cachedClient = null;
async function getDb() {
  if (!cachedClient || !cachedClient.topology || !cachedClient.topology.isConnected()) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db('shop_prod');
}

function getNextFriday8am(from) {
  const d = new Date(from || new Date());
  d.setHours(8, 0, 0, 0);
  const day = d.getDay();
  let diff;
  if (day < 5) diff = 5 - day;
  else if (day === 5) diff = (new Date() >= d) ? 7 : 0;
  else diff = 6;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Run raffle draw on the active week.
 * @param {Db} db
 * @param {Object} opts { manual: boolean }
 * @returns {Object} { drawn: boolean, winnerTicket?: string, reason?: string }
 */
async function runDraw(db, opts) {
  opts = opts || {};
  const now = new Date();

  const activeWeek = await db.collection('shop_raffle_weeks').findOne({ status: 'active' });
  if (!activeWeek) {
    // No active week — create one for next Friday
    await db.collection('shop_raffle_weeks').insertOne({
      weekStartDate: now,
      weekEndDate: getNextFriday8am(now),
      status: 'active',
      createdAt: now
    });
    return { drawn: false, reason: 'no-active-week-created-new' };
  }

  // Non-manual: enforce Friday 08:00+ and weekEndDate elapsed
  if (!opts.manual) {
    if (now.getDay() !== 5) return { drawn: false, reason: 'not-friday' };
    if (now.getHours() < 8) return { drawn: false, reason: 'before-8am' };
    if (now < new Date(activeWeek.weekEndDate)) return { drawn: false, reason: 'week-not-ended' };
  }

  const settings = await db.collection('shop_settings').findOne({ key: 'raffleSettings' });
  const prizeDescription = (settings && settings.prizeDescription) || 'פרס השבוע 🎁';

  const approved = await db.collection('shop_raffle_entries')
    .find({ raffleWeekId: activeWeek._id, status: 'approved' })
    .toArray();

  let result;
  if (!approved.length) {
    // Close week with no winner
    await db.collection('shop_raffle_weeks').updateOne(
      { _id: activeWeek._id },
      { $set: { status: 'closed', drawnAt: now, totalApprovedEntries: 0, prizeDescription } }
    );
    result = { drawn: false, reason: 'no-approved-entries', weekId: activeWeek._id.toString() };
  } else {
    const winner = approved[Math.floor(Math.random() * approved.length)];
    await db.collection('shop_raffle_weeks').updateOne(
      { _id: activeWeek._id },
      { $set: {
          status: 'drawn',
          winnerTicketNumber: winner.ticketNumber,
          winnerEntryId: winner._id,
          drawnAt: now,
          totalApprovedEntries: approved.length,
          prizeDescription
        }}
    );
    result = {
      drawn: true,
      winnerTicket: winner.ticketNumber,
      winnerEntryId: winner._id.toString(),
      totalEntries: approved.length,
      weekId: activeWeek._id.toString()
    };
  }

  // Open a new active week for next cycle
  await db.collection('shop_raffle_weeks').insertOne({
    weekStartDate: now,
    weekEndDate: getNextFriday8am(new Date(now.getTime() + 60 * 1000)), // nudge past "now" so it doesn't pick same day
    status: 'active',
    createdAt: now
  });

  return result;
}

/**
 * Periodic scheduler entrypoint — call from server setInterval.
 * Runs draw only on Friday >= 8am when weekEndDate has passed.
 */
async function checkAndDrawRaffle() {
  try {
    const db = await getDb();
    const settings = await db.collection('shop_settings').findOne({ key: 'raffleSettings' });
    if (settings && settings.enabled === false) return;
    const result = await runDraw(db, { manual: false });
    if (result.drawn) {
      console.log(`[RAFFLE] Winner drawn: ticket #${result.winnerTicket} from ${result.totalEntries} entries`);
    }
  } catch (e) {
    console.error('[RAFFLE] scheduler error:', e.message);
  }
}

module.exports = { runDraw, checkAndDrawRaffle };
