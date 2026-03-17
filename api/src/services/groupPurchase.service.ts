import { GroupPurchase } from '../models/GroupPurchase.model';
import { Participant } from '../models/Participant.model';
import { Product } from '../models/Product.model';
import { Payment } from '../models/Payment.model';
import { notifyGroupPurchaseParticipants } from './notification.service';

/** Check and close expired group purchases */
export const closeExpiredPurchases = async (): Promise<void> => {
  const expired = await GroupPurchase.find({
    status: 'open',
    endDate: { $lt: new Date() },
  }).populate('productId');

  for (const gp of expired) {
    const product = gp.productId as any;

    if (gp.participantCount < product.minBuyers) {
      // Not enough participants - cancel and refund
      await GroupPurchase.findByIdAndUpdate(gp._id, { status: 'cancelled' });

      const participants = await Participant.find({ groupPurchaseId: gp._id });
      for (const p of participants) {
        await Participant.findByIdAndUpdate(p._id, { paymentStatus: 'refunded' });
        if (p.paymentId) {
          await Payment.findByIdAndUpdate(p.paymentId, { status: 'refunded' });
        }
      }

      const userIds = participants.map((p) => p.userId.toString());
      await notifyGroupPurchaseParticipants(
        userIds,
        'purchase_closed',
        'רכישה קבוצתית בוטלה',
        `הרכישה הקבוצתית של ${product.name} בוטלה - לא הגיע מספיק משתתפים. התשלום יוחזר.`,
        { groupPurchaseId: gp._id },
      );
    } else {
      // Enough participants - close successfully
      await GroupPurchase.findByIdAndUpdate(gp._id, { status: 'closed' });

      const participants = await Participant.find({ groupPurchaseId: gp._id });
      const userIds = participants.map((p) => p.userId.toString());

      await notifyGroupPurchaseParticipants(
        userIds,
        'purchase_closed',
        'הרכישה הקבוצתית נסגרה!',
        `הרכישה הקבוצתית של ${product.name} נסגרה בהצלחה במחיר ₪${gp.currentPrice}`,
        { groupPurchaseId: gp._id },
      );
    }
  }
};
