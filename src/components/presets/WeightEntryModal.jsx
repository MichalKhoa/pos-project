import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Scale, X, Delete, PlusCircle, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { roundCZK } from '../../utils/tax.js';
import { soundFx } from '../../utils/audio.js';
import { useHoldBackspace } from '../../hooks/useHoldBackspace.js';

export default function WeightEntryModal({
  isOpen,
  onClose,
  preset,
  onAddToCart,
  initialUnitPrice = null
}) {
  const { t } = useTranslation();
  const [weightStr, setWeightStr] = useState('');
  const [unitPriceStr, setUnitPriceStr] = useState('');
  const [tareGrams, setTareGrams] = useState(0);
  const [activeField, setActiveField] = useState('weight'); // 'weight' | 'unit_price'
  const modalRef = useRef(null);

  const isOpenPrice = Boolean(
    preset?.isOpenPrice ||
    preset?.is_open_price ||
    !preset?.price ||
    preset?.price === 0 ||
    preset?.price === '0' ||
    preset?.isGeneralPreset
  );

  // Reset internal state whenever modal opens or preset changes
  useEffect(() => {
    if (isOpen) {
      setWeightStr('');
      setTareGrams(0);

      const incomingPrice = preset?.initialUnitPrice !== undefined
        ? preset.initialUnitPrice
        : (initialUnitPrice !== null && initialUnitPrice !== undefined ? initialUnitPrice : (preset?.price || ''));

      const initPriceStr = incomingPrice && parseFloat(incomingPrice) > 0 ? String(incomingPrice) : '';
      setUnitPriceStr(initPriceStr);

      if (isOpenPrice && !initPriceStr) {
        setActiveField('unit_price');
      } else {
        setActiveField('weight');
      }
    }
  }, [isOpen, preset, initialUnitPrice, isOpenPrice]);

  // Gross, tare and net weight calculations (precision in kg, up to 3 decimal places)
  const grossWeightKg = parseFloat(weightStr) || 0;
  const tareKg = tareGrams / 1000;
  const rawNetKg = grossWeightKg - tareKg;
  const netWeightKg = Math.round(rawNetKg * 1000) / 1000;
  const isValidNet = netWeightKg > 0;

  const parsedCustomPrice = parseFloat(unitPriceStr);
  const effectiveUnitPrice = isOpenPrice
    ? (!isNaN(parsedCustomPrice) && parsedCustomPrice >= 0 ? parsedCustomPrice : 0)
    : (parseFloat(preset?.price) || 0);

  const isValidPrice = effectiveUnitPrice > 0;
  const isValidSubmission = isValidNet && isValidPrice;
  const lineTotal = roundCZK(Math.max(0, netWeightKg) * effectiveUnitPrice);
  const itemUnit = preset?.unit || 'kg';

  const handleDigit = useCallback((digit) => {
    soundFx.playKeypadClick();
    if (activeField === 'unit_price') {
      setUnitPriceStr((prev) => {
        if (prev.includes('.')) {
          const parts = prev.split('.');
          if (parts[1] && parts[1].length >= 2) return prev;
        }
        if (prev === '0') return digit;
        return prev.length < 8 ? prev + digit : prev;
      });
    } else {
      setWeightStr((prev) => {
        if (prev.includes('.')) {
          const parts = prev.split('.');
          if (parts[1] && parts[1].length >= 3) return prev;
        }
        if (prev === '0') return digit;
        return prev.length < 8 ? prev + digit : prev;
      });
    }
  }, [activeField]);

  const handleDoubleZero = useCallback(() => {
    soundFx.playKeypadClick();
    if (activeField === 'unit_price') {
      setUnitPriceStr((prev) => {
        if (!prev || prev === '0') return '0';
        if (prev.includes('.')) {
          const parts = prev.split('.');
          if (parts[1] && parts[1].length >= 1) return prev;
        }
        return prev.length < 7 ? prev + '00' : prev;
      });
    } else {
      setWeightStr((prev) => {
        if (!prev || prev === '0') return '0';
        if (prev.includes('.')) {
          const parts = prev.split('.');
          if (parts[1] && parts[1].length >= 2) return prev;
        }
        return prev.length < 7 ? prev + '00' : prev;
      });
    }
  }, [activeField]);

  const handleComma = useCallback(() => {
    soundFx.playKeypadClick();
    if (activeField === 'unit_price') {
      setUnitPriceStr((prev) => {
        if (prev.includes('.')) return prev;
        return prev ? prev + '.' : '0.';
      });
    } else {
      setWeightStr((prev) => {
        if (prev.includes('.')) return prev;
        return prev ? prev + '.' : '0.';
      });
    }
  }, [activeField]);

  const handleBackspace = useCallback(() => {
    soundFx.playKeypadClick();
    if (activeField === 'unit_price') {
      setUnitPriceStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
    } else {
      setWeightStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
    }
  }, [activeField]);

  const handleClear = useCallback(() => {
    soundFx.playDeleteTone();
    if (activeField === 'unit_price') {
      setUnitPriceStr('');
    } else {
      setWeightStr('');
    }
  }, [activeField]);

  const handleToggleTare = useCallback((grams) => {
    soundFx.playKeypadClick();
    setTareGrams((prev) => (prev === grams ? 0 : grams));
  }, []);

  const handleResetTare = useCallback(() => {
    soundFx.playKeypadClick();
    setTareGrams(0);
  }, []);

  const handleSubmit = useCallback((e) => {
    if (e) e.preventDefault();

    if (activeField === 'unit_price') {
      if (effectiveUnitPrice > 0) {
        soundFx.playKeypadClick();
        setActiveField('weight');
        return;
      }
      return;
    }

    if (!isValidSubmission || !preset) {
      if (isOpenPrice && effectiveUnitPrice <= 0) {
        soundFx.playErrorTone();
        setActiveField('unit_price');
      }
      return;
    }

    soundFx.playSuccess();
    onAddToCart({
      ...preset,
      quantity: netWeightKg,
      unit: itemUnit,
      price: effectiveUnitPrice,
      isWeighted: true
    });
    onClose();
  }, [activeField, effectiveUnitPrice, isValidSubmission, preset, netWeightKg, itemUnit, isOpenPrice, onAddToCart, onClose]);

  // Physical keyboard listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeField === 'unit_price' && effectiveUnitPrice > 0) {
          soundFx.playKeypadClick();
          setActiveField('weight');
        } else if (isValidSubmission) {
          handleSubmit();
        } else if (isOpenPrice && effectiveUnitPrice <= 0) {
          soundFx.playErrorTone();
          setActiveField('unit_price');
        }
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        handleComma();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeField, effectiveUnitPrice, isValidSubmission, isOpenPrice, handleDigit, handleComma, handleBackspace, handleClear, handleSubmit, onClose]);

  const currentActiveStr = activeField === 'unit_price' ? unitPriceStr : weightStr;

  const backspaceHoldHandlers = useHoldBackspace({
    onBackspace: handleBackspace,
    onClear: handleClear,
  });

  const inlineBackspaceHandlers = useHoldBackspace({
    onBackspace: handleBackspace,
    onClear: handleClear,
    disabled: !currentActiveStr
  });

  if (!isOpen || !preset) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(3px)'
      }}
    >
      <div
        ref={modalRef}
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '94vw',
          maxWidth: '460px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 35px -8px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
            <Scale size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '1.05rem',
                  fontWeight: '800',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {preset.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {preset.category ? `${preset.category} • ` : ''}
                <span style={{ fontWeight: '700', color: 'var(--accent-blue)' }}>
                  {isOpenPrice
                    ? (effectiveUnitPrice > 0
                        ? `${effectiveUnitPrice.toFixed(2)} Kč / ${itemUnit}`
                        : `(${t('weight_modal.open_price_badge') || 'Otevřená cena'})`)
                    : `${effectiveUnitPrice.toFixed(2)} Kč / ${itemUnit}`}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md, 8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title={t('common.close') || 'Zavřít'}
            aria-label={t('common.close') || 'Zavřít'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '0.85rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            overflowY: 'auto'
          }}
        >
          {/* Open Price: Interactive Unit Price Card */}
          {isOpenPrice && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveField('unit_price')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                background: activeField === 'unit_price' ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-input))' : 'var(--bg-input)',
                border: activeField === 'unit_price' ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('weight_modal.unit_price_title') || `Cena za 1 ${itemUnit}`}
                </span>
                <span style={{ fontSize: '0.72rem', color: activeField === 'unit_price' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                  {activeField === 'unit_price' ? (t('weight_modal.active_typing') || '⌨️ Zadáváte cenu...') : (t('weight_modal.tap_to_edit') || 'Klepněte pro změnu ceny')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.45rem',
                    fontWeight: '900',
                    color: unitPriceStr ? 'var(--text-primary)' : 'var(--text-muted)'
                  }}
                >
                  {unitPriceStr || '0.00'}
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
                  Kč / {itemUnit}
                </span>
                {activeField === 'unit_price' && (
                  <button
                    type="button"
                    {...inlineBackspaceHandlers}
                    disabled={!unitPriceStr}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      border: 'none',
                      background: 'transparent',
                      color: unitPriceStr ? 'var(--text-muted)' : 'transparent',
                      opacity: unitPriceStr ? 0.75 : 0,
                      cursor: unitPriceStr ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                    title="Smazat znak"
                    aria-label="Smazat znak"
                  >
                    <Delete size={17} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Display Hero Card (Gross, Net & Line Total) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveField('weight')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              background: activeField === 'weight'
                ? (isValidNet ? 'color-mix(in srgb, var(--accent-blue) 8%, var(--bg-input))' : 'color-mix(in srgb, var(--accent-blue) 4%, var(--bg-input))')
                : 'var(--bg-input)',
              border: activeField === 'weight' ? '2px solid var(--accent-blue)' : (isValidNet ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-color)'),
              gap: '0.35rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {/* Weight Input Row */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {tareGrams > 0 ? (t('weight_modal.gross_weight') || 'Hrubá hmotnost') : (t('weight_modal.net_weight') || 'Hmotnost')}
                </span>
                {isOpenPrice && (
                  <span style={{ fontSize: '0.72rem', color: activeField === 'weight' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                    {activeField === 'weight' ? (t('weight_modal.active_typing') || '⌨️ Zadáváte váhu...') : (t('weight_modal.tap_to_edit') || 'Klepněte pro změnu')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.65rem',
                    fontWeight: '900',
                    color: weightStr ? 'var(--text-primary)' : 'var(--text-muted)',
                    letterSpacing: '0.02em'
                  }}
                >
                  {weightStr || '0.000'}
                </span>
                <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
                  {itemUnit}
                </span>
                {activeField === 'weight' && (
                  <button
                    type="button"
                    {...inlineBackspaceHandlers}
                    disabled={!weightStr}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      border: 'none',
                      background: 'transparent',
                      color: weightStr ? 'var(--text-muted)' : 'transparent',
                      opacity: weightStr ? 0.75 : 0,
                      cursor: weightStr ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                    title="Smazat znak"
                    aria-label="Smazat znak"
                  >
                    <Delete size={17} />
                  </button>
                )}
              </div>
            </div>

            {/* Tare & Net Breakdown Row */}
            {tareGrams > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.3rem',
                  borderTop: '1px dashed var(--border-color)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <span>
                  Tára: <b style={{ color: 'var(--accent-amber)' }}>-{tareKg.toFixed(3)} kg</b> (-{tareGrams} g)
                </span>
                <span>
                  Netto: <b style={{ color: isValidNet ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                    {netWeightKg > 0 ? netWeightKg.toFixed(3) : '0.000'} {itemUnit}
                  </b>
                </span>
              </div>
            )}

            {/* Real-time Line Total */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '0.35rem',
                borderTop: '1px solid var(--border-color)',
                marginTop: '0.15rem'
              }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                {t('weight_modal.line_total') || 'Celková cena'}:
              </span>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '900',
                  color: isValidNet ? 'var(--accent-emerald)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {lineTotal.toFixed(2)} Kč
              </span>
            </div>
          </div>

          {/* Tare Deduction Shortcuts Row */}
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '0.2rem' }}>
              {t('weight_modal.tare') || 'Tára'}:
            </span>
            <button
              type="button"
              className={`nav-tab ${tareGrams === 5 ? 'active' : ''}`}
              onClick={() => handleToggleTare(5)}
              style={{
                flex: 1,
                minHeight: '44px',
                height: '44px',
                fontSize: '0.85rem',
                fontWeight: '800',
                justifyContent: 'center',
                background: tareGrams === 5 ? 'var(--accent-blue)' : 'var(--bg-input)',
                color: tareGrams === 5 ? '#fff' : 'var(--text-primary)',
                borderRadius: 'var(--radius-md, 8px)',
                cursor: 'pointer'
              }}
              title="Mikrotenový sáček (-5 g)"
            >
              -5 g
            </button>
            <button
              type="button"
              className={`nav-tab ${tareGrams === 15 ? 'active' : ''}`}
              onClick={() => handleToggleTare(15)}
              style={{
                flex: 1,
                minHeight: '44px',
                height: '44px',
                fontSize: '0.85rem',
                fontWeight: '800',
                justifyContent: 'center',
                background: tareGrams === 15 ? 'var(--accent-blue)' : 'var(--bg-input)',
                color: tareGrams === 15 ? '#fff' : 'var(--text-primary)',
                borderRadius: 'var(--radius-md, 8px)',
                cursor: 'pointer'
              }}
              title="Plastová vanička (-15 g)"
            >
              -15 g
            </button>
            <button
              type="button"
              className="nav-tab"
              onClick={handleResetTare}
              disabled={tareGrams === 0}
              style={{
                minHeight: '44px',
                height: '44px',
                padding: '0 0.75rem',
                fontSize: '0.82rem',
                fontWeight: '700',
                justifyContent: 'center',
                opacity: tareGrams === 0 ? 0.4 : 1,
                borderRadius: 'var(--radius-md, 8px)',
                cursor: tareGrams === 0 ? 'default' : 'pointer'
              }}
              title={t('weight_modal.reset_tare') || 'Reset táry'}
            >
              <RotateCcw size={15} />
              <span>0 g</span>
            </button>
          </div>

          {/* 4×4 Touch Numpad Grid (min 48px buttons) */}
          <div
            className="keypad-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.45rem',
              margin: '0.2rem 0'
            }}
          >
            {/* Row 1: 7 8 9 ⌫ */}
            {['7', '8', '9'].map((n) => (
              <button
                key={n}
                type="button"
                className="key-btn"
                onClick={() => handleDigit(n)}
                style={{ minHeight: '48px', height: '48px', fontSize: '1.25rem', fontWeight: '800' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
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
                onClick={() => handleDigit(n)}
                style={{ minHeight: '48px', height: '48px', fontSize: '1.25rem', fontWeight: '800' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              onClick={handleClear}
              style={{ minHeight: '48px', height: '48px', fontSize: '1.15rem', fontWeight: '900' }}
              title="Clear"
            >
              C
            </button>

            {/* Row 3: 1 2 3 , */}
            {['1', '2', '3'].map((n) => (
              <button
                key={n}
                type="button"
                className="key-btn"
                onClick={() => handleDigit(n)}
                style={{ minHeight: '48px', height: '48px', fontSize: '1.25rem', fontWeight: '800' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="key-btn"
              onClick={handleComma}
              style={{ minHeight: '48px', height: '48px', fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-blue)' }}
              title="Čárka"
            >
              ,
            </button>

            {/* Row 4: 0 00 */}
            <button
              type="button"
              className="key-btn"
              onClick={() => handleDigit('0')}
              style={{ minHeight: '48px', height: '48px', fontSize: '1.25rem', fontWeight: '800', gridColumn: 'span 2' }}
            >
              0
            </button>
            <button
              type="button"
              className="key-btn"
              onClick={handleDoubleZero}
              style={{ minHeight: '48px', height: '48px', fontSize: '1.15rem', fontWeight: '800', gridColumn: 'span 2' }}
            >
              00
            </button>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.2rem' }}>
            <button
              type="button"
              className="nav-tab"
              onClick={onClose}
              style={{
                flex: 1,
                minHeight: '48px',
                height: '48px',
                fontSize: '0.92rem',
                fontWeight: '700',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md, 8px)'
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!(activeField === 'unit_price' ? effectiveUnitPrice > 0 : isValidSubmission)}
              className={`key-btn key-enter ${(activeField === 'unit_price' ? effectiveUnitPrice > 0 : isValidSubmission) ? 'key-enter-active' : ''}`}
              style={{
                flex: 1.8,
                minHeight: '48px',
                height: '48px',
                aspectRatio: 'auto',
                fontSize: '1rem',
                fontWeight: '800',
                gap: '0.45rem',
                borderRadius: 'var(--radius-md, 8px)',
                cursor: (activeField === 'unit_price' ? effectiveUnitPrice > 0 : isValidSubmission) ? 'pointer' : 'not-allowed',
                opacity: (activeField === 'unit_price' ? effectiveUnitPrice > 0 : isValidSubmission) ? 1 : 0.45
              }}
            >
              {activeField === 'unit_price' ? (
                <span>{t('weight_modal.switch_to_weight') || 'Pokračovat na hmotnost ➡️'}</span>
              ) : (
                <>
                  <PlusCircle size={20} />
                  <span>+ {t('weight_modal.add_to_cart') || 'Vložit do košíku'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
