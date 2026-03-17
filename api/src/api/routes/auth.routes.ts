import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../models/User.model';
import { Referral } from '../../models/Referral.model';
import { env } from '../../config/env';
import { validateBody, isValidEmail, isValidPhone, isValidPassword } from '../middleware/validation.middleware';
import { authLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

/** POST /api/auth/register - Register new user */
router.post(
  '/register',
  authLimiter,
  validateBody(['firstName', 'lastName', 'email', 'phone', 'password']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { firstName, lastName, email, phone, password, location, referralCode } = req.body;

      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'כתובת מייל לא תקינה' });
        return;
      }
      if (!isValidPhone(phone)) {
        res.status(400).json({ error: 'מספר טלפון לא תקין' });
        return;
      }
      if (!isValidPassword(password)) {
        res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
        return;
      }

      const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
      if (existingUser) {
        res.status(409).json({ error: 'משתמש עם מייל או טלפון זה כבר קיים' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userReferralCode = uuidv4().slice(0, 8).toUpperCase();

      const user = await User.create({
        firstName,
        lastName,
        email,
        phone,
        password: hashedPassword,
        location: location || '',
        referralCode: userReferralCode,
      });

      // Handle referral if code provided
      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer) {
          await Referral.create({
            referrerId: referrer._id,
            referredId: user._id,
            bonusAmount: 10,
          });
        }
      }

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        env.jwtSecret,
        { expiresIn: 3600 },
      );
      const refreshToken = jwt.sign(
        { id: user._id },
        env.jwtRefreshSecret,
        { expiresIn: 604800 },
      );

      res.status(201).json({
        token,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          referralCode: user.referralCode,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'שגיאה בהרשמה' });
    }
  },
);

/** POST /api/auth/login - Login */
router.post(
  '/login',
  authLimiter,
  validateBody(['email', 'password']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        res.status(401).json({ error: 'מייל או סיסמה שגויים' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.status(401).json({ error: 'מייל או סיסמה שגויים' });
        return;
      }

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        env.jwtSecret,
        { expiresIn: 3600 },
      );
      const refreshToken = jwt.sign(
        { id: user._id },
        env.jwtRefreshSecret,
        { expiresIn: 604800 },
      );

      res.json({
        token,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          totalSavings: user.totalSavings,
          referralCode: user.referralCode,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'שגיאה בהתחברות' });
    }
  },
);

/** POST /api/auth/refresh-token - Refresh JWT */
router.post('/refresh-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'אסימון רענון חסר' });
      return;
    }

    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      res.status(403).json({ error: 'אסימון לא תקין' });
      return;
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      env.jwtSecret,
      { expiresIn: 3600 },
    );

    res.json({ token });
  } catch {
    res.status(403).json({ error: 'אסימון רענון לא תקין' });
  }
});

/** POST /api/auth/forgot-password - Send reset email */
router.post(
  '/forgot-password',
  authLimiter,
  validateBody(['email']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });

      // Always respond with success to prevent email enumeration
      if (!user) {
        res.json({ message: 'אם המייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה' });
        return;
      }

      const resetToken = jwt.sign({ id: user._id }, env.jwtSecret, { expiresIn: 3600 });

      // TODO: Send email with reset link using email service
      console.log(`Reset token for ${email}: ${resetToken}`);

      res.json({ message: 'אם המייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'שגיאה בשליחת מייל איפוס' });
    }
  },
);

/** POST /api/auth/reset-password - Reset password with token */
router.post(
  '/reset-password',
  validateBody(['token', 'password']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, password } = req.body;

      if (!isValidPassword(password)) {
        res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
        return;
      }

      const decoded = jwt.verify(token, env.jwtSecret) as { id: string };
      const hashedPassword = await bcrypt.hash(password, 10);

      await User.findByIdAndUpdate(decoded.id, { password: hashedPassword });

      res.json({ message: 'הסיסמה אופסה בהצלחה' });
    } catch {
      res.status(400).json({ error: 'קישור איפוס לא תקין או שפג תוקפו' });
    }
  },
);

export default router;
