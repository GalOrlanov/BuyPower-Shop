import mongoose, { Schema, Document } from 'mongoose';
import { PaymentProviderStatus } from '../types';
import { PAYMENT_PROVIDER_STATUSES } from '../constants/statuses';

export interface IPayment extends Document {
  participantId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  provider: string;
  transactionId: string;
  status: PaymentProviderStatus;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'ILS' },
  provider: { type: String, enum: ['payplus', 'tranzila', 'mock'], default: 'mock' },
  transactionId: { type: String, default: '' },
  status: { type: String, enum: PAYMENT_PROVIDER_STATUSES, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

PaymentSchema.index({ participantId: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
