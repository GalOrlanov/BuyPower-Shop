import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface PriceTier {
  minBuyers: number;
  price: number;
}

export interface CartItem {
  groupPurchaseId: string;
  productId: string;
  productName: string;
  image: string;
  priceTiers: PriceTier[];
  originalPrice: number;
  quantity: number;
  currentParticipants: number;
  // Group purchase specific fields
  isGroupPurchase?: boolean;
  endDate?: string;
  targetParticipants?: number;
  minParticipants?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (groupPurchaseId: string) => void;
  clearCart: () => void;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = 'buypower_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const exists = prev.find(i => i.groupPurchaseId === item.groupPurchaseId);
      if (exists) {
        return prev.map(i =>
          i.groupPurchaseId === item.groupPurchaseId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((groupPurchaseId: string) => {
    setItems(prev => prev.filter(i => i.groupPurchaseId !== groupPurchaseId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_KEY);
  }, []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function getCurrentPrice(priceTiers: PriceTier[], currentParticipants: number): number {
  if (!priceTiers?.length) return 0;
  let price = priceTiers[0].price;
  for (const tier of priceTiers) {
    if (currentParticipants >= tier.minBuyers) price = tier.price;
  }
  return price;
}
