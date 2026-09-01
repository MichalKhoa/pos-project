import { useState, useEffect, useCallback } from 'react';

export function useRegisterKeypad({
  enabled = true,
  defaultVat = 21,
  hasCartItems = false,
  hasActiveModal = false,
  onAddToCart,
  onOpenCashPayment
}) {
  const [keypadAmount, setKeypadAmount] = useState('');
  const [itemMultiplier, setItemMultiplier] = useState(1);

  const clearKeypad = useCallback(() => {
    setKeypadAmount('');
    setItemMultiplier(1);
  }, []);

  const handleDigit = useCallback((digit) => {
    setKeypadAmount((prev) => {
      if (prev.includes('.')) {
        const parts = prev.split('.');
        if (parts[1] && parts[1].length >= 2) return prev;
      }
      return prev.length < 8 ? prev + digit : prev;
    });
  }, []);

  const handleToggleMinus = useCallback(() => {
    setKeypadAmount((prev) => {
      if (!prev) return '-';
      if (prev.startsWith('-')) return prev.slice(1);
      return '-' + prev;
    });
  }, []);

  const handleArrowUp = useCallback(() => {
    setItemMultiplier((prev) => {
      if (prev === -1) return 1;
      if (prev < -1) return prev + 1;
      return prev + 1;
    });
  }, []);

  const handleArrowDown = useCallback(() => {
    setItemMultiplier((prev) => {
      if (prev === 1) return -1;
      if (prev < 0) return prev - 1;
      return prev - 1;
    });
  }, []);

  const handleDecimal = useCallback(() => {
    setKeypadAmount((prev) => {
      if (prev.includes('.')) return prev;
      return prev ? prev + '.' : '0.';
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setKeypadAmount((prev) => prev.slice(0, -1));
  }, []);

  const handleMultiplicator = useCallback(() => {
    setKeypadAmount((prev) => {
      if (prev && !prev.includes('.')) {
        const parsedQty = parseInt(prev, 10);
        if (!isNaN(parsedQty) && parsedQty !== 0 && parsedQty >= -99 && parsedQty <= 99) {
          setItemMultiplier(parsedQty);
          return '';
        }
      }
      setItemMultiplier(1);
      return prev;
    });
  }, []);

  const handleSubmitAmount = useCallback(() => {
    const amtVal = parseFloat(keypadAmount);
    if (keypadAmount && !isNaN(amtVal) && amtVal !== 0) {
      const isReturn = amtVal < 0;
      if (onAddToCart) {
        onAddToCart({
          id: `custom-${Date.now()}`,
          name: isReturn ? '↩️ Vratka / Vrácené zboží' : 'Volný prodej',
          price: amtVal,
          vat: defaultVat !== undefined ? parseInt(defaultVat, 10) : 21,
          isCustom: true
        });
      }
      setKeypadAmount('');
    } else if (hasCartItems && !hasActiveModal && onOpenCashPayment) {
      onOpenCashPayment();
    }
  }, [keypadAmount, defaultVat, onAddToCart, hasCartItems, hasActiveModal, onOpenCashPayment]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Ignore if user is currently typing in an input or select field
      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      const key = e.key;

      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        handleDigit(key);
      } else if (key === '-') {
        e.preventDefault();
        handleToggleMinus();
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        handleArrowUp();
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        handleArrowDown();
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        handleDecimal();
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (key === 'Escape' || key === 'Delete') {
        e.preventDefault();
        clearKeypad();
      } else if (key === '*' || key.toLowerCase() === 'x') {
        e.preventDefault();
        handleMultiplicator();
      } else if (key === 'Enter') {
        e.preventDefault();
        handleSubmitAmount();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    handleDigit,
    handleToggleMinus,
    handleArrowUp,
    handleArrowDown,
    handleDecimal,
    handleBackspace,
    clearKeypad,
    handleMultiplicator,
    handleSubmitAmount
  ]);

  return {
    keypadAmount,
    setKeypadAmount,
    itemMultiplier,
    setItemMultiplier,
    clearKeypad,
    handleDigit,
    handleToggleMinus,
    handleArrowUp,
    handleArrowDown,
    handleDecimal,
    handleBackspace,
    handleMultiplicator,
    handleSubmitAmount
  };
}

export default useRegisterKeypad;
