import { useEffect, useRef } from 'react';
import { soundFx } from '../utils/audio.js';
import { parseScaleBarcode } from '../utils/barcodeUtils.js';

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

          // Check if scale barcode (EAN-13 prefix 28 or 29)
          const scaleResult = parseScaleBarcode(buffer);

          // In Price Check Mode, route scanned barcode to price inspection modal
          if (isPriceCheckActive) {
            const matchedPreset = (presets || []).find(p => {
              if (!p) return false;
              if (p.barcode) {
                const codes = String(p.barcode).split(',').map(b => b.trim().toLowerCase());
                if (codes.includes(buffer.toLowerCase())) return true;
                if (scaleResult.isScaleBarcode && (codes.includes(scaleResult.sku.toLowerCase()) || codes.includes(scaleResult.sku.replace(/^0+/, '').toLowerCase()))) {
                  return true;
                }
              }
              if (scaleResult.isScaleBarcode) {
                const rawSku = scaleResult.sku.toLowerCase();
                const strippedSku = scaleResult.sku.replace(/^0+/, '').toLowerCase();
                if (p.id && (String(p.id).toLowerCase() === rawSku || String(p.id).toLowerCase() === strippedSku)) return true;
                if (p.sku && (String(p.sku).toLowerCase() === rawSku || String(p.sku).toLowerCase() === strippedSku)) return true;
              }
              return false;
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

          // 2. Weighed Scale Barcode Handling (prefixes 28 & 29)
          if (scaleResult.isScaleBarcode) {
            const rawSku = scaleResult.sku.toLowerCase();
            const strippedSku = scaleResult.sku.replace(/^0+/, '').toLowerCase();

            const matchedScalePreset = (presets || []).find(p => {
              if (!p) return false;
              if (p.barcode) {
                const codes = String(p.barcode).split(',').map(b => b.trim().toLowerCase());
                if (codes.includes(buffer.toLowerCase()) || codes.includes(rawSku) || (strippedSku && codes.includes(strippedSku))) {
                  return true;
                }
              }
              if (p.id && (String(p.id).toLowerCase() === rawSku || (strippedSku && String(p.id).toLowerCase() === strippedSku))) return true;
              if (p.sku && (String(p.sku).toLowerCase() === rawSku || (strippedSku && String(p.sku).toLowerCase() === strippedSku))) return true;
              if (p.plu && (String(p.plu).toLowerCase() === rawSku || (strippedSku && String(p.plu).toLowerCase() === strippedSku))) return true;
              return false;
            });

            if (matchedScalePreset) {
              let qty = 1;
              let itemUnit = 'kg';
              let unitPrice = matchedScalePreset.price;

              if (scaleResult.type === 'WEIGHT') {
                qty = scaleResult.weightKg;
                itemUnit = 'kg';
              } else if (scaleResult.type === 'PRICE') {
                if (matchedScalePreset.price > 0) {
                  qty = Math.round((scaleResult.totalPrice / matchedScalePreset.price) * 1000) / 1000;
                  itemUnit = 'kg';
                } else {
                  qty = 1;
                  unitPrice = scaleResult.totalPrice;
                }
              }

              handleAddToCart({
                ...matchedScalePreset,
                price: unitPrice,
                quantity: qty,
                unit: itemUnit
              });
              soundFx.playScanChime();
              if (itemMultiplier !== 1) setItemMultiplier(1);
              if (onBarcodeScanned) onBarcodeScanned(matchedScalePreset, qty);
              return;
            } else {
              soundFx.playErrorChime();
              if (onUnknownBarcode) onUnknownBarcode(buffer);
              return;
            }
          }

          // 3. Standard EAN Barcode Matching
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
