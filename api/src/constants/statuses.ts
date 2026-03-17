export const GROUP_PURCHASE_STATUSES = [
  'waiting_for_demand',
  'in_negotiation',
  'open',
  'closed',
  'cancelled',
] as const;

export const PAYMENT_STATUSES = ['pending', 'preauth', 'authorized', 'charged', 'refunded', 'released'] as const;

export const PREAUTH_STATUSES = ['pending', 'captured', 'released', 'failed'] as const;

export const PAYMENT_PROVIDER_STATUSES = ['pending', 'success', 'failed', 'refunded'] as const;

export const NOTIFICATION_TYPES = [
  'price_drop',
  'closing_soon',
  'spots_left',
  'new_purchase',
  'demand',
  'purchase_closed',
] as const;

export const PRODUCT_REQUEST_STATUSES = ['open', 'fulfilled', 'closed'] as const;

export const REFERRAL_STATUSES = ['pending', 'credited'] as const;

export const USER_ROLES = ['user', 'business', 'admin'] as const;
