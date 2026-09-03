import { useState, useCallback, useRef, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { soundFx } from '../utils/audio';

export function useCart() {
  const [cartItems, setCartItems] = useState([]);
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [itemMultiplier, setItemMultiplier] = useState(1);

  // Parked Carts state (temporary cart storage for holding transactions)
  const [parkedCarts, setParkedCarts] = useState(() => {
    try {
      const saved = getStorageItem('parked_carts');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      setStorageItem('parked_carts', parkedCarts);
    } catch (e) {
      console.warn('Failed to save parked carts:', e);
    }
  }, [parkedCarts]);

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

  const updateItemDetails = useCallback((identifier, updates) => {
    setCartItems(prev => {
      const index = typeof identifier === 'number' && identifier < prev.length && prev[identifier]?.id !== identifier
        ? identifier
        : prev.findIndex(i => i.id === identifier);

      if (index === -1) return prev;
      const existingItem = prev[index];
      const newQty = updates.quantity !== undefined ? updates.quantity : existingItem.quantity;

      const currentSnapshot = {
        cartItems: prev,
        cartDiscountPercent,
        itemMultiplier
      };

      if (newQty <= 0) {
        triggerUndoToast('REMOVE', existingItem.name || 'Položka', currentSnapshot);
        return prev.filter((_, idx) => idx !== index);
      }

      const updated = [...prev];
      updated[index] = {
        ...existingItem,
        ...updates,
        quantity: Math.min(9999, newQty)
      };
      return updated;
    });
  }, [cartDiscountPercent, itemMultiplier, triggerUndoToast]);

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
      soundFx.playDeleteTone();
      return prev.filter((_, idx) => idx !== index);
    });
  }, [cartDiscountPercent, itemMultiplier, triggerUndoToast]);

  const undoLastAction = useCallback(() => {
    if (!undoToast || !undoToast.snapshot) return;
    const { cartItems: prevItems, cartDiscountPercent: prevDisc, itemMultiplier: prevMult } = undoToast.snapshot;
    setCartItems(prevItems);
    setCartDiscountPercent(prevDisc);
    setItemMultiplier(prevMult);
    soundFx.playSuccessChime();
    dismissUndoToast();
  }, [undoToast, dismissUndoToast]);

  const clearCart = useCallback(() => {
    setCartItems(prev => {
      if (prev.length > 0) {
        soundFx.playDeleteTone();
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
    soundFx.playSuccessChime();
    
    if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
    setClearedCartSnapshot(null);
  }, [clearedCartSnapshot]);

  const dismissClearedCartSnapshot = useCallback(() => {
    if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
    setClearedCartSnapshot(null);
  }, []);

  const parkCurrentCart = useCallback((customNote = '') => {
    if (cartItems.length === 0) return null;
    const total = cartItems.reduce((sum, i) => {
      const disc = i.discountPercent || 0;
      return sum + (parseFloat(i.price) * (1 - disc / 100) * i.quantity);
    }, 0) * (1 - cartDiscountPercent / 100);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

    const newHold = {
      id: `hold-${Date.now()}`,
      timeStr,
      note: customNote || '',
      items: cartItems,
      cartDiscountPercent,
      itemMultiplier,
      totalAmount: total,
      itemCount: cartItems.reduce((sum, i) => sum + i.quantity, 0)
    };

    setParkedCarts(prev => [newHold, ...prev]);
    setCartItems([]);
    setCartDiscountPercent(0);
    setItemMultiplier(1);
    dismissUndoToast();
    soundFx.playScanChime();
    return newHold;
  }, [cartItems, cartDiscountPercent, itemMultiplier, dismissUndoToast]);

  const restoreParkedCart = useCallback((id) => {
    let result = { restored: null, autoParked: false };
    setParkedCarts(prev => {
      const target = prev.find(p => p.id === id);
      if (!target) return prev;
      result.restored = target;

      let remaining = prev.filter(p => p.id !== id);

      // Seamless swap: auto-park active cart if it has items to prevent data loss
      if (cartItems.length > 0) {
        const total = cartItems.reduce((sum, i) => {
          const disc = i.discountPercent || 0;
          return sum + (parseFloat(i.price) * (1 - disc / 100) * i.quantity);
        }, 0) * (1 - cartDiscountPercent / 100);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

        const autoHold = {
          id: `hold-${Date.now()}`,
          timeStr,
          note: '',
          items: cartItems,
          cartDiscountPercent,
          itemMultiplier,
          totalAmount: total,
          itemCount: cartItems.reduce((sum, i) => sum + i.quantity, 0)
        };

        remaining = [autoHold, ...remaining];
        result.autoParked = true;
      }

      setCartItems(target.items);
      setCartDiscountPercent(target.cartDiscountPercent || 0);
      setItemMultiplier(target.itemMultiplier || 1);
      soundFx.playSuccessChime();
      return remaining;
    });
    return result;
  }, [cartItems, cartDiscountPercent, itemMultiplier]);

  const deleteParkedCart = useCallback((id) => {
    soundFx.playDeleteTone();
    setParkedCarts(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateParkedCartNote = useCallback((id, note) => {
    setParkedCarts(prev => prev.map(p => (p.id === id ? { ...p, note } : p)));
  }, []);

  return {
    cartItems,
    setCartItems,
    cartDiscountPercent,
    setCartDiscountPercent,
    itemMultiplier,
    setItemMultiplier,
    parkedCarts,
    parkCurrentCart,
    restoreParkedCart,
    deleteParkedCart,
    updateParkedCartNote,
    addToCart,
    updateQuantity,
    updateItemDiscount,
    updateItemDetails,
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

