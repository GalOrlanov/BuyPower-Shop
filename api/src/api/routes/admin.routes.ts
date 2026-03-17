import { Router, Response } from 'express';
import { AuthRequest } from '../../types';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { User } from '../../models/User.model';
import { Business } from '../../models/Business.model';
import { Product } from '../../models/Product.model';
import { GroupPurchase } from '../../models/GroupPurchase.model';
import { Payment } from '../../models/Payment.model';

const router = Router();
router.use(authenticateToken, requireRole('admin'));

/** GET /api/admin/stats — Platform overview */
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers, totalBusinesses, totalProducts,
      totalGroupPurchases, activeDeals, completedDeals,
      payments
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Business.countDocuments(),
      Product.countDocuments(),
      GroupPurchase.countDocuments(),
      GroupPurchase.countDocuments({ status: 'open' }),
      GroupPurchase.countDocuments({ status: 'closed' }),
      Payment.find({ status: 'charged' }),
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const blockedBusinesses = await Business.countDocuments({ isBlocked: true });

    res.json({
      totalUsers,
      totalBusinesses,
      blockedBusinesses,
      totalProducts,
      totalGroupPurchases,
      activeDeals,
      completedDeals,
      totalRevenue,
      totalTransactions: payments.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/** GET /api/admin/businesses — All businesses with details */
router.get('/businesses', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const filter: any = {};
    if (search) filter.businessName = { $regex: search, $options: 'i' };

    const businesses = await Business.find(filter)
      .populate('userId', 'firstName lastName email phone createdAt isActive')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Attach product/deal counts
    const enriched = await Promise.all(businesses.map(async (b) => {
      const [productCount, activeDeals, totalRevenue] = await Promise.all([
        Product.countDocuments({ businessId: b._id }),
        GroupPurchase.countDocuments({ businessId: b._id, status: 'open' }),
        Payment.aggregate([
          { $match: { businessId: b._id, status: 'charged' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
      ]);
      return {
        ...b,
        productCount,
        activeDeals,
        totalRevenue: totalRevenue[0]?.total || 0,
      };
    }));

    const total = await Business.countDocuments(filter);
    res.json({ businesses: enriched, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/** PATCH /api/admin/businesses/:id/block — Block/unblock business */
router.patch('/businesses/:id/block', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) { res.status(404).json({ error: 'עסק לא נמצא' }); return; }

    business.isBlocked = !business.isBlocked;
    await business.save();

    // Also freeze/activate the user
    await User.findByIdAndUpdate(business.userId, { isActive: !business.isBlocked });

    res.json({ success: true, isBlocked: business.isBlocked });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/** PATCH /api/admin/businesses/:id/verify — Verify business */
router.patch('/businesses/:id/verify', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) { res.status(404).json({ error: 'עסק לא נמצא' }); return; }
    business.isVerified = !business.isVerified;
    await business.save();
    res.json({ success: true, isVerified: business.isVerified });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/** DELETE /api/admin/businesses/:id — Delete business + products */
router.delete('/businesses/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) { res.status(404).json({ error: 'עסק לא נמצא' }); return; }

    await Promise.all([
      Product.deleteMany({ businessId: business._id }),
      GroupPurchase.deleteMany({ businessId: business._id }),
      Business.findByIdAndDelete(business._id),
      User.findByIdAndDelete(business.userId),
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/** GET /api/admin/products — All products */
router.get('/products', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const filter: any = {};
    if (search) filter.name = { $regex: search, $options: 'i' };

    const products = await Product.find(filter)
      .populate('businessId', 'businessName logo')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(filter);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/** DELETE /api/admin/products/:id */
router.delete('/products/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/** PATCH /api/admin/products/:id/toggle — Activate/deactivate product */
router.patch('/products/:id/toggle', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ error: 'מוצר לא נמצא' }); return; }
    (product as any).isActive = !(product as any).isActive;
    await product.save();
    res.json({ success: true, isActive: (product as any).isActive });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/** GET /api/admin/users — All users */
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const total = await User.countDocuments();
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

export default router;
