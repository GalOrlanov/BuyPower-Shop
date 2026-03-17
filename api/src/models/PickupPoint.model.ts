import mongoose, { Schema, Document } from 'mongoose';

export interface IPickupPoint extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  address: string;
  collectionDate: Date | null;
  collectionTimeFrom: string; // "HH:MM"
  collectionTimeTo: string;   // "HH:MM"
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PickupPointSchema = new Schema<IPickupPoint>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    collectionDate: { type: Date, default: null },
    collectionTimeFrom: { type: String, default: '' },
    collectionTimeTo: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

PickupPointSchema.index({ businessId: 1 });

export const PickupPoint = mongoose.model<IPickupPoint>('PickupPoint', PickupPointSchema);
