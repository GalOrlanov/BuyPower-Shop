import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AuthRequest, UserRole } from '../../types';

/** Verify JWT token and attach user to request */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'אסימון גישה חסר' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as {
      id: string;
      email: string;
      role: UserRole;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'אסימון גישה לא תקין' });
  }
};

/** Require specific role(s) */
export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'אין הרשאה לפעולה זו' });
      return;
    }
    next();
  };
};
