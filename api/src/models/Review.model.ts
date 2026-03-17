import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  userId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  businessId?: mongoose.Types.ObjectId;
  rating: number;
  text: string;
  createdAt: Date;
}

const ReviewSchema = new Schema<IReview>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  businessId: { type: Schema.Types.ObjectId, ref: 'Business' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

ReviewSchema.index({ productId: 1 });
ReviewSchema.index({ businessId: 1 });
ReviewSchema.index({ userId: 1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
