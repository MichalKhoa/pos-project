import React, { useState, useEffect, useId } from 'react';
import { Tag, Calculator, X, Keyboard, Delete } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { soundFx } from '../utils/audio.js';
import { useHoldBackspace } from '../hooks/useHoldBackspace.js';
import { openSystemKeyboard } from '../api/posApi.js';
import KeypadStepperBar from './keypad/KeypadStepperBar.jsx';
import KeypadVatSelector from './keypad/KeypadVatSelector.jsx';
import KeypadNumberGrid from './keypad/KeypadNumberGrid.jsx';

export default function CustomItemModal({
  isOpen = true,
  id,
  onClose,
  onAddToCart,
  defaultVat = 21,
  initialMultiplier = 1,
  autoOpenTouchKeyboard = false,
  storeConfig = null
}) {
  const { t } = useTranslation();
  const nameInputId = useId();

  const [priceStr, setPriceStr] = useState('');
  const [name, setName] = useState('');
  const [selectedVat, setSelectedVat] = useState(() => (defaultVat !== undefined && defaultVat !== null ? parseInt(defaultVat, 10) : 21));
  const [itemMultiplier, setItemMultiplier] = useState(() => initialMultiplier || 1);
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (defaultVat !== undefined && defaultVat !== null) {
      setSelectedVat(parseInt(defaultVat, 10));
    }
  }, [defaultVat]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isReturn = (itemMultiplier < 0) || Boolean(priceStr && priceStr.startsWith('-'));
  const hasValidAmount = !isNaN(parseFloat(priceStr)) && parseFloat(priceStr) !== 0;

  const triggerKeyAnimation = (key) => {
    setActiveKey(key);
    soundFx.playKeypadClick();
    setTimeout(() => setActiveKey(null), 150);
  };

  const handleOpenSystemKeyboard = () => {
    soundFx.playKeypadClick();
    if (typeof navigator !== 'undefined' && navigator.virtualKeyboard?.show) {
      try {
        navigator.virtualKeyboard.show();
      } catch (e) {
        console.warn('VirtualKeyboard API error:', e);
      }
    }
    openSystemKeyboard().catch(err => {
      console.warn('Failed to dispatch system keyboard endpoint:', err);
    });
  };

  const handleInputFocus = () => {
    if (autoOpenTouchKeyboard || storeConfig?.autoOpenTouchKeyboard) {
      handleOpenSystemKeyboard();
    }
  };

  const handleKeyPress = (val) => {
    triggerKeyAnimation(val);

    if (val === 'PLUSMINUS' || val === '±') {
      if (isReturn) {
        if (itemMultiplier < 0) {
          setItemMultiplier(Math.abs(itemMultiplier));
        }
        setPriceStr(prev => (prev.startsWith('-') ? prev.slice(1) : prev));
      } else {
        setPriceStr(prev => (prev ? '-' + prev : '-'));
      }
      return;
    }

    if (val === 'CLEAR') {
      soundFx.playDeleteTone();
      setPriceStr('');
      return;
    }

    if (val === 'BACK') {
      soundFx.playKeypadClick();
      setPriceStr(prev => (prev.length > 1 ? prev.slice(0, -1) : ''));
      return;
    }

    if (val === '.' || val === ',') {
      if (priceStr.includes('.')) return;
      setPriceStr(prev => (prev ? prev + '.' : '0.'));
      return;
    }

    if (val === '.00' || val === '00') {
      if (priceStr.includes('.')) {
        const parts = priceStr.split('.');
        if (parts[1] && parts[1].length >= 1) return;
      }
      if (!priceStr || priceStr === '0') {
        setPriceStr('0');
        return;
      }
      setPriceStr(prev => (prev.length < 9 ? prev + '00' : prev));
      return;
    }

    if (priceStr.includes('.')) {
      const parts = priceStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }

    if (priceStr.length >= 10) return;
    setPriceStr(prev => (prev === '0' ? val : prev + val));
  };

  const handleAddCustomItem = (e) => {
    if (e) e.preventDefault();
    const numericAmount = parseFloat(priceStr);
    if (isNaN(numericAmount) || numericAmount === 0) return;

    const qty = Math.max(1, Math.abs(itemMultiplier || 1));
    const unitPrice = isReturn ? -Math.abs(numericAmount) : Math.abs(numericAmount);

    onAddToCart?.({
      id: id || `custom-${Date.now()}`,
      name: name.trim() || (isReturn ? (t('keypad.return_title') || '↩️ Vratka / Vrácené zboží') : (t('keypad.unclassified_item') || 'Volný prodej')),
      price: unitPrice,
      vat: selectedVat,
      quantity: qty,
      isCustom: true
    });

    soundFx.playScanChime();
    onClose?.();
  };

  const inlineBackspaceHandlers = useHoldBackspace({
    onBackspace: () => handleKeyPress('BACK'),
    onClear: () => handleKeyPress('CLEAR'),
    disabled: !priceStr
  });

  if (!isOpen) return null;

  const RETAIL_TAGS = [
    { key: 'bakery', label: t('custom_item.quick_tags.bakery') || 'Pečivo' },
    { key: 'produce', label: t('custom_item.quick_tags.produce') || 'Ovoce/Zel' },
    { key: 'press', label: t('custom_item.quick_tags.press') || 'Tiskoviny' },
    { key: 'beverages', label: t('custom_item.quick_tags.beverages') || 'Nealko' },
    { key: 'other', label: t('custom_item.quick_tags.other') || 'Ostatní' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: '430px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card-elevated)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '0.75rem 1rem' }}>
          <div className="modal-title" style={{ fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Calculator size={17} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isReturn ? (t('keypad.sign_toggle') || '↩️ Vratka zboží') : (t('custom_item.title') || 'Vlastní / Nezařazená položka')}
            </span>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            aria-label={t('common.close') || 'Zavřít'}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {/* ── 1. Top: Item Name Input with inline ⌨️ button & Quick Tags ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              height: '42px',
              padding: '0 0.65rem',
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <Tag size={16} style={{ color: 'var(--accent-emerald, #10b981)', flexShrink: 0 }} />
              <input
                id={nameInputId}
                type="text"
                aria-label={t('custom_item.name_label') || 'Název'}
                className="keypad-label-input"
                placeholder={t('custom_item.name_placeholder') || 'Název položky (volitelné)...'}
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomItem();
                  }
                }}
                style={{
                  fontSize: '0.98rem',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  height: '100%',
                  color: 'var(--text-primary)'
                }}
              />
              {name && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  aria-label="Clear name"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={15} />
                </button>
              )}
              <button
                type="button"
                className="btn-keyboard-trigger"
                onClick={handleOpenSystemKeyboard}
                aria-label={t('custom_item.open_keyboard') || 'Otevřít klávesnici'}
                title={t('custom_item.open_keyboard') || 'Otevřít dotykovou klávesnici (TabTip)'}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--accent-blue)',
                  cursor: 'pointer',
                  padding: '4px 7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <Keyboard size={16} />
              </button>
            </div>

            {/* Quick retail tag chips */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {RETAIL_TAGS.map(tag => (
                <button
                  key={tag.key}
                  type="button"
                  className="chip-tag"
                  onClick={() => {
                    soundFx.playKeypadClick();
                    setName(tag.label);
                  }}
                  style={{
                    background: name === tag.label ? 'var(--accent-highlight, #3b82f6)' : 'var(--bg-input)',
                    color: name === tag.label ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease'
                  }}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── 2. Stepper Bar (Quantity & Return Mode) ── */}
          <KeypadStepperBar
            itemMultiplier={itemMultiplier}
            setItemMultiplier={setItemMultiplier}
            triggerKeyAnimation={triggerKeyAnimation}
            activeKey={activeKey}
          />

          {/* ── 3. Compact Amount Display Card (Matches Main Keypad) ── */}
          <div
            data-testid="amount-display"
            className={`keypad-amount-display ${hasValidAmount ? 'has-value' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '0.45rem 0.75rem',
              borderRadius: '10px',
              border: isReturn
                ? '2px solid var(--accent-rose)'
                : (hasValidAmount ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-color)'),
              background: isReturn
                ? 'rgba(239, 68, 68, 0.06)'
                : (hasValidAmount ? 'color-mix(in srgb, var(--accent-blue) 4%, var(--bg-input))' : 'var(--bg-input)'),
              boxShadow: isReturn
                ? '0 0 12px rgba(239, 68, 68, 0.18)'
                : (hasValidAmount ? '0 0 12px rgba(59, 130, 246, 0.15)' : 'none'),
              transition: 'all 0.2s ease'
            }}
          >
            {/* Header row: mode indicator & multiplier pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: '0.64rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: isReturn ? 'var(--accent-rose)' : 'var(--text-muted)'
              }}>
                {isReturn ? 'Cena pro vrácení — ↩️ VRATKA' : 'Zadejte cenu za jednotku (Kč)'}
              </span>

              {itemMultiplier !== 1 && (
                <span style={{
                  fontSize: '0.64rem',
                  fontWeight: '800',
                  color: isReturn ? 'var(--accent-rose)' : 'var(--accent-amber)',
                  background: isReturn ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  {isReturn ? `↩️ ${itemMultiplier}×` : `⚡ ${itemMultiplier}×`}
                </span>
              )}
            </div>

            {/* Main Price Readout Row with Inline Backspace */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              marginTop: '1px'
            }}>
              <div style={{
                fontSize: '1.45rem',
                fontWeight: '900',
                fontFamily: 'var(--font-mono)',
                color: isReturn
                  ? 'var(--accent-rose)'
                  : (priceStr ? 'var(--text-primary)' : 'var(--text-muted)'),
                wordBreak: 'break-all',
                flex: 1
              }}>
                {priceStr ? `${priceStr} Kč` : (isReturn ? '-0 Kč' : '0 Kč')}
              </div>

              {/* Inline Backspace button */}
              <button
                type="button"
                className="keypad-inline-backspace-btn"
                {...inlineBackspaceHandlers}
                disabled={!priceStr}
                aria-label="Inline Backspace"
                title={t('keypad.backspace_title') || 'Smazat poslední znak (Backspace)'}
                style={{
                  width: '34px',
                  height: '34px',
                  minWidth: '34px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'transparent',
                  color: priceStr ? 'var(--text-muted)' : 'transparent',
                  opacity: priceStr ? 0.75 : 0,
                  cursor: priceStr ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  padding: 0
                }}
              >
                <Delete size={18} />
              </button>
            </div>

            {/* Total calculation preview when qty != 1 */}
            {itemMultiplier !== 1 && hasValidAmount && (
              <div style={{
                fontSize: '0.76rem',
                color: isReturn ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                fontWeight: '800',
                marginTop: '1px'
              }}>
                {isReturn ? (t('keypad.total_return_preview') || '↩️ Vratka celkem: ') : (t('keypad.total_preview') || '= Celkem: ')}
                {(Math.abs(itemMultiplier) * parseFloat(priceStr || 0)).toLocaleString('cs-CZ')} Kč ({itemMultiplier} ks)
              </div>
            )}
          </div>

          {/* ── 4. VAT Selector Chips ── */}
          <KeypadVatSelector
            selectedVat={selectedVat}
            setSelectedVat={setSelectedVat}
            activeKey={activeKey}
          />

          {/* ── 5. Touch Number Grid (4×4 + single Enter) ── */}
          <KeypadNumberGrid
            activeKey={activeKey}
            onKeyPress={handleKeyPress}
            itemMultiplier={itemMultiplier}
            setItemMultiplier={setItemMultiplier}
            amountStr={priceStr}
            setAmountStr={setPriceStr}
            triggerKeyAnimation={triggerKeyAnimation}
            hasValidAmount={hasValidAmount}
            onAddCustomItem={handleAddCustomItem}
          />

          {/* ── 6. Bottom Cancel Button ── */}
          <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.15rem' }}>
            <button
              type="button"
              className="nav-tab"
              style={{
                flex: 1,
                justifyContent: 'center',
                height: '44px',
                minHeight: '44px',
                fontSize: '0.95rem',
                fontWeight: '700',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
              onClick={onClose}
              aria-label={t('common.cancel') || 'Zrušit'}
            >
              {t('common.cancel') || 'Zrušit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
