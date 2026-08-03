import { useState, useCallback } from 'react';

export function useCart() {
  const [cartItems, setCartItems] = useState([]);
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [itemMultiplier, setItemMultiplier] = useState(1);

  const addToCart = useCallback((item, quantity = 1) => {
    setCartItems(prev => {
      const existingIndex = prev.findIndex(i => i.id === item.id && i.price === item.price && !i.isCustom);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity
        };
        return updated;
      } else {
        return [...prev, { ...item, quantity }];
      }
    });
  }, []);

  const updateQuantity = useCallback((index, newQty) => {
    if (newQty <= 0) {
      setCartItems(prev => prev.filter((_, idx) => idx !== index));
    } else {
      setCartItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], quantity: newQty };
        return updated;
      });
    }
  }, []);

  const updateItemDiscount = useCallback((index, discountPercent) => {
    setCartItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], discountPercent };
      return updated;
    });
  }, []);

  const removeItem = useCallback((index) => {
    setCartItems(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setCartDiscountPercent(0);
    setItemMultiplier(1);
  }, []);

  return {
    cartItems,
    setCartItems,
    cartDiscountPercent,
    setCartDiscountPercent,
    itemMultiplier,
    setItemMultiplier,
    addToCart,
    updateQuantity,
    updateItemDiscount,
    removeItem,
    clearCart
  };
}
