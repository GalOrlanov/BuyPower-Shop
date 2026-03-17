import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../types';
import { USER_ROLES } from '../constants/statuses';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  location: string;
  role: UserRole;
  totalSavings: number;
  referralCode: string;
  fcmToken?: string;
  recentlyViewed: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    location: { type: String, default: '' },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    totalSavings: { type: Number, default: 0 },
    referralCode: { type: String, unique: true },
    fcmToken: { type: String },
    recentlyViewed: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ referralCode: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
