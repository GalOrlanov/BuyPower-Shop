import { Request, Response, NextFunction } from 'express';

/** Validate required fields exist in request body */
export const validateBody = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = requiredFields.filter((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      res.status(400).json({
        error: 'שדות חובה חסרים',
        fields: missing,
      });
      return;
    }
    next();
  };
};

/** Validate email format */
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/** Validate Israeli phone format */
export const isValidPhone = (phone: string): boolean => {
  return /^0[2-9]\d{7,8}$/.test(phone.replace(/[-\s]/g, ''));
};

/** Validate password strength */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};
