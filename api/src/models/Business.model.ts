import mongoose, { Schema, Document } from 'mongoose';

export interface IBusiness extends Document {
  userId: mongoose.Types.ObjectId;
  businessName: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  whatsappPhone: string;
  logo: string;
  pickupAddress: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    whatsappPhone: { type: String, default: '' },
    logo: { type: String, default: '' },
    pickupAddress: { type: String, default: '' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

BusinessSchema.index({ userId: 1 });

export const Business = mongoose.model<IBusiness>('Business', BusinessSchema);
