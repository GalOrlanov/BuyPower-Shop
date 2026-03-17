import mongoose, { Schema, Document } from 'mongoose';
import { PaymentStatus, PreAuthStatus } from '../types';
import { PAYMENT_STATUSES, PREAUTH_STATUSES } from '../constants/statuses';

export interface IParticipant extends Document {
  userId: mongoose.Types.ObjectId;
  groupPurchaseId: mongoose.Types.ObjectId;
  quantity: number;
  paymentStatus: PaymentStatus;
  paymentId?: mongoose.Types.ObjectId;
  // Pre-authorization fields (Grow credit hold)
  preAuthId?: string;
  preAuthAmount?: number;
  preAuthStatus?: PreAuthStatus;
  joinedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  groupPurchaseId: { type: Schema.Types.ObjectId, ref: 'GroupPurchase', required: true },
  quantity: { type: Number, default: 1, min: 1 },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  // Pre-authorization (credit hold) — populated on join, captured or released when GP completes/fails
  preAuthId: { type: String },
  preAuthAmount: { type: Number },
  preAuthStatus: { type: String, enum: PREAUTH_STATUSES },
  joinedAt: { type: Date, default: Date.now },
});

ParticipantSchema.index({ userId: 1, groupPurchaseId: 1 }, { unique: true });
ParticipantSchema.index({ groupPurchaseId: 1 });

export const Participant = mongoose.model<IParticipant>('Participant', ParticipantSchema);
