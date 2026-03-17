import { Router, Response } from 'express';
import { User } from '../../models/User.model';
import { Referral } from '../../models/Referral.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthRequest } from '../../types';

const router = Router();

/** GET /api/referrals/my-link - Get referral link */
router.get(
  '/my-link',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.user!.id).select('referralCode');
      if (!user) {
        res.status(404).json({ error: 'משתמש לא נמצא' });
        return;
      }
      res.json({ referralCode: user.referralCode });
    } catch (error) {
      console.error('Get referral link error:', error);
      res.status(500).json({ error: 'שגיאה בטעינת קוד הפניה' });
    }
  },
);

/** POST /api/referrals/apply - Apply referral code (during registration) */
router.post(
  '/apply',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { referralCode } = req.body;
      if (!referralCode) {
        res.status(400).json({ error: 'קוד הפניה חסר' });
        return;
      }

      const referrer = await User.findOne({ referralCode });
      if (!referrer) {
        res.status(404).json({ error: 'קוד הפניה לא תקין' });
        return;
      }

      if (referrer._id.toString() === req.user!.id) {
        res.status(400).json({ error: 'לא ניתן להשתמש בקוד הפניה שלך' });
        return;
      }

      const existing = await Referral.findOne({ referredId: req.user!.id });
      if (existing) {
        res.status(409).json({ error: 'כבר השתמשת בקוד הפניה' });
        return;
      }

      await Referral.create({
        referrerId: referrer._id,
        referredId: req.user!.id,
        bonusAmount: 10,
      });

      res.json({ message: 'קוד הפניה הופעל בהצלחה' });
    } catch (error) {
      console.error('Apply referral error:', error);
      res.status(500).json({ error: 'שגיאה בהפעלת קוד הפניה' });
    }
  },
);

/** GET /api/referrals/stats - Get referral stats */
router.get(
  '/stats',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const referrals = await Referral.find({ referrerId: req.user!.id });
      const totalBonus = referrals
        .filter((r) => r.status === 'credited')
        .reduce((sum, r) => sum + r.bonusAmount, 0);

      res.json({
        totalReferrals: referrals.length,
        creditedReferrals: referrals.filter((r) => r.status === 'credited').length,
        pendingReferrals: referrals.filter((r) => r.status === 'pending').length,
        totalBonus,
      });
    } catch (error) {
      console.error('Referral stats error:', error);
      res.status(500).json({ error: 'שגיאה בטעינת נתוני הפניות' });
    }
  },
);

export default router;
