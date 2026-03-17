export const CATEGORIES = [
  'electronics',
  'fashion',
  'home',
  'food',
  'health',
  'sports',
  'kids',
  'automotive',
  'services',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS_HE: Record<Category, string> = {
  electronics: 'אלקטרוניקה',
  fashion: 'אופנה',
  home: 'בית וגן',
  food: 'מזון',
  health: 'בריאות',
  sports: 'ספורט',
  kids: 'ילדים',
  automotive: 'רכב',
  services: 'שירותים',
  other: 'אחר',
};
