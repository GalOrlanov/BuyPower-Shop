import { Request } from 'express';
import { Types } from 'mongoose';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export type UserRole = 'user' | 'business' | 'admin';

export type GroupPurchaseStatus =
  | 'waiting_for_demand'
  | 'in_negotiation'
  | 'open'
  | 'closed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'preauth' | 'authorized' | 'charged' | 'refunded' | 'released';

export type PreAuthStatus = 'pending' | 'captured' | 'released' | 'failed';

export type PaymentProviderStatus = 'pending' | 'success' | 'failed' | 'refunded';

export type NotificationType =
  | 'price_drop'
  | 'closing_soon'
  | 'spots_left'
  | 'new_purchase'
  | 'demand'
  | 'purchase_closed';

export type ProductRequestStatus = 'open' | 'fulfilled' | 'closed';

export type ReferralStatus = 'pending' | 'credited';

export interface PriceTier {
  minBuyers: number;
  price: number;
}

export interface Comment {
  userId: Types.ObjectId;
  text: string;
  createdAt: Date;
}
