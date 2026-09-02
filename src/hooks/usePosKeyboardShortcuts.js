import { useEffect } from 'react';

export function usePosKeyboardShortcuts({
  isAppLocked,
  activeTab,
  keypadAmount,
  setKeypadAmount,
  setItemMultiplier,
  itemMultiplier,
  cartItems,
  paymentModalMethod,
  setPaymentModalMethod,
  handleAddToCart,
  storeConfig
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isAppLocked) return;
      if (activeTab !== 'register') return;

      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      const key = e.key;

      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        setKeypadAmount(prev => {
          if (prev.includes('.')) {
            const parts = prev.split('.');
            if (parts[1] && parts[1].length >= 2) return prev;
          }
          return prev.length < 8 ? prev + key : prev;
        });
      } else if (key === '-' || key === 'Subtract') {
        e.preventDefault();
        setKeypadAmount(prev => {
          if (!prev) return '-';
          if (prev.startsWith('-')) return prev.slice(1);
          return '-' + prev;
        });
      } else if (key === 'ArrowUp' || key === '+' || key === 'Add') {
        e.preventDefault();
        setItemMultiplier(prev => Math.min(999, (prev || 1) + 1));
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        setItemMultiplier(prev => Math.max(1, (prev || 1) - 1));
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        setKeypadAmount(prev => {
          if (prev.includes('.')) return prev;
          return prev ? prev + '.' : '0.';
        });
      } else if (key === 'Backspace') {
        e.preventDefault();
        setKeypadAmount(prev => prev.slice(0, -1));
      } else if (key === 'Escape' || key === 'Delete' || key.toLowerCase() === 'c') {
        e.preventDefault();
        setKeypadAmount('');
        setItemMultiplier(1);
      } else if (key === '*' || key.toLowerCase() === 'x') {
        e.preventDefault();
        setKeypadAmount(prev => {
          if (prev && !prev.includes('.')) {
            const parsedQty = parseInt(prev, 10);
            if (!isNaN(parsedQty) && parsedQty >= 1 && parsedQty <= 999) {
              setItemMultiplier(parsedQty);
              return '';
            }
          }
          if (itemMultiplier !== 1) {
            setItemMultiplier(1);
          }
          return prev;
        });
      } else if (key === 'Enter') {
        e.preventDefault();
        const amtVal = parseFloat(keypadAmount);
        if (keypadAmount && !isNaN(amtVal) && amtVal !== 0) {
          const isReturn = keypadAmount.startsWith('-');
          const qty = Math.max(1, Math.abs(itemMultiplier || 1));
          const unitPrice = isReturn ? -Math.abs(amtVal) : Math.abs(amtVal);
          handleAddToCart({
            id: `custom-${Date.now()}`,
            name: isReturn ? '↩️ Vratka / Vrácené zboží' : 'Volný prodej',
            price: unitPrice,
            vat: storeConfig?.defaultVat !== undefined ? parseInt(storeConfig.defaultVat, 10) : 21,
            quantity: qty,
            isCustom: true
          });
          setKeypadAmount('');
          if (itemMultiplier !== 1) {
            setItemMultiplier(1);
          }
        } else if (cartItems.length > 0 && !paymentModalMethod) {
          setPaymentModalMethod('cash');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, keypadAmount, setKeypadAmount, setItemMultiplier, cartItems, paymentModalMethod, setPaymentModalMethod, storeConfig, isAppLocked, handleAddToCart, itemMultiplier]);
}
