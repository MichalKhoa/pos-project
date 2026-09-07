import React, { useState, useEffect, useRef, useId } from 'react';
import { Tag, X, Delete, PlusCircle, Check, Percent, Keyboard, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { soundFx } from '../utils/audio.js';
import { useHoldBackspace } from '../hooks/useHoldBackspace.js';

const CZECH_DIACRITICS = ['ě', 'š', 'č', 'ř', 'ž', 'ý', 'á', 'í', 'é', 'ú', 'ů'];

const QWERTY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const BANKNOTE_PRESETS = [100, 200, 500];
const QUANTITY_PRESETS = [1, 2, 3, 5, 10];

export default function CustomItemModal({
  isOpen = true,
  id,
  onClose,
  onAddToCart,
  defaultVat = 21,
  initialMultiplier = 1
}) {
  const { t } = useTranslation();
  const nameInputRef = useRef(null);
  const priceInputId = useId();
  const nameInputId = useId();

  const [priceStr, setPriceStr] = useState('');
  const [name, setName] = useState('');
  const [vat, setVat] = useState(() => (defaultVat !== undefined && defaultVat !== null ? parseInt(defaultVat, 10) : 21));
  const [multiplier, setMultiplier] = useState(() => Math.abs(initialMultiplier || 1));
  const [isReturnMode, setIsReturnMode] = useState(() => (initialMultiplier || 1) < 0);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isShift, setIsShift] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Retail suggestion chips
  const RETAIL_CHIPS = [
    { key: 'bakery', label: t('custom_item.quick_tags.bakery') || 'Pečivo' },
    { key: 'produce', label: t('custom_item.quick_tags.produce') || 'Ovoce/Zel' },
    { key: 'press', label: t('custom_item.quick_tags.press') || 'Tiskoviny' },
    { key: 'beverages', label: t('custom_item.quick_tags.beverages') || 'Nealko' },
    { key: 'other', label: t('custom_item.quick_tags.other') || 'Ostatní' }
  ];

  // VAT rates
  const VAT_TIERS = [
    { rate: 21, label: '21% (Zboží)', short: '21%' },
    { rate: 12, label: '12% (Potraviny)', short: '12%' },
    { rate: 0, label: '0% (Osvobozeno)', short: '0%' }
  ];

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

  // Numpad handlers
  const handleDigit = (digit) => {
    soundFx.playKeypadClick();
    setErrorMsg('');
    setPriceStr((prev) => {
      if (prev.includes('.')) {
        const parts = prev.split('.');
        if (parts[1] && parts[1].length >= 2) return prev;
      }
      return prev.length < 10 ? prev + digit : prev;
    });
  };

  const handleDoubleZero = () => {
    soundFx.playKeypadClick();
    setErrorMsg('');
    setPriceStr((prev) => {
      if (!prev || prev === '0') return '0';
      if (prev.includes('.')) {
        const parts = prev.split('.');
        if (parts[1] && parts[1].length >= 1) return prev;
      }
      return prev.length < 9 ? prev + '00' : prev;
    });
  };

  const handleDecimal = () => {
    soundFx.playKeypadClick();
    setErrorMsg('');
    setPriceStr((prev) => {
      if (prev.includes('.')) return prev;
      return prev ? prev + '.' : '0.';
    });
  };

  const handleBackspace = () => {
    soundFx.playKeypadClick();
    setErrorMsg('');
    setPriceStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
  };

  const handleClear = () => {
    soundFx.playDeleteTone();
    setErrorMsg('');
    setPriceStr('');
  };

  const handleToggleSign = () => {
    soundFx.playKeypadClick();
    setIsReturnMode((prev) => !prev);
  };

  const handleBanknotePreset = (amount) => {
    soundFx.playKeypadClick();
    setErrorMsg('');
    setPriceStr(String(amount));
  };

  // Stepper handlers
  const handleStepDown = () => {
    soundFx.playKeypadClick();
    if (multiplier === 1 && !isReturnMode) {
      setIsReturnMode(true);
      return;
    }
    if (multiplier > 1) {
      setMultiplier((prev) => prev - 1);
    }
  };

  const handleStepUp = () => {
    soundFx.playKeypadClick();
    if (isReturnMode && multiplier === 1) {
      setIsReturnMode(false);
      return;
    }
    setMultiplier((prev) => prev + 1);
  };

  // Keyboard handlers
  const handleKeyClick = (char) => {
    soundFx.playKeypadClick();
    const finalChar = isShift ? char.toUpperCase() : char.toLowerCase();
    setName((prev) => prev + finalChar);
    if (isShift) {
      setIsShift(false);
    }
  };

  const handleKeyboardBackspace = () => {
    soundFx.playKeypadClick();
    setName((prev) => prev.slice(0, -1));
  };

  const handleKeyboardClear = () => {
    soundFx.playDeleteTone();
    setName('');
  };

  const handleKeyboardSpace = () => {
    soundFx.playKeypadClick();
    setName((prev) => prev + ' ');
  };

  const backspaceHoldHandlers = useHoldBackspace({
    onBackspace: handleBackspace,
    onClear: handleClear
  });

  // Price validation
  const numPrice = parseFloat(priceStr.replace(',', '.'));
  const hasValidPrice = !isNaN(numPrice) && numPrice > 0;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!hasValidPrice) {
      setErrorMsg(t('keypad.enter_amount') || 'Zadejte platnou cenu');
      return;
    }

    const effectiveQty = Math.max(1, multiplier);
    const unitPrice = isReturnMode ? -Math.abs(numPrice) : Math.abs(numPrice);
    const trimmedName = name.trim();
    const defaultName = isReturnMode
      ? (t('cart.refund_title') || '↩️ Vratka / Vrácené zboží')
      : (t('cart.custom_sale') || 'Volný prodej');
    const finalName = trimmedName || defaultName;

    const itemPayload = {
      id: id || `custom-${Date.now()}`,
      name: finalName,
      price: unitPrice,
      vat: parseInt(vat, 10),
      quantity: effectiveQty,
      isCustom: true
    };

    soundFx.playScanChime();
    onAddToCart?.(itemPayload);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '0.75rem'
      }}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95vw',
          maxWidth: '560px',
          maxHeight: '92dvh',
          background: 'var(--bg-card, #1e293b)',
          borderRadius: 'var(--radius-lg, 1rem)',
          border: '1px solid var(--border-color, #334155)',
          boxShadow: 'var(--shadow-card-elevated, 0 25px 50px -12px rgba(0, 0, 0, 0.5))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #f8fafc)'
        }}
      >
        {/* ── Modal Header ── */}
        <div
          className="modal-header"
          style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div
            className="modal-title"
            style={{
              fontSize: '1.1rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-primary, #f8fafc)'
            }}
          >
            <Tag size={20} style={{ color: 'var(--accent-blue, #38bdf8)', flexShrink: 0 }} />
            <span>{t('custom_item.title') || 'Vlastní / Nezařazená položka'}</span>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            aria-label={t('common.close') || 'Zavřít'}
            style={{
              background: 'rgba(225, 29, 72, 0.15)',
              color: 'var(--accent-rose, #f43f5e)',
              border: '1.5px solid rgba(225, 29, 72, 0.35)',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable if touch keyboard open) ── */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            overflowY: 'auto',
            flex: 1
          }}
        >
          {/* Error Message */}
          {errorMsg && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-md, 0.5rem)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-rose, #f43f5e)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.88rem',
                fontWeight: '700'
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* ── 1. Amount Display Card ── */}
          <div
            className={`keypad-amount-display ${hasValidPrice ? 'has-value' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md, 0.5rem)',
              border: isReturnMode
                ? '2px solid var(--accent-rose, #ef4444)'
                : (hasValidPrice ? '2px solid var(--accent-blue, #0284c7)' : '1px solid var(--border-color, #334155)'),
              background: isReturnMode
                ? 'rgba(239, 68, 68, 0.08)'
                : (hasValidPrice ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-input, #0f172a)'),
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                htmlFor={priceInputId}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isReturnMode ? 'var(--accent-rose, #ef4444)' : 'var(--text-muted, #94a3b8)'
                }}
              >
                {isReturnMode
                  ? '↩️ Vratka — Cena k odečtení'
                  : (t('custom_item.price_label') || 'Prodejní cena (Kč)')}
              </label>

              {multiplier > 1 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    color: isReturnMode ? 'var(--accent-rose, #ef4444)' : 'var(--accent-amber, #f59e0b)',
                    background: isReturnMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {isReturnMode ? `↩️ ${multiplier}×` : `⚡ ${multiplier}×`}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '2px' }}>
              <div
                data-testid="amount-display"
                style={{
                  fontSize: '1.65rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-mono, monospace)',
                  color: isReturnMode
                    ? 'var(--accent-rose, #ef4444)'
                    : (priceStr ? 'var(--text-primary, #f8fafc)' : 'var(--text-muted, #94a3b8)'),
                  wordBreak: 'break-all',
                  flex: 1
                }}
              >
                {priceStr ? `${isReturnMode ? '-' : ''}${priceStr} Kč` : (isReturnMode ? '-0 Kč' : '0 Kč')}
              </div>

              {/* Hidden semantic input for form / accessibility */}
              <input
                id={priceInputId}
                type="hidden"
                aria-label={t('custom_item.price_label') || 'Cena'}
                value={priceStr}
                readOnly
              />

              {/* Inline Clear / Backspace */}
              {priceStr && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-sm, 0.375rem)',
                    border: 'none',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--accent-rose, #ef4444)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Smazat částku (Clear)"
                >
                  <Delete size={18} />
                </button>
              )}
            </div>

            {/* Total calculation preview when multiplier > 1 */}
            {multiplier > 1 && hasValidPrice && (
              <div
                style={{
                  fontSize: '0.82rem',
                  color: isReturnMode ? 'var(--accent-rose, #ef4444)' : 'var(--accent-emerald, #10b981)',
                  fontWeight: '800',
                  marginTop: '2px'
                }}
              >
                {isReturnMode ? '↩️ Vratka celkem: ' : '= Celkem: '}
                {(multiplier * (isReturnMode ? -numPrice : numPrice)).toLocaleString('cs-CZ')} Kč ({multiplier} ks)
              </div>
            )}
          </div>

          {/* ── Banknote Quick Chips (100, 200, 500 Kč) ── */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {BANKNOTE_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                className="chip-btn"
                aria-label={String(amt)}
                data-key={String(amt)}
                onClick={() => handleBanknotePreset(amt)}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md, 0.5rem)',
                  border: priceStr === String(amt)
                    ? '2px solid var(--accent-blue, #0284c7)'
                    : '1px solid var(--border-color, #334155)',
                  background: priceStr === String(amt)
                    ? 'rgba(2, 132, 199, 0.2)'
                    : 'var(--bg-main, #0f172a)',
                  color: priceStr === String(amt) ? '#38bdf8' : 'var(--text-primary, #f8fafc)',
                  fontSize: '0.92rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                +{amt} Kč
              </button>
            ))}
          </div>

          {/* ── 2. Large Touch Numpad Grid ── */}
          <div
            className="keypad-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.4rem',
              width: '100%'
            }}
          >
            {/* Row 1: 7 8 9 ⌫ */}
            {['7', '8', '9'].map((n) => (
              <button
                key={n}
                type="button"
                className="key-btn"
                aria-label={n}
                data-key={n}
                onClick={() => handleDigit(n)}
                style={{ minHeight: '48px', height: '48px', fontSize: '1.25rem' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              aria-label="Backspace"
              {...backspaceHoldHandlers}
              style={{ minHeight: '48px', height: '48px' }}
              title="Backspace"
            >
              <Delete size={20} />
            </button>

            {/* Row 2: 4 5 6 C */}
            {['4', '5', '6'].map((n) => (
              <button
                key={n}
                type="button"
                className="key-btn"
                aria-label={n}
                data-key={n}
                onClick={() => handleDigit(n)}
                style={{ minHeight: '48px', height: '48px', fontSize: '1.25rem' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              aria-label="Clear"
              onClick={handleClear}
              style={{ minHeight: '48px', height: '48px', fontSize: '1.1rem', fontWeight: '900' }}
              title="Smazat vše (Clear)"
            >
              C
            </button>

            {/* Row 3: 1 2 3 . */}
            {['1', '2', '3'].map((n) => (
              <button
                key={n}
                type="button"
                className="key-btn"
                aria-label={n}
                data-key={n}
                onClick={() => handleDigit(n)}
                style={{ minHeight: '48px', height: '48px', fontSize: '1.25rem' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="key-btn"
              aria-label="."
              onClick={handleDecimal}
              style={{ minHeight: '48px', height: '48px', fontSize: '1.4rem', fontWeight: '900', color: 'var(--accent-blue, #0284c7)' }}
              title="Desetinná čárka"
            >
              ,
            </button>

            {/* Row 4: 0 00 ± Multiply */}
            <button
              type="button"
              className="key-btn"
              aria-label="0"
              data-key="0"
              onClick={() => handleDigit('0')}
              style={{ minHeight: '48px', height: '48px', fontSize: '1.25rem' }}
            >
              0
            </button>
            <button
              type="button"
              className="key-btn"
              aria-label="00"
              data-key="00"
              onClick={handleDoubleZero}
              style={{ minHeight: '48px', height: '48px', fontSize: '1.1rem', fontWeight: '800' }}
            >
              00
            </button>
            <button
              type="button"
              className={`key-btn ${isReturnMode ? 'active-return' : ''}`}
              aria-label="±"
              onClick={handleToggleSign}
              style={{
                minHeight: '48px',
                height: '48px',
                fontSize: '1.35rem',
                fontWeight: '900',
                color: isReturnMode ? 'var(--accent-rose, #ef4444)' : 'var(--text-primary, #f8fafc)',
                background: isReturnMode ? 'rgba(239, 68, 68, 0.15)' : undefined,
                borderColor: isReturnMode ? 'rgba(239, 68, 68, 0.6)' : undefined
              }}
              title="Změnit znaménko (± Vratka)"
            >
              ±
            </button>
            <button
              type="button"
              className="key-btn"
              aria-label="Násobit"
              onClick={handleStepUp}
              style={{
                minHeight: '48px',
                height: '48px',
                fontSize: '1.2rem',
                fontWeight: '900',
                color: multiplier > 1 ? '#ffffff' : 'var(--accent-amber, #f59e0b)',
                background: multiplier > 1 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined
              }}
              title="Zvýšit množství (×)"
            >
              ×
            </button>
          </div>

          {/* ── 3. VAT Rate Selector ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label
              style={{
                fontSize: '0.8rem',
                fontWeight: '700',
                color: 'var(--text-primary, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Percent size={14} style={{ color: 'var(--accent-blue, #0284c7)' }} />
              <span>{t('custom_item.vat_label') || 'Sazba DPH'}</span>
            </label>
            <div
              role="radiogroup"
              aria-label={t('custom_item.vat_label') || 'Sazba DPH'}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}
            >
              {VAT_TIERS.map((tier) => {
                const isSelected = vat === tier.rate;
                return (
                  <button
                    key={tier.rate}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${tier.rate}%`}
                    className={`vat-btn vat-${tier.rate} ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      soundFx.playKeypadClick();
                      setVat(tier.rate);
                    }}
                    style={{
                      minHeight: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-md, 0.5rem)',
                      border: isSelected
                        ? '2px solid var(--accent-blue, #0284c7)'
                        : '1px solid var(--border-color, #334155)',
                      backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.2)' : 'var(--bg-main, #0f172a)',
                      color: isSelected ? '#38bdf8' : 'var(--text-primary, #f8fafc)',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isSelected && <Check size={14} />}
                    <span>{tier.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 4. Quantity Multiplier Chips & Stepper ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary, #f8fafc)' }}>
                Množství položek
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', fontWeight: '600' }}>
                {isReturnMode ? `↩️ Vratka ${multiplier} ks` : `${multiplier} ks`}
              </span>
            </div>

            {/* Stepper bar + Fast Multiplier Chips */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                type="button"
                className="key-btn"
                aria-label="Snížit množství"
                onClick={handleStepDown}
                style={{
                  width: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md, 0.5rem)',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Snížit množství (-1)"
              >
                <ChevronDown size={18} strokeWidth={2.5} />
              </button>

              <div style={{ display: 'flex', gap: '0.3rem', flex: 1, overflowX: 'auto' }}>
                {QUANTITY_PRESETS.map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    className="chip-btn"
                    aria-label={`${qty}x`}
                    data-key={`${qty}x`}
                    onClick={() => {
                      soundFx.playKeypadClick();
                      setMultiplier(qty);
                    }}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-md, 0.5rem)',
                      border: multiplier === qty
                        ? '2px solid var(--accent-amber, #f59e0b)'
                        : '1px solid var(--border-color, #334155)',
                      background: multiplier === qty
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'var(--bg-main, #0f172a)',
                      color: multiplier === qty ? '#fbbf24' : 'var(--text-primary, #f8fafc)',
                      fontSize: '0.88rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {qty}×
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="key-btn"
                aria-label="Zvýšit množství"
                onClick={handleStepUp}
                style={{
                  width: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md, 0.5rem)',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Zvýšit množství (+1)"
              >
                <ChevronUp size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* ── 5. Description Input & Retail Suggestions ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                htmlFor={nameInputId}
                style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary, #f8fafc)' }}
              >
                {t('custom_item.name_label') || 'Název / Popis položky'}
              </label>

              {/* On-screen touch keyboard toggle */}
              <button
                type="button"
                className="chip-btn"
                aria-label={t('custom_item.keyboard_toggle') || 'Klávesnice'}
                onClick={() => {
                  soundFx.playKeypadClick();
                  setShowKeyboard((prev) => !prev);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-md, 0.5rem)',
                  border: showKeyboard ? '1.5px solid #38bdf8' : '1px solid var(--border-color, #334155)',
                  background: showKeyboard ? 'rgba(2, 132, 199, 0.25)' : 'var(--bg-main, #0f172a)',
                  color: showKeyboard ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  minHeight: '36px'
                }}
              >
                <Keyboard size={15} />
                <span>{t('custom_item.keyboard_toggle') || 'Klávesnice'}</span>
              </button>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id={nameInputId}
                ref={nameInputRef}
                type="text"
                aria-label={t('custom_item.name_label') || 'Název položky'}
                placeholder={t('custom_item.name_placeholder') || 'Zadejte název položky (volitelné)...'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 2.4rem 0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md, 0.5rem)',
                  border: '1px solid var(--border-color, #334155)',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: '0.95rem',
                  minHeight: '44px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {name && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  style={{
                    position: 'absolute',
                    right: '0.4rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    padding: '0.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Smazat název"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Retail Quick Suggestion Chips */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingTop: '2px' }}>
              {RETAIL_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="chip-btn"
                  aria-label={chip.label}
                  data-key={chip.label}
                  onClick={() => {
                    soundFx.playKeypadClick();
                    setName(chip.label);
                  }}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-md, 0.5rem)',
                    border: name === chip.label
                      ? '1.5px solid var(--accent-blue, #0284c7)'
                      : '1px solid var(--border-color, #334155)',
                    background: name === chip.label
                      ? 'rgba(2, 132, 199, 0.18)'
                      : 'var(--bg-main, #0f172a)',
                    color: name === chip.label ? '#38bdf8' : 'var(--text-primary, #f8fafc)',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    minHeight: '40px'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── 6. On-Screen Touch QWERTY Keyboard (Collapsible) ── */}
          {showKeyboard && (
            <div
              className="touch-keyboard-container"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                padding: '0.65rem',
                borderRadius: 'var(--radius-md, 0.5rem)',
                backgroundColor: 'var(--bg-main, #0f172a)',
                border: '1px solid var(--border-color, #334155)'
              }}
            >
              {/* Czech Diacritic Row */}
              <div style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
                {CZECH_DIACRITICS.map((char) => {
                  const displayChar = isShift ? char.toUpperCase() : char;
                  return (
                    <button
                      key={char}
                      type="button"
                      className="key-btn"
                      aria-label={char}
                      data-key={char}
                      onClick={() => handleKeyClick(char)}
                      style={{
                        flex: 1,
                        minHeight: '42px',
                        height: '42px',
                        fontSize: '1rem',
                        fontWeight: '800',
                        color: 'var(--accent-blue, #38bdf8)'
                      }}
                    >
                      {displayChar}
                    </button>
                  );
                })}
              </div>

              {/* QWERTY Row 1 */}
              <div style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
                {QWERTY_ROWS[0].map((char) => {
                  const displayChar = isShift ? char.toUpperCase() : char;
                  return (
                    <button
                      key={char}
                      type="button"
                      className="key-btn"
                      aria-label={char}
                      data-key={char}
                      onClick={() => handleKeyClick(char)}
                      style={{ flex: 1, minHeight: '42px', height: '42px', fontSize: '1rem', fontWeight: '800' }}
                    >
                      {displayChar}
                    </button>
                  );
                })}
              </div>

              {/* QWERTY Row 2 */}
              <div style={{ display: 'flex', gap: '0.25rem', width: '100%', paddingLeft: '4px', paddingRight: '4px' }}>
                {QWERTY_ROWS[1].map((char) => {
                  const displayChar = isShift ? char.toUpperCase() : char;
                  return (
                    <button
                      key={char}
                      type="button"
                      className="key-btn"
                      aria-label={char}
                      data-key={char}
                      onClick={() => handleKeyClick(char)}
                      style={{ flex: 1, minHeight: '42px', height: '42px', fontSize: '1rem', fontWeight: '800' }}
                    >
                      {displayChar}
                    </button>
                  );
                })}
              </div>

              {/* QWERTY Row 3 (with Shift & Backspace) */}
              <div style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
                <button
                  type="button"
                  className={`key-btn ${isShift ? 'active-multiplier' : ''}`}
                  aria-label="Shift"
                  data-key="Shift"
                  onClick={() => setIsShift((prev) => !prev)}
                  style={{
                    flex: 1.4,
                    minHeight: '42px',
                    height: '42px',
                    fontSize: '0.85rem',
                    fontWeight: '900',
                    background: isShift ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : undefined,
                    color: isShift ? '#ffffff' : undefined
                  }}
                  title="Shift / Velká písmena"
                >
                  ⇧ Shift
                </button>
                {QWERTY_ROWS[2].map((char) => {
                  const displayChar = isShift ? char.toUpperCase() : char;
                  return (
                    <button
                      key={char}
                      type="button"
                      className="key-btn"
                      aria-label={char}
                      data-key={char}
                      onClick={() => handleKeyClick(char)}
                      style={{ flex: 1, minHeight: '42px', height: '42px', fontSize: '1rem', fontWeight: '800' }}
                    >
                      {displayChar}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="key-btn key-action"
                  aria-label="⌫"
                  data-key="⌫"
                  onClick={handleKeyboardBackspace}
                  style={{ flex: 1.4, minHeight: '42px', height: '42px' }}
                  title="Smazat znak"
                >
                  <Delete size={18} />
                </button>
              </div>

              {/* Bottom Control Row: Space & Clear */}
              <div style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
                <button
                  type="button"
                  className="key-btn"
                  aria-label="Mezera"
                  data-key="Mezera"
                  onClick={handleKeyboardSpace}
                  style={{ flex: 3, minHeight: '42px', height: '42px', fontSize: '0.9rem', fontWeight: '800' }}
                >
                  Mezera
                </button>
                <button
                  type="button"
                  className="key-btn key-action"
                  aria-label="Clear text"
                  data-key="Clear"
                  onClick={handleKeyboardClear}
                  style={{ flex: 1, minHeight: '42px', height: '42px', fontSize: '0.85rem', fontWeight: '800' }}
                >
                  Smazat
                </button>
              </div>
            </div>
          )}

          {/* ── 7. Action Footer Buttons ── */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="nav-tab"
              aria-label={t('common.cancel') || 'Zrušit'}
              onClick={onClose}
              style={{
                flex: 1,
                height: '50px',
                minHeight: '50px',
                fontSize: '0.95rem',
                fontWeight: '700',
                borderRadius: 'var(--radius-md, 0.5rem)',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {t('common.cancel') || 'Zrušit'}
            </button>

            <button
              type="submit"
              className={`key-btn key-enter ${hasValidPrice ? 'key-enter-active' : ''}`}
              aria-label={t('custom_item.add_to_cart') || 'Vložit do košíku'}
              disabled={!hasValidPrice}
              style={{
                flex: 1.8,
                height: '50px',
                minHeight: '50px',
                aspectRatio: 'auto',
                fontSize: '1rem',
                fontWeight: '800',
                gap: '0.45rem',
                background: isReturnMode && hasValidPrice
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : undefined,
                borderColor: isReturnMode && hasValidPrice ? '#ef4444' : undefined,
                boxShadow: isReturnMode && hasValidPrice ? '0 4px 14px rgba(239, 68, 68, 0.35)' : undefined,
                cursor: hasValidPrice ? 'pointer' : 'not-allowed',
                opacity: hasValidPrice ? 1 : 0.6
              }}
            >
              <PlusCircle size={20} />
              <span>
                {isReturnMode
                  ? (t('keypad.add_return_item') || '↩️ Vložit Vratku Zboží')
                  : (t('custom_item.add_to_cart') || 'Vložit do košíku')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
