import mongoose, { Schema, Document } from 'mongoose';
import { ReferralStatus } from '../types';
import { REFERRAL_STATUSES } from '../constants/statuses';

export interface IReferral extends Document {
  referrerId: mongoose.Types.ObjectId;
  referredId: mongoose.Types.ObjectId;
  bonusAmount: number;
  status: ReferralStatus;
  createdAt: Date;
}

const ReferralSchema = new Schema<IReferral>({
  referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  referredId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bonusAmount: { type: Number, default: 10 },
  status: { type: String, enum: REFERRAL_STATUSES, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

ReferralSchema.index({ referrerId: 1 });

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
