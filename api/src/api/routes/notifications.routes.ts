import { Router, Response } from 'express';
import { Notification } from '../../models/Notification.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthRequest } from '../../types';

const router = Router();

/** GET /api/notifications - Get user notifications */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user!.id })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Notification.countDocuments({ userId: req.user!.id }),
      Notification.countDocuments({ userId: req.user!.id, isRead: false }),
    ]);

    res.json({ notifications, total, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת התראות' });
  }
});

/** PUT /api/notifications/:id/read - Mark as read */
router.put('/:id/read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { isRead: true },
    );
    res.json({ message: 'התראה סומנה כנקראה' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון התראה' });
  }
});

/** PUT /api/notifications/read-all - Mark all as read */
router.put('/read-all', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ userId: req.user!.id, isRead: false }, { isRead: true });
    res.json({ message: 'כל ההתראות סומנו כנקראו' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון התראות' });
  }
});

export default router;
