import axios from 'axios';
import { env } from '../config/env';

const GROW_API_URL = 'https://api.grow.co.il/v1';

interface GrowPaymentResponse {
  transaction_id: string;
  status: string;
  redirect_url?: string;
  error?: string;
}

/**
 * Initiate a payment via Grow (Israeli payment processor)
 * Docs: https://grow.co.il/developers
 */
export const initiatePayment = async (
  amount: number,
  currency: string = 'ILS',
  options: {
    orderId?: string;
    description?: string;
    customerEmail?: string;
    customerName?: string;
    successUrl?: string;
    failUrl?: string;
  } = {}
): Promise<{ transactionId: string; status: string; redirectUrl?: string }> => {

  // If no Grow credentials — use mock (dev mode)
  if (!env.grow?.apiKey) {
    console.warn('[Payment] No Grow credentials — using mock');
    return {
      transactionId: `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'success',
    };
  }

  try {
    const payload = {
      amount: Math.round(amount * 100), // Grow uses agorot (cents)
      currency,
      order_id: options.orderId || `BP_${Date.now()}`,
      description: options.description || 'BuyPower - קנייה קבוצתית',
      customer_email: options.customerEmail,
      customer_name: options.customerName,
      success_url: options.successUrl || `${env.clientUrl}/payment/success`,
      fail_url: options.failUrl || `${env.clientUrl}/payment/fail`,
      cancel_url: `${env.clientUrl}/payment/cancel`,
      language: 'he',
    };

    const response = await axios.post<GrowPaymentResponse>(
      `${GROW_API_URL}/payments/create`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${env.grow.apiKey}`,
          'X-Grow-Secret': env.grow.secretKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    return {
      transactionId: response.data.transaction_id,
      status: response.data.status,
      redirectUrl: response.data.redirect_url,
    };
  } catch (err: any) {
    console.error('[Grow Payment Error]', err?.response?.data || err.message);
    throw new Error('שגיאה בעיבוד התשלום');
  }
};

/**
 * Verify a payment result from Grow webhook/callback
 */
export const verifyPayment = async (transactionId: string): Promise<{
  success: boolean;
  amount?: number;
  status?: string;
}> => {
  if (!env.grow?.apiKey) {
    return { success: true, status: 'charged' };
  }

  try {
    const response = await axios.get(
      `${GROW_API_URL}/payments/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${env.grow.apiKey}`,
          'X-Grow-Secret': env.grow.secretKey,
        },
        timeout: 10000,
      }
    );
    return {
      success: response.data.status === 'success',
      amount: response.data.amount / 100,
      status: response.data.status === 'success' ? 'charged' : 'failed',
    };
  } catch (err: any) {
    console.error('[Grow Verify Error]', err?.response?.data || err.message);
    return { success: false, status: 'failed' };
  }
};

/**
 * Refund a payment via Grow
 */
export const refundPayment = async (
  transactionId: string,
  amount: number,
): Promise<{ success: boolean }> => {
  if (!env.grow?.apiKey) {
    console.log(`[Mock Refund] Transaction: ${transactionId}, Amount: ₪${amount}`);
    return { success: true };
  }

  try {
    await axios.post(
      `${GROW_API_URL}/payments/${transactionId}/refund`,
      { amount: Math.round(amount * 100) },
      {
        headers: {
          'Authorization': `Bearer ${env.grow.apiKey}`,
          'X-Grow-Secret': env.grow.secretKey,
        },
        timeout: 10000,
      }
    );
    return { success: true };
  } catch (err: any) {
    console.error('[Grow Refund Error]', err?.response?.data || err.message);
    return { success: false };
  }
};

// ---------------------------------------------------------------------------
// Pre-Authorization (Credit Hold) — used when a user joins a group purchase.
// The card is held but NOT charged until the GP completes.
//
// Grow API pre-auth uses charge_type "J5" (authorization-only / credit hold).
// TODO: Confirm exact endpoint + field names with Grow docs / account manager:
//   POST https://api.grow.co.il/v1/payments/preauth
//   Body: { amount, currency, charge_type: "J5", order_id, customer_* }
//   Capture: POST https://api.grow.co.il/v1/payments/{transaction_id}/capture
//   Release: POST https://api.grow.co.il/v1/payments/{transaction_id}/void
// ---------------------------------------------------------------------------

/**
 * Initiate a pre-authorization (credit hold) via Grow.
 * Card is held but NOT charged. Call capturePreAuth() when GP completes,
 * or releasePreAuth() if GP fails/expires.
 *
 * TODO: Replace mock with real Grow J5 pre-auth call once credentials are available.
 */
export const initiatePreAuth = async (
  amount: number,
  currency: string = 'ILS',
  options: {
    orderId?: string;
    description?: string;
    customerEmail?: string;
    customerName?: string;
  } = {}
): Promise<{ preAuthId: string; status: string }> => {

  // Mock mode — no real API call
  if (!env.grow?.apiKey) {
    const mockId = `PREAUTH_MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[Mock PreAuth] Created hold: ${mockId} for ₪${amount}`);
    return { preAuthId: mockId, status: 'pending' };
  }

  // TODO: Verify exact endpoint and payload structure with Grow support.
  // The J5 charge type creates an authorization-only transaction (credit hold).
  try {
    const payload = {
      amount: Math.round(amount * 100), // Grow uses agorot
      currency,
      charge_type: 'J5', // J5 = pre-authorization / credit hold in Grow
      order_id: options.orderId || `BP_PREAUTH_${Date.now()}`,
      description: options.description || 'BuyPower - אישור מקדים לרכישה קבוצתית',
      customer_email: options.customerEmail,
      customer_name: options.customerName,
      language: 'he',
    };

    const response = await axios.post<GrowPaymentResponse>(
      `${GROW_API_URL}/payments/preauth`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${env.grow.apiKey}`,
          'X-Grow-Secret': env.grow.secretKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    return {
      preAuthId: response.data.transaction_id,
      status: response.data.status,
    };
  } catch (err: any) {
    console.error('[Grow PreAuth Error]', err?.response?.data || err.message);
    throw new Error('שגיאה ביצירת אישור מקדים לחיוב');
  }
};

/**
 * Capture a pre-authorization — actually charges the card.
 * Called when a group purchase completes successfully.
 *
 * TODO: Confirm capture endpoint with Grow support.
 */
export const capturePreAuth = async (
  preAuthId: string,
  amount: number,
): Promise<{ success: boolean; transactionId?: string }> => {
  if (!env.grow?.apiKey) {
    console.log(`[Mock Capture] PreAuth: ${preAuthId}, Amount: ₪${amount}`);
    return { success: true, transactionId: `CAPTURE_MOCK_${Date.now()}` };
  }

  try {
    const response = await axios.post<GrowPaymentResponse>(
      `${GROW_API_URL}/payments/${preAuthId}/capture`,
      { amount: Math.round(amount * 100) },
      {
        headers: {
          'Authorization': `Bearer ${env.grow.apiKey}`,
          'X-Grow-Secret': env.grow.secretKey,
        },
        timeout: 15000,
      }
    );
    return {
      success: response.data.status === 'success',
      transactionId: response.data.transaction_id,
    };
  } catch (err: any) {
    console.error('[Grow Capture Error]', err?.response?.data || err.message);
    return { success: false };
  }
};

/**
 * Release (void) a pre-authorization — no charge, hold is removed.
 * Called when a group purchase fails or expires.
 *
 * TODO: Confirm void/release endpoint with Grow support.
 */
export const releasePreAuth = async (
  preAuthId: string,
): Promise<{ success: boolean }> => {
  if (!env.grow?.apiKey) {
    console.log(`[Mock Release] PreAuth voided: ${preAuthId}`);
    return { success: true };
  }

  try {
    await axios.post(
      `${GROW_API_URL}/payments/${preAuthId}/void`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${env.grow.apiKey}`,
          'X-Grow-Secret': env.grow.secretKey,
        },
        timeout: 10000,
      }
    );
    return { success: true };
  } catch (err: any) {
    console.error('[Grow Release Error]', err?.response?.data || err.message);
    return { success: false };
  }
};
