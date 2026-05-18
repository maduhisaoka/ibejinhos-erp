"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Product } from "@/lib/types";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  updateItemFlavors: (productId: number, flavors: Record<string, number>) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("ibejinhos-cart");
    if (stored) {
      setItems(JSON.parse(stored) as CartItem[]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem("ibejinhos-cart", JSON.stringify(items));
  }, [items, loaded]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      items,
      count,
      subtotal,
      addItem: (product) => {
        setItems((current) => {
          const existing = current.find((item) => item.id === product.id);
          if (existing) {
            return current.map((item) =>
              item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            );
          }
          return [...current, { ...product, quantity: 1, selectedFlavors: {} }];
        });
      },
      updateQuantity: (productId, quantity) => {
        setItems((current) =>
          current
            .map((item) => (item.id === productId ? { ...item, quantity } : item))
            .filter((item) => item.quantity > 0)
        );
      },
      updateItemFlavors: (productId, flavors) => {
        setItems((current) =>
          current.map((item) => (item.id === productId ? { ...item, selectedFlavors: flavors } : item))
        );
      },
      removeItem: (productId) => {
        setItems((current) => current.filter((item) => item.id !== productId));
      },
      clearCart: () => setItems([])
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}
