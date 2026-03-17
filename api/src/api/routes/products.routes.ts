import { Router, Request, Response } from 'express';
import { Product } from '../../models/Product.model';
import { GroupPurchase } from '../../models/GroupPurchase.model';
import { Participant } from '../../models/Participant.model';
import { User } from '../../models/User.model';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthRequest } from '../../types';

const router = Router();

/** GET /api/products - List products with filters */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, page = '1', limit = '20' } = req.query;
    const filter: Record<string, unknown> = { isActive: true };

    if (category) filter.category = category;
    if (search) {
      filter.$text = { $search: search as string };
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('businessId', 'businessName logo rating')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת מוצרים' });
  }
});

/** GET /api/products/hot - Get top 10 trending products */
router.get('/hot', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get group purchases with most recent participants
    const hotPurchases = await GroupPurchase.find({ status: 'open' })
      .sort({ participantCount: -1, createdAt: -1 })
      .limit(10)
      .populate({
        path: 'productId',
        populate: { path: 'businessId', select: 'businessName logo rating' },
      });

    const products = hotPurchases.map((gp) => ({
      product: gp.productId,
      groupPurchase: {
        id: gp._id,
        status: gp.status,
        currentPrice: gp.currentPrice,
        participantCount: gp.participantCount,
        endDate: gp.endDate,
      },
    }));

    res.json(products);
  } catch (error) {
    console.error('Hot products error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת מוצרים חמים' });
  }
});

/** GET /api/products/:id - Get product details */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id).populate(
      'businessId',
      'businessName logo rating reviewCount description',
    );

    if (!product) {
      res.status(404).json({ error: 'מוצר לא נמצא' });
      return;
    }

    // Increment view count
    await Product.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    // Get active group purchase for this product
    const groupPurchase = await GroupPurchase.findOne({
      productId: product._id,
      status: { $in: ['open', 'waiting_for_demand'] },
    });

    res.json({ product, groupPurchase });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת מוצר' });
  }
});

/** POST /api/products/:id/view - Track product view for authenticated user */
router.post(
  '/:id/view',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const productId = req.params.id;

      // Add to recently viewed (keep last 10)
      await User.findByIdAndUpdate(userId, {
        $pull: { recentlyViewed: productId },
      });
      await User.findByIdAndUpdate(userId, {
        $push: { recentlyViewed: { $each: [productId], $position: 0, $slice: 10 } },
      });

      res.json({ message: 'ok' });
    } catch (error) {
      console.error('Track view error:', error);
      res.status(500).json({ error: 'שגיאה' });
    }
  },
);

export default router;
