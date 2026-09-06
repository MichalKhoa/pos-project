import { useEffect, useRef } from 'react';
import { soundFx } from '../utils/audio.js';

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
  storeConfig,
  presets = [],
  onUnknownBarcode,
  onBarcodeScanned,
  onReceiptScanned,
  isPriceCheckActive = false,
  onTogglePriceCheck = null,
  onInspectPrice = null,
  onPriceCheckUnknown = null
}) {
  const barcodeBufferRef = useRef('');
  const lastCharTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isAppLocked) return;
      if (activeTab !== 'register') return;

      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      const key = e.key;

      // F2 hotkey: Toggle Price Check Mode (Cenovka)
      if (key === 'F2') {
        e.preventDefault();
        if (onTogglePriceCheck) onTogglePriceCheck();
        return;
      }

      const now = Date.now();
      const diff = now - lastCharTimeRef.current;
      lastCharTimeRef.current = now;

      // Hardware Barcode Scanner Detection (fast keystrokes < 70ms ending in Enter)
      if (key === 'Enter') {
        const buffer = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';

        if (buffer.length >= 3 && diff < 100) {
          e.preventDefault();
          e.stopPropagation();
          setKeypadAmount('');

          // In Price Check Mode, route scanned barcode to price inspection modal
          if (isPriceCheckActive) {
            const matchedPreset = (presets || []).find(p => {
              if (!p || !p.barcode) return false;
              const codes = String(p.barcode).split(',').map(b => b.trim().toLowerCase());
              return codes.includes(buffer.toLowerCase());
            });

            if (matchedPreset) {
              soundFx.playScanChime();
              if (onInspectPrice) onInspectPrice(matchedPreset);
            } else {
              soundFx.playErrorChime();
              if (onPriceCheckUnknown) onPriceCheckUnknown(buffer);
            }
            return;
          }

          // 1. Check if scanned barcode is a receipt / storno document number
          const isReceiptBarcode = /^(RCP|STORNO)-/i.test(buffer) || /^\d{4}-\d{5,8}$/.test(buffer);
          if (isReceiptBarcode && onReceiptScanned) {
            onReceiptScanned(buffer);
            return;
          }

          const matchedPreset = (presets || []).find(p => {
            if (!p || !p.barcode) return false;
            const codes = String(p.barcode).split(',').map(b => b.trim().toLowerCase());
            return codes.includes(buffer.toLowerCase());
          });

          if (matchedPreset) {
            const qty = Math.max(1, Math.abs(itemMultiplier || 1));
            handleAddToCart({ ...matchedPreset, quantity: qty });
            soundFx.playScanChime();
            if (itemMultiplier !== 1) setItemMultiplier(1);
            if (onBarcodeScanned) onBarcodeScanned(matchedPreset, qty);
          } else {
            soundFx.playErrorChime();
            if (onUnknownBarcode) onUnknownBarcode(buffer);
          }
          return;
        }
      }

      // Check if this key is part of a rapid scanner burst
      if (key && key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (diff <= 70 && barcodeBufferRef.current.length >= 1) {
          e.preventDefault();
          barcodeBufferRef.current += key;
          return;
        }
        barcodeBufferRef.current = key;
      }

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
        const currentlyReturn = (itemMultiplier < 0) || Boolean(keypadAmount && keypadAmount.startsWith('-'));
        if (currentlyReturn) {
          if (itemMultiplier < 0) setItemMultiplier(Math.abs(itemMultiplier));
          setKeypadAmount(prev => (prev.startsWith('-') ? prev.slice(1) : prev));
        } else {
          setKeypadAmount(prev => (prev ? '-' + prev : '-'));
        }
      } else if (key === 'ArrowUp' || key === '+' || key === 'Add') {
        e.preventDefault();
        setItemMultiplier(prev => {
          const current = prev || 1;
          if (current === -1) return 1;
          if (current < -1) return current + 1;
          return current + 1;
        });
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        setItemMultiplier(prev => {
          const current = prev || 1;
          if (current === 1) return -1;
          if (current > 1) return current - 1;
          return current - 1;
        });
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
            if (!isNaN(parsedQty) && parsedQty !== 0 && parsedQty >= -999 && parsedQty <= 999) {
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
          const isReturn = (itemMultiplier < 0) || keypadAmount.startsWith('-');
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
  }, [activeTab, keypadAmount, setKeypadAmount, setItemMultiplier, cartItems, paymentModalMethod, setPaymentModalMethod, storeConfig, isAppLocked, handleAddToCart, itemMultiplier, presets, onUnknownBarcode, onBarcodeScanned, onReceiptScanned, isPriceCheckActive, onTogglePriceCheck, onInspectPrice, onPriceCheckUnknown]);
}
