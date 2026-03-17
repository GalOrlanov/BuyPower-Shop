import axios from 'axios';

const OPENCLAW_HOOK_URL = 'http://127.0.0.1:18789/hooks/agent';
const OPENCLAW_HOOK_TOKEN = '89a9a234111fb1850bb474d05d4bf084a23d9b18';

/**
 * Send an order confirmation via WhatsApp using OpenClaw webhook
 */
export const sendOrderConfirmation = async (params: {
  phone: string;
  firstName: string;
  items: { name: string; quantity: number }[];
  totalAmount: number;
  pickupAddress: string;
}): Promise<void> => {
  const { phone, firstName, items, totalAmount, pickupAddress } = params;

  const itemLines = items
    .map((item) => `• ${item.name} × ${item.quantity}`)
    .join('\n');

  const message = `Send this exact WhatsApp message to ${phone}, no changes, no additions:

שלום ${firstName}! 👋

📦 ההזמנה שלך:
${itemLines}

💰 סה"כ: ₪${totalAmount}
📍 ${pickupAddress}`;

  try {
    await axios.post(
      OPENCLAW_HOOK_URL,
      {
        message,
        channel: 'whatsapp',
        to: phone,
        deliver: true,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENCLAW_HOOK_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );
    console.log(`[WhatsApp] Order confirmation sent to ${phone}`);
  } catch (err: any) {
    console.error('[WhatsApp] Failed to send order confirmation:', err?.message);
    // Don't throw — notification failure shouldn't block the order
  }
};
