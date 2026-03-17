import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  conversationId: string; // format: userId_productId
  senderId: mongoose.Types.ObjectId | string;
  senderRole: 'user' | 'business';
  text: string;
  timestamp: Date;
  whatsappMsgId?: string;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    senderRole: { type: String, enum: ['user', 'business'], required: true },
    text: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
    whatsappMsgId: { type: String, default: null },
  },
  { timestamps: false },
);

ChatMessageSchema.index({ conversationId: 1, timestamp: 1 });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
