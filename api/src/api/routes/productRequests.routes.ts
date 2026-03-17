import { Router, Request, Response } from 'express';
import { ProductRequest } from '../../models/ProductRequest.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { AuthRequest } from '../../types';

const router = Router();

/** GET /api/product-requests - List requests */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status = 'open', page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const requests = await ProductRequest.find(filter)
      .populate('userId', 'firstName lastName')
      .populate('comments.userId', 'firstName lastName')
      .sort({ voteCount: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json(requests);
  } catch (error) {
    console.error('List requests error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת בקשות' });
  }
});

/** POST /api/product-requests - Create request */
router.post(
  '/',
  authenticateToken,
  validateBody(['title']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const request = await ProductRequest.create({
        userId: req.user!.id,
        title: req.body.title,
        description: req.body.description || '',
        category: req.body.category || 'other',
      });
      res.status(201).json(request);
    } catch (error) {
      console.error('Create request error:', error);
      res.status(500).json({ error: 'שגיאה ביצירת בקשה' });
    }
  },
);

/** POST /api/product-requests/:id/vote - Vote on request */
router.post(
  '/:id/vote',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const request = await ProductRequest.findById(req.params.id);

      if (!request) {
        res.status(404).json({ error: 'בקשה לא נמצאה' });
        return;
      }

      const alreadyVoted = request.votes.some((v) => v.toString() === userId);
      if (alreadyVoted) {
        // Remove vote
        await ProductRequest.findByIdAndUpdate(req.params.id, {
          $pull: { votes: userId },
          $inc: { voteCount: -1 },
        });
        res.json({ message: 'ההצבעה הוסרה', voted: false });
      } else {
        // Add vote
        await ProductRequest.findByIdAndUpdate(req.params.id, {
          $addToSet: { votes: userId },
          $inc: { voteCount: 1 },
        });
        res.json({ message: 'הצבעה נרשמה', voted: true });
      }
    } catch (error) {
      console.error('Vote error:', error);
      res.status(500).json({ error: 'שגיאה בהצבעה' });
    }
  },
);

/** POST /api/product-requests/:id/comment - Add comment */
router.post(
  '/:id/comment',
  authenticateToken,
  validateBody(['text']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const request = await ProductRequest.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            comments: {
              userId: req.user!.id,
              text: req.body.text,
            },
          },
        },
        { new: true },
      ).populate('comments.userId', 'firstName lastName');

      if (!request) {
        res.status(404).json({ error: 'בקשה לא נמצאה' });
        return;
      }

      res.json(request);
    } catch (error) {
      console.error('Comment error:', error);
      res.status(500).json({ error: 'שגיאה בהוספת תגובה' });
    }
  },
);

export default router;
