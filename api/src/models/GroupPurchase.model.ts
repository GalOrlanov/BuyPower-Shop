import mongoose, { Schema, Document } from 'mongoose';
import { GroupPurchaseStatus } from '../types';
import { GROUP_PURCHASE_STATUSES } from '../constants/statuses';

export interface IGroupPurchase extends Document {
  productId: mongoose.Types.ObjectId;
  pickupPointId: mongoose.Types.ObjectId | null;
  status: GroupPurchaseStatus;
  currentPrice: number;
  participantCount: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GroupPurchaseSchema = new Schema<IGroupPurchase>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    pickupPointId: { type: Schema.Types.ObjectId, ref: 'PickupPoint', default: null },
    status: { type: String, enum: GROUP_PURCHASE_STATUSES, default: 'open' },
    currentPrice: { type: Number, required: true },
    participantCount: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
  },
  { timestamps: true },
);

GroupPurchaseSchema.index({ productId: 1 });
GroupPurchaseSchema.index({ status: 1 });
GroupPurchaseSchema.index({ endDate: 1 });

export const GroupPurchase = mongoose.model<IGroupPurchase>('GroupPurchase', GroupPurchaseSchema);
