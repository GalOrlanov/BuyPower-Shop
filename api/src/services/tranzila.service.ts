/**
 * Tranzila Payment Service
 *
 * Two distinct payment flows:
 *
 * 1. REGULAR PURCHASE (immediate charge)
 *    - iframe URL with tranmode=A (or no tranmode = default charge)
 *    - Charge happens immediately when user submits card
 *
 * 2. GROUP PURCHASE JOIN (credit hold / pre-auth)
 *    - iframe URL with tranmode=AK → charges card + returns TranzilaTK token
 *    - On GP success → captureGroupPayment() charges token
 *    - On GP fail/expire → releaseGroupPayment() voids the hold (token expires, no charge)
 *
 * Tranzila iframe base URL:
 *   https://direct.tranzila.com/{terminalName}/iframenew.php
 *
 * Token charge (server-to-server):
 *   POST https://secure5.tranzila.com/cgi-bin/tranzila31tk.cgi
 */

import axios from 'axios';
import { env } from '../config/env';
import querystring from 'querystring';

const TRANZILA_IFRAME_BASE = 'https://direct.tranzila.com';
const TRANZILA_TOKEN_CHARGE_URL = 'https://secure5.tranzila.com/cgi-bin/tranzila31tk.cgi';

// ─────────────────────────────────────────────────────────────
// IFRAME URL BUILDERS
// ─────────────────────────────────────────────────────────────

/**
 * Build Tranzila iframe URL for a REGULAR (immediate) purchase.
 * tranmode=A → direct charge, no hold.
 */
export const buildRegularPaymentUrl = (params: {
  amount: number;
  orderId: string;
  successUrl: string;
  failUrl: string;
  lang?: 'he' | 'en';
}): string => {
  const terminal = env.tranzila.terminalName;
  const query = querystring.stringify({
    sum: params.amount.toFixed(2),
    currency: 1, // 1 = ILS
    tranmode: 'A', // immediate charge
    cred_type: 1, // regular credit
    order: params.orderId,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    lang: params.lang || 'he',
    nologo: 1,
  });
  return `${TRANZILA_IFRAME_BASE}/${terminal}/iframenew.php?${query}`;
};

/**
 * Build Tranzila iframe URL for GROUP PURCHASE JOIN (credit hold + token).
 * tranmode=AK → charges card + returns TranzilaTK token for later capture.
 *
 * IMPORTANT: The actual charge amount at this stage is the CURRENT price tier.
 * If the price drops when more people join, we void + re-authorize for the lower price.
 * (Alternatively: authorize at max price, capture at final price — simpler.)
 */
export const buildGroupJoinPaymentUrl = (params: {
  amount: number;
  orderId: string;
  successUrl: string;
  failUrl: string;
  lang?: 'he' | 'en';
}): string => {
  const terminal = env.tranzila.terminalName;
  const query = querystring.stringify({
    sum: params.amount.toFixed(2),
    currency: 1,
    tranmode: 'AK', // credit hold + returns token
    cred_type: 1,
    order: params.orderId,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    lang: params.lang || 'he',
    nologo: 1,
  });
  return `${TRANZILA_IFRAME_BASE}/${terminal}/iframenew.php?${query}`;
};

// ─────────────────────────────────────────────────────────────
// TOKEN-BASED CHARGE / VOID (server-to-server)
// ─────────────────────────────────────────────────────────────

interface TranzilaTokenResponse {
  Response: string;       // "000" = success
  ConfirmationCode?: string;
  TranzilaTK?: string;
  error?: string;
  ErrorMessage?: string;
}

/**
 * Charge a saved token (capture / group purchase completion).
 * Called when a group purchase reaches its minimum and we charge all participants.
 */
export const captureGroupPayment = async (params: {
  token: string;
  expdate: string;    // MMYY format
  amount: number;
  orderId: string;
}): Promise<{ success: boolean; confirmationCode?: string; error?: string }> => {

  if (!env.tranzila?.terminalName || !env.tranzila?.password) {
    console.warn('[Tranzila] No credentials — mock capture');
    return { success: true, confirmationCode: `MOCK_CAP_${Date.now()}` };
  }

  try {
    const payload = {
      supplier: env.tranzila.terminalName,
      TranzilaPW: env.tranzila.password,
      TranzilaTK: params.token,
      expdate: params.expdate,
      sum: params.amount.toFixed(2),
      currency: 1,
      tranmode: 'A', // regular charge using token
      cred_type: 1,
      order: params.orderId,
    };

    const response = await axios.post<string>(
      TRANZILA_TOKEN_CHARGE_URL,
      querystring.stringify(payload),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
        responseType: 'text',
      }
    );

    const result = querystring.parse(response.data) as unknown as TranzilaTokenResponse;

    if (result.Response === '000') {
      return { success: true, confirmationCode: result.ConfirmationCode };
    } else {
      console.error('[Tranzila Capture] Failed:', result);
      return { success: false, error: result.ErrorMessage || `Response: ${result.Response}` };
    }
  } catch (err: any) {
    console.error('[Tranzila Capture Error]', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Void / release a token authorization (group purchase failed or expired).
 * Sends a credit transaction (tranmode=C) to cancel the hold.
 * The user's card is NOT charged.
 */
export const releaseGroupPayment = async (params: {
  token: string;
  expdate: string;
  amount: number;
  confirmationCode: string;  // authnr from original AK transaction
  orderId: string;
}): Promise<{ success: boolean; error?: string }> => {

  if (!env.tranzila?.terminalName || !env.tranzila?.password) {
    console.warn('[Tranzila] No credentials — mock void');
    return { success: true };
  }

  try {
    const payload = {
      supplier: env.tranzila.terminalName,
      TranzilaPW: env.tranzila.password,
      TranzilaTK: params.token,
      expdate: params.expdate,
      sum: params.amount.toFixed(2),
      currency: 1,
      tranmode: `C${params.confirmationCode}`, // C + original transaction index
      authnr: params.confirmationCode,
      cred_type: 1,
      order: params.orderId,
    };

    const response = await axios.post<string>(
      TRANZILA_TOKEN_CHARGE_URL,
      querystring.stringify(payload),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
        responseType: 'text',
      }
    );

    const result = querystring.parse(response.data) as unknown as TranzilaTokenResponse;

    if (result.Response === '000') {
      return { success: true };
    } else {
      console.error('[Tranzila Void] Failed:', result);
      return { success: false, error: result.ErrorMessage || `Response: ${result.Response}` };
    }
  } catch (err: any) {
    console.error('[Tranzila Void Error]', err.message);
    return { success: false, error: err.message };
  }
};
