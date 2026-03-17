import { Router, Response } from 'express';
import { Business } from '../../models/Business.model';
import { Product } from '../../models/Product.model';
import { GroupPurchase } from '../../models/GroupPurchase.model';
import { PickupPoint } from '../../models/PickupPoint.model';
import { Participant } from '../../models/Participant.model';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { AuthRequest } from '../../types';

const router = Router();

/** POST /api/business/products - Add product */
router.post(
  '/products',
  authenticateToken,
  requireRole('business'),
  validateBody(['name', 'category', 'priceTiers', 'originalPrice', 'maxBuyers']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) {
        res.status(404).json({ error: 'חשבון עסקי לא נמצא' });
        return;
      }
      if (business.isBlocked) {
        res.status(403).json({ error: 'חשבון עסקי חסום' });
        return;
      }

      const product = await Product.create({
        businessId: business._id,
        ...req.body,
        minBuyers: req.body.minBuyers || 1,
      });

      res.status(201).json(product);
    } catch (error) {
      console.error('Add product error:', error);
      res.status(500).json({ error: 'שגיאה בהוספת מוצר' });
    }
  },
);

/** PUT /api/business/products/:id - Edit product (price only downward) */
router.put(
  '/products/:id',
  authenticateToken,
  requireRole('business'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) {
        res.status(404).json({ error: 'חשבון עסקי לא נמצא' });
        return;
      }

      const product = await Product.findOne({ _id: req.params.id, businessId: business._id });
      if (!product) {
        res.status(404).json({ error: 'מוצר לא נמצא' });
        return;
      }

      // Validate price only goes down
      if (req.body.priceTiers) {
        for (const newTier of req.body.priceTiers) {
          const oldTier = product.priceTiers.find((t) => t.minBuyers === newTier.minBuyers);
          if (oldTier && newTier.price > oldTier.price) {
            res.status(400).json({ error: 'ניתן לעדכן מחיר רק כלפי מטה' });
            return;
          }
        }
      }

      const allowedFields = [
        'name', 'description', 'images', 'priceTiers', 'maxBuyers',
        'deliveryTerms', 'cancellationTerms', 'cancelPolicy', 'shippingPrice', 'shippingTime',
      ];
      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const updated = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
      res.json(updated);
    } catch (error) {
      console.error('Edit product error:', error);
      res.status(500).json({ error: 'שגיאה בעדכון מוצר' });
    }
  },
);

/** GET /api/business/products - List my products */
router.get(
  '/products',
  authenticateToken,
  requireRole('business'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) {
        res.status(404).json({ error: 'חשבון עסקי לא נמצא' });
        return;
      }

      const products = await Product.find({ businessId: business._id }).sort({ createdAt: -1 });
      res.json(products);
    } catch (error) {
      console.error('List business products error:', error);
      res.status(500).json({ error: 'שגיאה בטעינת מוצרים' });
    }
  },
);

/** GET /api/business/analytics - Get analytics */
router.get(
  '/analytics',
  authenticateToken,
  requireRole('business'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) {
        res.status(404).json({ error: 'חשבון עסקי לא נמצא' });
        return;
      }

      const products = await Product.find({ businessId: business._id });
      const productIds = products.map((p) => p._id);

      const totalViews = products.reduce((sum, p) => sum + p.viewCount, 0);

      const groupPurchases = await GroupPurchase.find({ productId: { $in: productIds } });
      const closedDeals = groupPurchases.filter((gp) => gp.status === 'closed').length;
      const totalParticipants = groupPurchases.reduce((sum, gp) => sum + gp.participantCount, 0);

      res.json({
        totalProducts: products.length,
        totalViews,
        totalParticipants,
        closedDeals,
        activeGroupPurchases: groupPurchases.filter((gp) => gp.status === 'open').length,
      });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ error: 'שגיאה בטעינת נתונים' });
    }
  },
);

/** POST /api/business/group-purchases - Create group purchase for a product */
router.post(
  '/group-purchases',
  authenticateToken,
  requireRole('business'),
  validateBody(['productId', 'endDate']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) {
        res.status(404).json({ error: 'חשבון עסקי לא נמצא' });
        return;
      }

      const product = await Product.findOne({ _id: req.body.productId, businessId: business._id });
      if (!product) {
        res.status(404).json({ error: 'מוצר לא נמצא' });
        return;
      }

      // Check no active group purchase exists for this product
      const existing = await GroupPurchase.findOne({
        productId: product._id,
        status: { $in: ['open', 'waiting_for_demand', 'in_negotiation'] },
      });
      if (existing) {
        res.status(409).json({ error: 'כבר קיימת רכישה קבוצתית פעילה למוצר זה' });
        return;
      }

      // Validate pickupPointId if provided
      if (req.body.pickupPointId) {
        const pp = await PickupPoint.findOne({ _id: req.body.pickupPointId, businessId: business._id });
        if (!pp) {
          res.status(404).json({ error: 'נקודת האיסוף לא נמצאה' });
          return;
        }
      }

      // Initial price is the highest tier (fewest buyers)
      const sortedTiers = [...product.priceTiers].sort((a, b) => a.minBuyers - b.minBuyers);
      const initialPrice = sortedTiers[0]?.price || product.originalPrice;

      const groupPurchase = await GroupPurchase.create({
        productId: product._id,
        pickupPointId: req.body.pickupPointId || null,
        currentPrice: initialPrice,
        endDate: new Date(req.body.endDate),
        status: 'open',
      });

      res.status(201).json(groupPurchase);
    } catch (error) {
      console.error('Create group purchase error:', error);
      res.status(500).json({ error: 'שגיאה ביצירת רכישה קבוצתית' });
    }
  },
);

// ─── Pickup Points ─────────────────────────────────────────────────────────────

/** GET /api/business/pickup-points - List my pickup points */
router.get(
  '/pickup-points',
  authenticateToken,
  requireRole('business'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) { res.status(404).json({ error: 'חשבון עסקי לא נמצא' }); return; }
      const points = await PickupPoint.find({ businessId: business._id }).sort({ createdAt: -1 });
      res.json(points);
    } catch (error) {
      console.error('List pickup points error:', error);
      res.status(500).json({ error: 'שגיאה בטעינת נקודות איסוף' });
    }
  },
);

/** POST /api/business/pickup-points - Create pickup point */
router.post(
  '/pickup-points',
  authenticateToken,
  requireRole('business'),
  validateBody(['name']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) { res.status(404).json({ error: 'חשבון עסקי לא נמצא' }); return; }

      const { name, address, collectionDate, collectionTimeFrom, collectionTimeTo } = req.body;
      const point = await PickupPoint.create({
        businessId: business._id,
        name,
        address: address || '',
        collectionDate: collectionDate ? new Date(collectionDate) : null,
        collectionTimeFrom: collectionTimeFrom || '',
        collectionTimeTo: collectionTimeTo || '',
      });
      res.status(201).json(point);
    } catch (error) {
      console.error('Create pickup point error:', error);
      res.status(500).json({ error: 'שגיאה ביצירת נקודת איסוף' });
    }
  },
);

/** PATCH /api/business/pickup-points/:id - Update pickup point */
router.patch(
  '/pickup-points/:id',
  authenticateToken,
  requireRole('business'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) { res.status(404).json({ error: 'חשבון עסקי לא נמצא' }); return; }

      const point = await PickupPoint.findOne({ _id: req.params.id, businessId: business._id });
      if (!point) { res.status(404).json({ error: 'נקודת איסוף לא נמצאה' }); return; }

      const allowed = ['name', 'address', 'collectionDate', 'collectionTimeFrom', 'collectionTimeTo', 'isActive'];
      const updates: Record<string, unknown> = {};
      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          if (field === 'collectionDate') {
            updates[field] = req.body[field] ? new Date(req.body[field]) : null;
          } else {
            updates[field] = req.body[field];
          }
        }
      }

      const updated = await PickupPoint.findByIdAndUpdate(req.params.id, updates, { new: true });
      res.json(updated);
    } catch (error) {
      console.error('Update pickup point error:', error);
      res.status(500).json({ error: 'שגיאה בעדכון נקודת איסוף' });
    }
  },
);

/** DELETE /api/business/pickup-points/:id - Delete pickup point */
router.delete(
  '/pickup-points/:id',
  authenticateToken,
  requireRole('business'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) { res.status(404).json({ error: 'חשבון עסקי לא נמצא' }); return; }

      const point = await PickupPoint.findOneAndDelete({ _id: req.params.id, businessId: business._id });
      if (!point) { res.status(404).json({ error: 'נקודת איסוף לא נמצאה' }); return; }

      // Unlink from group purchases
      await GroupPurchase.updateMany({ pickupPointId: point._id }, { $set: { pickupPointId: null } });

      res.json({ message: 'נקודת האיסוף נמחקה' });
    } catch (error) {
      console.error('Delete pickup point error:', error);
      res.status(500).json({ error: 'שגיאה במחיקת נקודת איסוף' });
    }
  },
);

/** PATCH /api/business/group-purchases/:id/pickup - Assign/update pickup point on existing GP */
router.patch(
  '/group-purchases/:id/pickup',
  authenticateToken,
  requireRole('business'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) { res.status(404).json({ error: 'חשבון עסקי לא נמצא' }); return; }

      // Verify this GP belongs to the business
      const products = await Product.find({ businessId: business._id }).select('_id');
      const productIds = products.map(p => p._id);
      const gp = await GroupPurchase.findOne({ _id: req.params.id, productId: { $in: productIds } });
      if (!gp) { res.status(404).json({ error: 'רכישה קבוצתית לא נמצאה' }); return; }

      const { pickupPointId } = req.body;
      if (pickupPointId) {
        const pp = await PickupPoint.findOne({ _id: pickupPointId, businessId: business._id });
        if (!pp) { res.status(404).json({ error: 'נקודת האיסוף לא נמצאה' }); return; }
      }

      const updated = await GroupPurchase.findByIdAndUpdate(
        req.params.id,
        { pickupPointId: pickupPointId || null },
        { new: true },
      ).populate('pickupPointId');

      res.json(updated);
    } catch (error) {
      console.error('Assign pickup point error:', error);
      res.status(500).json({ error: 'שגיאה בעדכון נקודת איסוף' });
    }
  },
);

/** GET /api/business/orders - Get all group purchases with participant details */
router.get(
  '/orders',
  authenticateToken,
  requireRole('business'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ userId: req.user!.id });
      if (!business) {
        res.status(404).json({ error: 'חשבון עסקי לא נמצא' });
        return;
      }

      const { from, to } = req.query as { from?: string; to?: string };

      const products = await Product.find({ businessId: business._id }).lean();
      const productIds = products.map((p) => p._id);

      // Build date filter for GroupPurchase.createdAt
      const dateFilter: Record<string, unknown> = {};
      if (from) dateFilter.$gte = new Date(from as string);
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = toDate;
      }

      const gpQuery: Record<string, unknown> = { productId: { $in: productIds } };
      if (from || to) gpQuery.createdAt = dateFilter;

      const groupPurchases = await GroupPurchase.find(gpQuery).lean();
      const gpIds = groupPurchases.map((gp) => gp._id);

      const participants = await Participant.find({ groupPurchaseId: { $in: gpIds } })
        .populate('userId', 'firstName lastName phone email')
        .lean();

      // Build product map
      const productMap: Record<string, unknown> = {};
      for (const p of products) {
        productMap[String(p._id)] = p;
      }

      // Build GP map with participants
      const gpMap: Record<string, unknown[]> = {};
      for (const part of participants) {
        const gpId = String(part.groupPurchaseId);
        if (!gpMap[gpId]) gpMap[gpId] = [];
        gpMap[gpId].push(part);
      }

      // Assemble orders response
      const orders = groupPurchases.map((gp) => {
        const product = productMap[String(gp.productId)] as any;
        const gpParticipants = (gpMap[String(gp._id)] || []) as any[];
        const totalQuantity = gpParticipants.reduce((s: number, p: any) => s + (p.quantity || 1), 0);
        const totalRevenue = totalQuantity * (gp.currentPrice || 0);

        return {
          _id: gp._id,
          status: gp.status,
          currentPrice: gp.currentPrice,
          participantCount: gp.participantCount,
          startDate: gp.startDate,
          endDate: gp.endDate,
          createdAt: (gp as any).createdAt,
          product: product
            ? {
                _id: product._id,
                name: product.name,
                category: product.category,
                originalPrice: product.originalPrice,
                images: product.images,
              }
            : null,
          totalQuantity,
          totalRevenue,
          participants: gpParticipants.map((p: any) => ({
            _id: p._id,
            quantity: p.quantity || 1,
            paymentStatus: p.paymentStatus,
            joinedAt: p.joinedAt,
            totalPaid: (p.quantity || 1) * gp.currentPrice,
            user: p.userId
              ? {
                  firstName: (p.userId as any).firstName,
                  lastName: (p.userId as any).lastName,
                  phone: (p.userId as any).phone,
                  email: (p.userId as any).email,
                }
              : null,
          })),
        };
      });

      res.json(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'שגיאה בטעינת הזמנות' });
    }
  },
);

export default router;
