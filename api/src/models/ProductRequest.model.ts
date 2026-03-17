import mongoose, { Schema, Document } from 'mongoose';
import { ProductRequestStatus, Comment } from '../types';
import { PRODUCT_REQUEST_STATUSES } from '../constants/statuses';

export interface IProductRequest extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  voteCount: number;
  votes: mongoose.Types.ObjectId[];
  comments: Comment[];
  status: ProductRequestStatus;
  createdAt: Date;
}

const CommentSchema = new Schema<Comment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ProductRequestSchema = new Schema<IProductRequest>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'other' },
  voteCount: { type: Number, default: 0 },
  votes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments: [CommentSchema],
  status: { type: String, enum: PRODUCT_REQUEST_STATUSES, default: 'open' },
  createdAt: { type: Date, default: Date.now },
});

ProductRequestSchema.index({ status: 1 });
ProductRequestSchema.index({ voteCount: -1 });

export const ProductRequest = mongoose.model<IProductRequest>(
  'ProductRequest',
  ProductRequestSchema,
);
