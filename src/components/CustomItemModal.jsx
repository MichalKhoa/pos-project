import React, { useState, useEffect, useId } from 'react';
import { Tag, Calculator, X, Keyboard } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { soundFx } from '../utils/audio.js';
import { openSystemKeyboard } from '../api/posApi.js';
import KeypadStepperBar from './keypad/KeypadStepperBar.jsx';
import KeypadVatSelector from './keypad/KeypadVatSelector.jsx';
import KeypadNumberGrid from './keypad/KeypadNumberGrid.jsx';
import KeypadAmountDisplay from './keypad/KeypadAmountDisplay.jsx';
import { newCustomItemId, DEFAULT_ITEM_NAME, DEFAULT_RETURN_ITEM_NAME } from '../utils/customItemId.js';
import { appendDigit, appendDecimal, applyMultiply } from '../utils/keypadInput.js';
import { useOwnKeyboard } from '../utils/keyboardOwner.js';
import { useRejectFlash } from '../hooks/useRejectFlash.js';

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
  useOwnKeyboard(isOpen);

  const [priceStr, setPriceStr] = useState('');
  const [name, setName] = useState('');
  const [selectedVat, setSelectedVat] = useState(() => (defaultVat !== undefined && defaultVat !== null ? parseInt(defaultVat, 10) : 21));
  const [rejectKey, flashReject] = useRejectFlash();
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
      setItemMultiplier(1);
      return;
    }

    if (val === 'BACK') {
      soundFx.playKeypadClick();
      setPriceStr(prev => (prev.length > 1 ? prev.slice(0, -1) : ''));
      return;
    }

    if (val === '.' || val === ',') {
      setPriceStr(prev => appendDecimal(prev));
      return;
    }

    setPriceStr(prev => appendDigit(prev, val));
  };

  const handleMultiply = () => {
    triggerKeyAnimation('MULTIPLY');
    const result = applyMultiply(priceStr, itemMultiplier);
    if (!result) {
      soundFx.playError();
      flashReject();
      return;
    }
    setPriceStr(result.amountStr);
    setItemMultiplier(result.itemMultiplier);
  };

  const handleAddCustomItem = (e) => {
    if (e) e.preventDefault();
    const numericAmount = parseFloat(priceStr);
    if (isNaN(numericAmount) || numericAmount === 0) return;

    const qty = Math.max(1, Math.abs(itemMultiplier || 1));
    const unitPrice = isReturn ? -Math.abs(numericAmount) : Math.abs(numericAmount);

    onAddToCart?.({
      id: id || newCustomItemId(),
      name: name.trim() || (isReturn ? DEFAULT_RETURN_ITEM_NAME : DEFAULT_ITEM_NAME),
      price: unitPrice,
      vat: selectedVat,
      quantity: qty,
      isCustom: true
    });

    soundFx.playScanChime();
    onClose?.();
  };

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
          overflowY: 'auto'
        }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '0.75rem 1rem' }}>
          <div className="modal-title" style={{ fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Calculator size={17} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isReturn ? t('keypad.sign_toggle') : (t('custom_item.title') || 'Vlastní / Nezařazená položka')}
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
                  aria-label={t('custom_item.clear_name')}
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
                    fontSize: '0.8rem',
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

          {/* ── 3. Amount display (the line total is on the Add button) ── */}
          <KeypadAmountDisplay
            testId="amount-display"
            isReturn={isReturn}
            hasValidAmount={hasValidAmount}
            multiplier={itemMultiplier}
            amountStr={priceStr}
            rejected={rejectKey}
          />

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
            amountStr={priceStr}
            onMultiply={handleMultiply}
            selectedVat={selectedVat}
            rejectKey={rejectKey}
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
