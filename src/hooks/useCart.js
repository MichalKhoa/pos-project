import { useState, useCallback, useRef, useEffect } from 'react';

export function useCart() {
  const [cartItems, setCartItems] = useState([]);
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [itemMultiplier, setItemMultiplier] = useState(1);

  // Undo Toast state (for 4s item additions & removals)
  const [undoToast, setUndoToast] = useState(null);
  const toastTimerRef = useRef(null);

  // Cleared Cart Snapshot state (for 8s "Vysypat košík" recovery)
  const [clearedCartSnapshot, setClearedCartSnapshot] = useState(null);
  const clearedTimerRef = useRef(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
    };
  }, []);

  const triggerUndoToast = useCallback((type, itemName, snapshot) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setUndoToast({ type, itemName, snapshot, createdAt: Date.now() });

    toastTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 4000);
  }, []);

  const dismissUndoToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setUndoToast(null);
  }, []);

  const addToCart = useCallback((item, quantity = 1) => {
    setCartItems(prev => {
      // Snapshot before adding
      const currentSnapshot = {
        cartItems: prev,
        cartDiscountPercent,
        itemMultiplier
      };
      
      const existingIndex = prev.findIndex(i => i.id === item.id && i.price === item.price && !i.isCustom);
      let updated;
      if (existingIndex > -1) {
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity
        };
      } else {
        updated = [...prev, { ...item, quantity }];
      }

      // Trigger undo toast for addition
      triggerUndoToast('ADD', item.name || 'Položka', currentSnapshot);

      return updated;
    });
  }, [cartDiscountPercent, itemMultiplier, triggerUndoToast]);

  const updateQuantity = useCallback((identifier, newQty) => {
    setCartItems(prev => {
      const index = typeof identifier === 'number' && identifier < prev.length && prev[identifier]?.id !== identifier
        ? identifier
        : prev.findIndex(i => i.id === identifier);

      if (index === -1) return prev;
      const itemToUpdate = prev[index];

      const currentSnapshot = {
        cartItems: prev,
        cartDiscountPercent,
        itemMultiplier
      };

      if (newQty <= 0) {
        triggerUndoToast('REMOVE', itemToUpdate.name || 'Položka', currentSnapshot);
        return prev.filter((_, idx) => idx !== index);
      } else {
        const clampedQty = Math.min(9999, newQty);
        const updated = [...prev];
        updated[index] = { ...updated[index], quantity: clampedQty };
        return updated;
      }
    });
  }, [cartDiscountPercent, itemMultiplier, triggerUndoToast]);

  const updateItemDiscount = useCallback((identifier, discountPercent) => {
    setCartItems(prev => {
      const index = typeof identifier === 'number' && identifier < prev.length && prev[identifier]?.id !== identifier
        ? identifier
        : prev.findIndex(i => i.id === identifier);

      if (index === -1) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], discountPercent };
      return updated;
    });
  }, []);

  const removeItem = useCallback((identifier) => {
    setCartItems(prev => {
      const index = typeof identifier === 'number' && identifier < prev.length && prev[identifier]?.id !== identifier
        ? identifier
        : prev.findIndex(i => i.id === identifier);

      if (index === -1) return prev;
      const itemToRemove = prev[index];

      const currentSnapshot = {
        cartItems: prev,
        cartDiscountPercent,
        itemMultiplier
      };

      triggerUndoToast('REMOVE', itemToRemove.name || 'Položka', currentSnapshot);
      return prev.filter((_, idx) => idx !== index);
    });
  }, [cartDiscountPercent, itemMultiplier, triggerUndoToast]);

  const undoLastAction = useCallback(() => {
    if (!undoToast || !undoToast.snapshot) return;
    const { cartItems: prevItems, cartDiscountPercent: prevDisc, itemMultiplier: prevMult } = undoToast.snapshot;
    setCartItems(prevItems);
    setCartDiscountPercent(prevDisc);
    setItemMultiplier(prevMult);
    dismissUndoToast();
  }, [undoToast, dismissUndoToast]);

  const clearCart = useCallback(() => {
    setCartItems(prev => {
      if (prev.length > 0) {
        // Save snapshot for 8s clear cart recovery
        if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
        
        setClearedCartSnapshot({
          snapshot: {
            cartItems: prev,
            cartDiscountPercent,
            itemMultiplier
          },
          createdAt: Date.now()
        });

        clearedTimerRef.current = setTimeout(() => {
          setClearedCartSnapshot(null);
        }, 8000);
      }
      return [];
    });

    setCartDiscountPercent(0);
    setItemMultiplier(1);
    dismissUndoToast();
  }, [cartDiscountPercent, itemMultiplier, dismissUndoToast]);

  const restoreClearedCart = useCallback(() => {
    if (!clearedCartSnapshot || !clearedCartSnapshot.snapshot) return;
    const { cartItems: prevItems, cartDiscountPercent: prevDisc, itemMultiplier: prevMult } = clearedCartSnapshot.snapshot;
    setCartItems(prevItems);
    setCartDiscountPercent(prevDisc);
    setItemMultiplier(prevMult);
    
    if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
    setClearedCartSnapshot(null);
  }, [clearedCartSnapshot]);

  const dismissClearedCartSnapshot = useCallback(() => {
    if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
    setClearedCartSnapshot(null);
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
    clearCart,
    undoToast,
    undoLastAction,
    dismissUndoToast,
    clearedCartSnapshot,
    restoreClearedCart,
    dismissClearedCartSnapshot
  };
}

