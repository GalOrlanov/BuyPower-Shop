import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import productsRoutes from './products.routes';
import groupPurchasesRoutes from './groupPurchases.routes';
import businessesRoutes from './businesses.routes';
import reviewsRoutes from './reviews.routes';
import notificationsRoutes from './notifications.routes';
import productRequestsRoutes from './productRequests.routes';
import paymentsRoutes from './payments.routes';
import referralsRoutes from './referrals.routes';
import adminRoutes from './admin.routes';
import chatRoutes from './chat.routes';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ordersRoutes = require('./orders.routes');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shopRoutes = require('./shop.routes');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shopGroupRoutes = require('./shop-group-purchases.routes');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shopGroupCronRoutes = require('./shop-group-cron.routes');
import { seedDatabase } from '../../seeds/seed';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/products', productsRoutes);
router.use('/group-purchases', groupPurchasesRoutes);
router.use('/business', businessesRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/product-requests', productRequestsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/referrals', referralsRoutes);
router.use('/admin', adminRoutes);
router.use('/chat', chatRoutes);
router.use('/orders', ordersRoutes);
router.use('/shop', shopRoutes);
router.use('/shop', shopGroupRoutes);
router.use('/shop', shopGroupCronRoutes);

/** POST /api/seed - Seed database with demo data */
router.post('/seed', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await seedDatabase();
    res.json({ message: 'Database seeded successfully', ...result });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database' });
  }
});

export default router;
