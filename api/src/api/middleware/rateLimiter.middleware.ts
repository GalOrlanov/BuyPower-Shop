import rateLimit from 'express-rate-limit';

/** General API rate limiter */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
  skip: (req) => req.path.includes('/payment/create'),
});

/** Stricter rate limiter for auth endpoints */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'יותר מדי ניסיונות התחברות, נסה שוב מאוחר יותר' },
});
