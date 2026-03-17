import { Router, Response } from 'express';
import { User } from '../../models/User.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthRequest } from '../../types';

const router = Router();

/** GET /api/users/me - Get current user profile */
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פרופיל' });
  }
});

/** PUT /api/users/me - Update profile */
router.put('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = ['firstName', 'lastName', 'location', 'phone'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(req.user!.id, updates, { new: true }).select(
      '-password',
    );
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון פרופיל' });
  }
});

/** GET /api/users/me/savings - Get cumulative savings */
router.get(
  '/me/savings',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.user!.id).select('totalSavings');
      res.json({ totalSavings: user?.totalSavings || 0 });
    } catch (error) {
      console.error('Get savings error:', error);
      res.status(500).json({ error: 'שגיאה בטעינת חיסכון' });
    }
  },
);

/** GET /api/users/me/recently-viewed - Get recently viewed products */
router.get(
  '/me/recently-viewed',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.user!.id)
        .select('recentlyViewed')
        .populate('recentlyViewed');
      res.json(user?.recentlyViewed || []);
    } catch (error) {
      console.error('Get recently viewed error:', error);
      res.status(500).json({ error: 'שגיאה בטעינת מוצרים אחרונים' });
    }
  },
);

/** PUT /api/users/me/fcm-token - Update FCM token */
router.put(
  '/me/fcm-token',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { fcmToken } = req.body;
      await User.findByIdAndUpdate(req.user!.id, { fcmToken });
      res.json({ message: 'אסימון עודכן' });
    } catch (error) {
      console.error('Update FCM token error:', error);
      res.status(500).json({ error: 'שגיאה בעדכון אסימון' });
    }
  },
);

export default router;
