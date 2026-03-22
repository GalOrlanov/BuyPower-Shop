import { Router, Request, Response } from 'express';
import { Payment } from '../../models/Payment.model';
import { Participant } from '../../models/Participant.model';
import { GroupPurchase } from '../../models/GroupPurchase.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { AuthRequest } from '../../types';
import { buildRegularPaymentUrl, buildGroupJoinPaymentUrl } from '../../services/tranzila.service';
import { env } from '../../config/env';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET IFRAME URL — Regular purchase (immediate charge)
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/payments/regular-iframe?orderId=&amount=
 * Returns the Tranzila iframe URL for a regular (immediate) purchase.
 * tranmode=A → card is charged immediately when user submits.
 * Callback: POST /api/payments/tranzila-callback/regular with TranzilaTK, Response, etc.
 */
router.get(
  '/regular-iframe',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { orderId, amount } = req.query;
    if (!orderId || !amount) {
      res.status(400).json({ error: 'חסר orderId או amount' });
      return;
    }

    const iframeUrl = buildRegularPaymentUrl({
      amount: parseFloat(amount as string),
      orderId: orderId as string,
      successUrl: `${env.clientUrl}/payment/success?order=${orderId}`,
      failUrl: `${env.clientUrl}/payment/fail?order=${orderId}`,
    });

    res.json({ iframeUrl });
  }
);

// ─────────────────────────────────────────────────────────────
// GET IFRAME URL — Group purchase join (credit hold + token)
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/payments/group-join-iframe?participantId=
 * Returns the Tranzila iframe URL for joining a group purchase.
 * tranmode=AK → credit hold, returns TranzilaTK token for later capture/void.
 * Callback: POST /api/payments/tranzila-callback/group-join
 */
router.get(
  '/group-join-iframe',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { participantId } = req.query;
    if (!participantId) {
      res.status(400).json({ error: 'חסר participantId' });
      return;
    }

    const participant = await Participant.findOne({
      _id: participantId,
      userId: req.user!.id,
    });
    if (!participant) {
      res.status(404).json({ error: 'השתתפות לא נמצאה' });
      return;
    }

    const gp = await GroupPurchase.findById(participant.groupPurchaseId);
    if (!gp) {
      res.status(404).json({ error: 'רכישה קבוצתית לא נמצאה' });
      return;
    }

    const amount = (gp as any).currentPrice * participant.quantity;
    const orderId = `GP_${participant._id}_${Date.now()}`;

    const iframeUrl = buildGroupJoinPaymentUrl({
      amount,
      orderId,
      successUrl: `${env.clientUrl}/group/${gp._id}/payment-success?participant=${participantId}`,
      failUrl: `${env.clientUrl}/group/${gp._id}/payment-fail?participant=${participantId}`,
    });

    res.json({ iframeUrl, amount, orderId });
  }
);

// ─────────────────────────────────────────────────────────────
// TRANZILA CALLBACK — Regular purchase
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/payments/tranzila-callback/regular
 * Called by Tranzila after a regular payment (tranmode=A).
 * Saves the payment record and marks it paid.
 *
 * Tranzila sends: Response, ConfirmationCode, TranzilaTK, sum, supplier, order, ...
 */
router.post(
  '/tranzila-callback/regular',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        Response: tranzilaResponse,
        ConfirmationCode,
        order,
        sum,
        TranzilaTK,
      } = req.body;

      const success = tranzilaResponse === '000';

      await Payment.create({
        transactionId: ConfirmationCode || `TRANZILA_${Date.now()}`,
        orderId: order,
        amount: parseFloat(sum || '0'),
        provider: 'tranzila',
        status: success ? 'success' : 'failed',
        type: 'regular',
        meta: req.body,
      });

      // Redirect to success/fail page
      const redirectBase = env.clientUrl;
      if (success) {
        res.redirect(`${redirectBase}/payment/success?order=${order}`);
      } else {
        res.redirect(`${redirectBase}/payment/fail?order=${order}`);
      }
    } catch (error) {
      console.error('[Tranzila Regular Callback] Error:', error);
      res.status(500).json({ error: 'שגיאה בעיבוד callback' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TRANZILA CALLBACK — Group purchase join (credit hold)
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/payments/tranzila-callback/group-join
 * Called by Tranzila after a group-join pre-auth (tranmode=AK).
 *
 * On success: saves TranzilaTK + ConfirmationCode to Participant.
 *   - TranzilaTK = token for future capture/void
 *   - ConfirmationCode = authorization number (needed for void)
 * The card is HELD but not charged yet.
 *
 * On failure: marks participant payment as failed.
 */
router.post(
  '/tranzila-callback/group-join',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        Response: tranzilaResponse,
        ConfirmationCode,
        TranzilaTK,
        expdate,
        order,
        sum,
      } = req.body;

      const success = tranzilaResponse === '000';

      // Extract participantId from order string: "GP_{participantId}_{timestamp}"
      const participantId = order?.split('_')[1];

      if (!participantId) {
        console.error('[Tranzila GP Callback] Cannot extract participantId from order:', order);
        res.redirect(`${env.clientUrl}/payment/fail`);
        return;
      }

      if (success && TranzilaTK) {
        // Save token + confirmation to participant — card is now held
        await Participant.findByIdAndUpdate(participantId, {
          paymentStatus: 'authorized',
          tranzilaTK: TranzilaTK,
          tranzilaExpdate: expdate,
          tranzilaConfirmCode: ConfirmationCode,
          tranzilaHoldAmount: parseFloat(sum || '0'),
        });

        await Payment.create({
          transactionId: ConfirmationCode,
          orderId: order,
          amount: parseFloat(sum || '0'),
          provider: 'tranzila',
          status: 'authorized', // held, not charged
          type: 'group_join_preauth',
          participantId,
          meta: req.body,
        });

        const participant = await Participant.findById(participantId);
        const gpId = participant?.groupPurchaseId;
        res.redirect(`${env.clientUrl}/group/${gpId}/payment-success?participant=${participantId}`);
      } else {
        await Participant.findByIdAndUpdate(participantId, {
          paymentStatus: 'failed',
        });

        const participant = await Participant.findById(participantId);
        const gpId = participant?.groupPurchaseId;
        res.redirect(`${env.clientUrl}/group/${gpId}/payment-fail?participant=${participantId}`);
      }
    } catch (error) {
      console.error('[Tranzila GP Callback] Error:', error);
      res.status(500).json({ error: 'שגיאה בעיבוד callback' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// STATUS CHECK
// ─────────────────────────────────────────────────────────────
router.get(
  '/:id/status',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const payment = await Payment.findById(req.params.id);
      if (!payment) {
        res.status(404).json({ error: 'תשלום לא נמצא' });
        return;
      }
      res.json({ status: (payment as any).status, amount: (payment as any).amount });
    } catch (error) {
      console.error('Payment status error:', error);
      res.status(500).json({ error: 'שגיאה בבדיקת סטטוס תשלום' });
    }
  }
);

export default router;
