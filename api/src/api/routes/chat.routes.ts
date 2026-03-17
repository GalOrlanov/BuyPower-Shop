import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthRequest } from '../../types';
import { ChatMessage } from '../../models/ChatMessage.model';
import { Business } from '../../models/Business.model';
import { Product } from '../../models/Product.model';
import mongoose from 'mongoose';

const router = Router();

// Build conversationId from userId + productId (consistent format)
function buildConversationId(userId: string, productId: string): string {
  return `${userId}_${productId}`;
}

/**
 * GET /api/chat/:productId
 * Get conversation messages for the authenticated user + product combo
 */
router.get('/:productId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const productId = req.params.productId as string;

    const conversationId = buildConversationId(userId, productId);

    const messages = await ChatMessage.find({ conversationId })
      .sort({ timestamp: 1 })
      .lean();

    res.json({ messages });
  } catch (error) {
    console.error('GET /chat/:productId error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת השיחה' });
  }
});

/**
 * POST /api/chat/:productId
 * Customer sends a message → saved to DB → (TODO) forwarded to business via WhatsApp
 */
router.post('/:productId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const productId = req.params.productId as string;
    const { text } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'הודעה ריקה' });
      return;
    }

    const conversationId = buildConversationId(userId, productId);

    const message = new ChatMessage({
      conversationId,
      senderId: new mongoose.Types.ObjectId(userId),
      senderRole: 'user',
      text: text.trim(),
      timestamp: new Date(),
    });

    await message.save();

    // TODO: Forward message to business via WhatsApp Business API (Meta Cloud API)
    // Find business phone from product
    try {
      const product = await Product.findById(productId).populate('businessId').lean();
      if (product) {
        const business = await Business.findOne({
          userId: (product as any).businessId?._id || (product as any).businessId,
        }).lean();
        const businessPhone = (business as any)?.whatsappPhone || (business as any)?.contactPhone;
        if (businessPhone) {
          console.log(`TODO: forward to WhatsApp: ${businessPhone}`, {
            conversationId,
            text: text.trim(),
            customerUserId: userId,
          });
          // TODO: call Meta Cloud API here:
          // POST https://graph.facebook.com/v18.0/{phone-number-id}/messages
          // Authorization: Bearer {WHATSAPP_TOKEN}
          // body: { messaging_product: 'whatsapp', to: businessPhone, type: 'text', text: { body: text } }
        }
      }
    } catch (fwdErr) {
      // Non-fatal — message is saved, WhatsApp forward is best-effort
      console.error('WhatsApp forward lookup error:', fwdErr);
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('POST /chat/:productId error:', error);
    res.status(500).json({ error: 'שגיאה בשליחת ההודעה' });
  }
});

/**
 * GET /api/chat/webhook
 * WhatsApp hub.challenge verification (Meta requirement)
 */
router.get('/webhook', (req: AuthRequest, res: Response): void => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'buypower_verify_token';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

/**
 * POST /api/chat/webhook
 * WhatsApp Business webhook: receives reply from business → saves as business message in DB.
 */
router.post('/webhook', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Acknowledge immediately (Meta requires 200 within 20s)
    res.sendStatus(200);

    const body = req.body;

    // Meta webhook structure: body.entry[].changes[].value.messages[]
    if (body.object !== 'whatsapp_business_account') return;

    const entries: any[] = body.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value;
        const messages: any[] = value?.messages || [];

        for (const msg of messages) {
          if (msg.type !== 'text') continue;

          const whatsappMsgId: string = msg.id;
          const incomingText: string = msg.text?.body;
          const fromPhone: string = msg.from;

          // Try to find the conversationId via the replied-to message's whatsappMsgId
          const contextId: string | undefined = msg.context?.id;
          let conversationId: string | null = null;

          if (contextId) {
            const originalMsg = await ChatMessage.findOne({ whatsappMsgId: contextId }).lean();
            if (originalMsg) {
              conversationId = originalMsg.conversationId;
            }
          }

          // Fallback: find most recent user conversation for this business
          if (!conversationId && fromPhone) {
            const business = await Business.findOne({
              $or: [{ whatsappPhone: fromPhone }, { contactPhone: fromPhone }],
            }).lean();
            if (business) {
              const latestMsg = await ChatMessage.findOne({ senderRole: 'user' })
                .sort({ timestamp: -1 })
                .lean();
              if (latestMsg) conversationId = latestMsg.conversationId;
            }
          }

          if (!conversationId || !incomingText) continue;

          // Find business senderId
          const business = await Business.findOne({
            $or: [{ whatsappPhone: fromPhone }, { contactPhone: fromPhone }],
          }).lean();

          await ChatMessage.create({
            conversationId,
            senderId: (business as any)?._id || new mongoose.Types.ObjectId(),
            senderRole: 'business',
            text: incomingText,
            timestamp: new Date(parseInt(msg.timestamp, 10) * 1000),
            whatsappMsgId,
          });

          console.log(`Saved business reply to conversation ${conversationId}`);
        }
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
  }
});

export default router;
