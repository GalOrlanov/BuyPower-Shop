import { Router, Request, Response } from 'express';
import { Review } from '../../models/Review.model';
import { Business } from '../../models/Business.model';
import { Participant } from '../../models/Participant.model';
import { GroupPurchase } from '../../models/GroupPurchase.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { AuthRequest } from '../../types';

const router = Router();

/** POST /api/reviews - Create review (must have completed purchase) */
router.post(
  '/',
  authenticateToken,
  validateBody(['rating']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { productId, businessId, rating, text } = req.body;
      const userId = req.user!.id;

      if (!productId && !businessId) {
        res.status(400).json({ error: 'נדרש מזהה מוצר או עסק' });
        return;
      }

      // Verify user participated in a closed purchase of this product
      if (productId) {
        const gps = await GroupPurchase.find({ productId, status: 'closed' });
        const gpIds = gps.map((gp) => gp._id);
        const participated = await Participant.findOne({
          userId,
          groupPurchaseId: { $in: gpIds },
        });
        if (!participated) {
          res.status(403).json({ error: 'ניתן לדרג רק לאחר רכישה' });
          return;
        }
      }

      const review = await Review.create({ userId, productId, businessId, rating, text });

      // Update business average rating
      if (businessId) {
        const reviews = await Review.find({ businessId });
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        await Business.findByIdAndUpdate(businessId, {
          rating: Math.round(avgRating * 10) / 10,
          reviewCount: reviews.length,
        });
      }

      res.status(201).json(review);
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({ error: 'שגיאה ביצירת ביקורת' });
    }
  },
);

/** GET /api/reviews/product/:id - Get product reviews */
router.get('/product/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const reviews = await Review.find({ productId: req.params.id })
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ביקורות' });
  }
});

/** GET /api/reviews/business/:id - Get business reviews */
router.get('/business/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const reviews = await Review.find({ businessId: req.params.id })
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error('Get business reviews error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ביקורות' });
  }
});

export default router;
