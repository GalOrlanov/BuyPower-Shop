import mongoose, { Schema, Document } from 'mongoose';
import { PriceTier } from '../types';
import { Category, CATEGORIES } from '../constants/categories';

export interface IProduct extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  images: string[];
  category: Category;
  priceTiers: PriceTier[];
  originalPrice: number;
  maxBuyers: number;
  minBuyers: number;
  deliveryTerms: string;
  cancellationTerms: string;
  cancelPolicy: string;
  shippingPrice: number;
  shippingTime: string;
  isActive: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PriceTierSchema = new Schema<PriceTier>(
  {
    minBuyers: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false },
);

const ProductSchema = new Schema<IProduct>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    images: [{ type: String }],
    category: { type: String, enum: CATEGORIES, required: true },
    priceTiers: { type: [PriceTierSchema], required: true },
    originalPrice: { type: Number, required: true },
    maxBuyers: { type: Number, required: true },
    minBuyers: { type: Number, required: true, default: 1 },
    deliveryTerms: { type: String, default: '' },
    cancellationTerms: { type: String, default: '' },
    cancelPolicy: { type: String, default: '' },
    shippingPrice: { type: Number, default: 0 },
    shippingTime: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ProductSchema.index({ businessId: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
