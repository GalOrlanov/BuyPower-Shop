import mongoose, { Schema, Document } from 'mongoose';
import { PaymentStatus, PreAuthStatus } from '../types';
import { PAYMENT_STATUSES, PREAUTH_STATUSES } from '../constants/statuses';

export interface IParticipant extends Document {
  userId: mongoose.Types.ObjectId;
  groupPurchaseId: mongoose.Types.ObjectId;
  quantity: number;
  paymentStatus: PaymentStatus;
  paymentId?: mongoose.Types.ObjectId;

  // Pre-authorization fields (Grow credit hold — LEGACY)
  preAuthId?: string;
  preAuthAmount?: number;
  preAuthStatus?: PreAuthStatus;

  // Tranzila token-based pre-auth (used for group purchase joins)
  // After user submits card with tranmode=AK, Tranzila returns:
  //   - TranzilaTK: token representing the card (for later capture/void)
  //   - expdate: card expiry (MMYY) returned from Tranzila
  //   - confirmationCode: authorization number (needed for void/credit)
  tranzilaTK?: string;          // card token (TranzilaTK)
  tranzilaExpdate?: string;     // card expiry MMYY
  tranzilaConfirmCode?: string; // ConfirmationCode from AK transaction (needed for void)
  tranzilaHoldAmount?: number;  // amount that was held (may differ from final charge if price drops)

  joinedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  groupPurchaseId: { type: Schema.Types.ObjectId, ref: 'GroupPurchase', required: true },
  quantity: { type: Number, default: 1, min: 1 },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  // Legacy Grow pre-auth fields
  preAuthId: { type: String },
  preAuthAmount: { type: Number },
  preAuthStatus: { type: String, enum: PREAUTH_STATUSES },
  // Tranzila token-based pre-auth
  tranzilaTK: { type: String },
  tranzilaExpdate: { type: String },
  tranzilaConfirmCode: { type: String },
  tranzilaHoldAmount: { type: Number },
  joinedAt: { type: Date, default: Date.now },
});

ParticipantSchema.index({ userId: 1, groupPurchaseId: 1 }, { unique: true });
ParticipantSchema.index({ groupPurchaseId: 1 });

export const Participant = mongoose.model<IParticipant>('Participant', ParticipantSchema);
