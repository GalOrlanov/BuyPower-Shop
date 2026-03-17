import { Router, Request, Response } from 'express';
import { Payment } from '../../models/Payment.model';
import { Participant } from '../../models/Participant.model';
import { GroupPurchase } from '../../models/GroupPurchase.model';
import { Product } from '../../models/Product.model';
import { Business } from '../../models/Business.model';
import { User } from '../../models/User.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { AuthRequest } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { sendOrderConfirmation } from '../../services/whatsapp.service';

const router = Router();

/** POST /api/payments/initiate - Initiate payment (mock for MVP) */
router.post(
  '/initiate',
  authenticateToken,
  validateBody(['participantId']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const participant = await Participant.findOne({
        _id: req.body.participantId,
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

      // Mock payment - in production, integrate with PayPlus/Tranzila
      const payment = await Payment.create({
        participantId: participant._id,
        amount: gp.currentPrice * participant.quantity,
        provider: 'mock',
        transactionId: `MOCK_${uuidv4()}`,
        status: 'success',
      });

      // Update participant payment status
      await Participant.findByIdAndUpdate(participant._id, {
        paymentStatus: 'authorized',
        paymentId: payment._id,
      });

      res.status(201).json(payment);
    } catch (error) {
      console.error('Initiate payment error:', error);
      res.status(500).json({ error: 'שגיאה ביצירת תשלום' });
    }
  },
);

/** POST /api/payments/webhook - Payment provider webhook */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Implement PayPlus/Tranzila webhook validation
    const { transactionId, status } = req.body;

    const payment = await Payment.findOneAndUpdate(
      { transactionId },
      { status },
      { new: true },
    );

    if (payment && status === 'success') {
      await Participant.findByIdAndUpdate(payment.participantId, {
        paymentStatus: 'charged',
      });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'שגיאה בעיבוד webhook' });
  }
});

/** GET /api/payments/:id/status - Check payment status */
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
      res.json({ status: payment.status, amount: payment.amount });
    } catch (error) {
      console.error('Payment status error:', error);
      res.status(500).json({ error: 'שגיאה בבדיקת סטטוס תשלום' });
    }
  },
);

export default router;
