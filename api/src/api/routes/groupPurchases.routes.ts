import { Router, Request, Response } from 'express';
import { GroupPurchase } from '../../models/GroupPurchase.model';
import { PickupPoint } from '../../models/PickupPoint.model';
import { Participant } from '../../models/Participant.model';
import { Product } from '../../models/Product.model';
import { User } from '../../models/User.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthRequest } from '../../types';
import { initiatePreAuth, capturePreAuth, releasePreAuth } from '../../services/payment.service';

const router = Router();

/** Calculate current price based on participant count and price tiers */
const calculatePrice = (participantCount: number, priceTiers: { minBuyers: number; price: number }[]): number => {
  const sorted = [...priceTiers].sort((a, b) => b.minBuyers - a.minBuyers);
  for (const tier of sorted) {
    if (participantCount >= tier.minBuyers) {
      return tier.price;
    }
  }
  return sorted[sorted.length - 1]?.price || 0;
};

/** GET /api/group-purchases - List active group purchases */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status = 'open', category, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    let query = GroupPurchase.find(filter)
      .populate({
        path: 'productId',
        populate: { path: 'businessId', select: 'businessName logo rating' },
      })
      .populate('pickupPointId')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const purchases = await query;

    // Filter by category if specified
    let filtered = purchases;
    if (category) {
      filtered = purchases.filter((p: any) => p.productId?.category === category);
    }

    res.json(filtered);
  } catch (error) {
    console.error('List group purchases error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת רכישות קבוצתיות' });
  }
});

/** GET /api/group-purchases/my - My purchases */
router.get('/my', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const participations = await Participant.find({ userId: req.user!.id })
      .populate({
        path: 'groupPurchaseId',
        populate: {
          path: 'productId',
          populate: { path: 'businessId', select: 'businessName logo' },
        },
      })
      .sort({ joinedAt: -1 });

    let results = participations;
    if (status) {
      results = participations.filter(
        (p: any) => p.groupPurchaseId?.status === status,
      );
    }

    res.json(results);
  } catch (error) {
    console.error('My purchases error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הרכישות שלי' });
  }
});

/** GET /api/group-purchases/:id - Get group purchase details */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const gp = await GroupPurchase.findById(req.params.id)
      .populate({
        path: 'productId',
        populate: { path: 'businessId', select: 'businessName logo rating reviewCount description contactEmail' },
      })
      .populate('pickupPointId');

    if (!gp) {
      res.status(404).json({ error: 'רכישה קבוצתית לא נמצאה' });
      return;
    }

    const participants = await Participant.find({ groupPurchaseId: gp._id })
      .populate('userId', 'firstName lastName')
      .select('userId quantity joinedAt');

    res.json({ groupPurchase: gp, participants });
  } catch (error) {
    console.error('Get group purchase error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת רכישה קבוצתית' });
  }
});

/** POST /api/group-purchases/:id/join - Join a group purchase */
router.post(
  '/:id/join',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { quantity = 1 } = req.body;
      const userId = req.user!.id;
      const gpId = req.params.id;

      const gp = await GroupPurchase.findById(gpId).populate('productId');
      if (!gp) {
        res.status(404).json({ error: 'רכישה קבוצתית לא נמצאה' });
        return;
      }

      if (gp.status !== 'open') {
        res.status(400).json({ error: 'הרכישה הקבוצתית אינה פתוחה להצטרפות' });
        return;
      }

      const product = gp.productId as any;
      if (gp.participantCount >= product.maxBuyers) {
        res.status(400).json({ error: 'הרכישה הקבוצתית מלאה' });
        return;
      }

      // Check if already joined
      const existing = await Participant.findOne({ userId, groupPurchaseId: gpId });
      if (existing) {
        res.status(409).json({ error: 'כבר הצטרפת לרכישה זו' });
        return;
      }

      // Check deadline
      if (new Date() > gp.endDate) {
        res.status(400).json({ error: 'הרכישה הקבוצתית הסתיימה' });
        return;
      }

      // Calculate pre-auth amount at current price
      const preAuthAmount = calculatePrice(gp.participantCount + 1, product.priceTiers) * quantity;

      // Trigger Grow pre-authorization (credit hold — NOT a charge)
      let preAuthId: string | undefined;
      let preAuthStatus: 'pending' | 'failed' = 'pending';
      try {
        const user = await User.findById(userId).select('email firstName lastName').lean();
        const preAuth = await initiatePreAuth(preAuthAmount, 'ILS', {
          orderId: `BP_JOIN_${gpId}_${userId}_${Date.now()}`,
          description: `BuyPower - אישור מקדים: ${product.name}`,
          customerEmail: (user as any)?.email,
          customerName: [(user as any)?.firstName, (user as any)?.lastName].filter(Boolean).join(' '),
        });
        preAuthId = preAuth.preAuthId;
        preAuthStatus = 'pending';
        console.log(`[PreAuth] Created hold ${preAuthId} for user ${userId}, amount ₪${preAuthAmount}`);
      } catch (preAuthErr) {
        console.error('[PreAuth] Failed to create hold:', preAuthErr);
        // We still allow join but mark preAuthStatus as failed
        preAuthStatus = 'failed';
      }

      const participant = await Participant.create({
        userId,
        groupPurchaseId: gpId,
        quantity,
        paymentStatus: 'preauth',
        preAuthId,
        preAuthAmount,
        preAuthStatus,
      });

      // Update participant count and recalculate price
      const newCount = gp.participantCount + 1;
      const newPrice = calculatePrice(newCount, product.priceTiers);

      await GroupPurchase.findByIdAndUpdate(gpId, {
        participantCount: newCount,
        currentPrice: newPrice,
      });

      res.status(201).json({
        participant,
        updatedPrice: newPrice,
        participantCount: newCount,
        preAuthId,
        preAuthStatus,
        preAuthAmount,
        message: 'האשראי שלך אובטח. החיוב יבוצע רק עם השלמת הרכישה הקבוצתית.',
      });
    } catch (error) {
      console.error('Join group purchase error:', error);
      res.status(500).json({ error: 'שגיאה בהצטרפות לרכישה קבוצתית' });
    }
  },
);

/** DELETE /api/group-purchases/:id/leave - Leave a group purchase */
router.delete(
  '/:id/leave',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const gpId = req.params.id;

      const gp = await GroupPurchase.findById(gpId).populate('productId');
      if (!gp) {
        res.status(404).json({ error: 'רכישה קבוצתית לא נמצאה' });
        return;
      }

      if (gp.status === 'closed') {
        res.status(400).json({ error: 'לא ניתן לעזוב רכישה שנסגרה' });
        return;
      }

      const participant = await Participant.findOneAndDelete({ userId, groupPurchaseId: gpId });
      if (!participant) {
        res.status(404).json({ error: 'לא נמצאה השתתפות ברכישה זו' });
        return;
      }

      // Update participant count and recalculate price
      const newCount = Math.max(0, gp.participantCount - 1);
      const product = gp.productId as any;
      const newPrice = calculatePrice(newCount, product.priceTiers);

      await GroupPurchase.findByIdAndUpdate(gpId, {
        participantCount: newCount,
        currentPrice: newPrice,
      });

      res.json({ message: 'עזבת את הרכישה הקבוצתית', participantCount: newCount, currentPrice: newPrice });
    } catch (error) {
      console.error('Leave group purchase error:', error);
      res.status(500).json({ error: 'שגיאה בעזיבת רכישה קבוצתית' });
    }
  },
);

/**
 * POST /api/group-purchases/:id/capture
 * Called when a group purchase completes — captures all pending pre-authorizations.
 * This triggers the actual charge on each participant's credit card.
 */
router.post(
  '/:id/capture',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const gpId = req.params.id;
      const gp = await GroupPurchase.findById(gpId);
      if (!gp) {
        res.status(404).json({ error: 'רכישה קבוצתית לא נמצאה' });
        return;
      }

      // Only admins or the system should be able to capture
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'אין הרשאה לבצע פעולה זו' });
        return;
      }

      const participants = await Participant.find({
        groupPurchaseId: gpId,
        preAuthStatus: 'pending',
        preAuthId: { $exists: true, $ne: null },
      });

      const results: { participantId: string; success: boolean; error?: string }[] = [];

      for (const participant of participants) {
        try {
          const result = await capturePreAuth(
            participant.preAuthId!,
            participant.preAuthAmount || gp.currentPrice * participant.quantity,
          );
          if (result.success) {
            await Participant.findByIdAndUpdate(participant._id, {
              preAuthStatus: 'captured',
              paymentStatus: 'charged',
            });
            results.push({ participantId: String(participant._id), success: true });
          } else {
            await Participant.findByIdAndUpdate(participant._id, { preAuthStatus: 'failed' });
            results.push({ participantId: String(participant._id), success: false, error: 'capture failed' });
          }
        } catch (err: any) {
          await Participant.findByIdAndUpdate(participant._id, { preAuthStatus: 'failed' });
          results.push({ participantId: String(participant._id), success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[Capture] GP ${gpId}: ${successCount}/${participants.length} captures succeeded`);

      res.json({
        message: `חויבו ${successCount} מתוך ${participants.length} משתתפים`,
        results,
      });
    } catch (error) {
      console.error('Capture pre-auths error:', error);
      res.status(500).json({ error: 'שגיאה בביצוע החיובים' });
    }
  },
);

/**
 * POST /api/group-purchases/:id/release
 * Called when a group purchase fails or expires — releases all pending pre-authorizations.
 * No charge is made; the credit hold is lifted.
 */
router.post(
  '/:id/release',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const gpId = req.params.id;
      const gp = await GroupPurchase.findById(gpId);
      if (!gp) {
        res.status(404).json({ error: 'רכישה קבוצתית לא נמצאה' });
        return;
      }

      // Only admins or the system should be able to release
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'אין הרשאה לבצע פעולה זו' });
        return;
      }

      const participants = await Participant.find({
        groupPurchaseId: gpId,
        preAuthStatus: 'pending',
        preAuthId: { $exists: true, $ne: null },
      });

      const results: { participantId: string; success: boolean; error?: string }[] = [];

      for (const participant of participants) {
        try {
          const result = await releasePreAuth(participant.preAuthId!);
          await Participant.findByIdAndUpdate(participant._id, {
            preAuthStatus: result.success ? 'released' : 'failed',
            paymentStatus: result.success ? 'released' : participant.paymentStatus,
          });
          results.push({ participantId: String(participant._id), success: result.success });
        } catch (err: any) {
          await Participant.findByIdAndUpdate(participant._id, { preAuthStatus: 'failed' });
          results.push({ participantId: String(participant._id), success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[Release] GP ${gpId}: ${successCount}/${participants.length} releases succeeded`);

      res.json({
        message: `שוחררו ${successCount} מתוך ${participants.length} אישורים מקדימים`,
        results,
      });
    } catch (error) {
      console.error('Release pre-auths error:', error);
      res.status(500).json({ error: 'שגיאה בשחרור האישורים המקדימים' });
    }
  },
);

export default router;
