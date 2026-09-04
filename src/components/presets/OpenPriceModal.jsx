import React from 'react';
import { Tag, X, ChevronUp, ChevronDown, Delete, PlusCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { soundFx } from '../../utils/audio.js';

export default function OpenPriceModal({
  openPriceTarget,
  onClose,
  enteredOpenPrice,
  setEnteredOpenPrice,
  openPriceQty,
  setOpenPriceQty,
  onSubmit
}) {
  const { t } = useTranslation();

  if (!openPriceTarget) return null;

  const handleStepDown = () => {
    soundFx.playKeypadClick();
    setOpenPriceQty(prev => {
      const current = prev || 1;
      if (current === 1) return -1; // 1 -> -1 (activate return mode directly)
      if (current > 1) return current - 1; // 3 -> 2 -> 1
      return current - 1; // -1 -> -2 -> -3 (more returns)
    });
  };

  const handleStepUp = () => {
    soundFx.playKeypadClick();
    setOpenPriceQty(prev => {
      const current = prev || 1;
      if (current === -1) return 1; // -1 -> 1 (exit return mode)
      if (current < -1) return current + 1; // -3 -> -2 -> -1
      return current + 1; // 1 -> 2 -> 3
    });
  };

  const handleDigit = (d) => {
    soundFx.playKeypadClick();
    setEnteredOpenPrice(prev => {
      if (prev.includes('.')) {
        const parts = prev.split('.');
        if (parts[1] && parts[1].length >= 2) return prev;
      }
      return prev.length < 10 ? prev + d : prev;
    });
  };

  const handleDoubleZero = () => {
    soundFx.playKeypadClick();
    setEnteredOpenPrice(prev => {
      if (!prev || prev === '0') return '0';
      if (prev.includes('.')) {
        const parts = prev.split('.');
        if (parts[1] && parts[1].length >= 1) return prev;
      }
      return prev.length < 9 ? prev + '00' : prev;
    });
  };

  const handleComma = () => {
    soundFx.playKeypadClick();
    setEnteredOpenPrice(prev => {
      if (prev.includes('.')) return prev;
      return prev ? prev + '.' : '0.';
    });
  };

  const handleBackspace = () => {
    soundFx.playKeypadClick();
    setEnteredOpenPrice(prev => (prev.length > 1 ? prev.slice(0, -1) : ''));
  };

  const handleClear = () => {
    soundFx.playDeleteTone();
    setEnteredOpenPrice('');
  };

  const handleToggleSign = () => {
    soundFx.playKeypadClick();
    setOpenPriceQty(prev => (prev < 0 ? Math.abs(prev || 1) : -Math.abs(prev || 1)));
    setEnteredOpenPrice(prev => (prev.startsWith('-') ? prev.slice(1) : prev));
  };

  const isReturn = openPriceQty < 0 || Boolean(enteredOpenPrice && enteredOpenPrice.startsWith('-'));
  const hasValidAmount = Boolean(enteredOpenPrice && !isNaN(parseFloat(enteredOpenPrice)) && parseFloat(enteredOpenPrice) > 0);

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
            <Tag size={17} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {openPriceTarget.name}
            </span>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {/* ── Compact Amount Display Card (Matches Main Keypad) ── */}
          <div
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

              {openPriceQty !== 1 && (
                <span style={{
                  fontSize: '0.64rem',
                  fontWeight: '800',
                  color: isReturn ? 'var(--accent-rose)' : 'var(--accent-amber)',
                  background: isReturn ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  {isReturn ? `↩️ ${openPriceQty}×` : `⚡ ${openPriceQty}×`}
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
                  : (enteredOpenPrice ? 'var(--text-primary)' : 'var(--text-muted)'),
                wordBreak: 'break-all',
                flex: 1
              }}>
                {enteredOpenPrice ? `${enteredOpenPrice} Kč` : (isReturn ? '-0 Kč' : '0 Kč')}
              </div>

              {/* Inline Backspace button (Subtle & Borderless) */}
              <button
                type="button"
                onClick={handleBackspace}
                disabled={!enteredOpenPrice}
                style={{
                  width: '34px',
                  height: '34px',
                  minWidth: '34px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'transparent',
                  color: enteredOpenPrice ? 'var(--text-muted)' : 'transparent',
                  opacity: enteredOpenPrice ? 0.75 : 0,
                  cursor: enteredOpenPrice ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  padding: 0
                }}
                title="Smazat poslední znak (Backspace)"
              >
                <Delete size={18} />
              </button>
            </div>

            {/* Total calculation preview when qty > 1 */}
            {openPriceQty !== 1 && hasValidAmount && (
              <div style={{
                fontSize: '0.76rem',
                color: isReturn ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                fontWeight: '800',
                marginTop: '1px'
              }}>
                {isReturn ? '↩️ Vratka celkem: ' : '= Celkem: '}
                {(Math.abs(openPriceQty) * parseFloat(enteredOpenPrice || 0)).toLocaleString('cs-CZ')} Kč ({openPriceQty} ks)
              </div>
            )}
          </div>

          {/* ── Sleek 42px Quantity Stepper (Matches Main Keypad) ── */}
          <div
            className="keypad-stepper-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <button
              type="button"
              className="key-btn"
              onClick={handleStepDown}
              style={{
                flex: 1,
                height: '42px',
                minHeight: '42px',
                aspectRatio: 'auto',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.96rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 2px 5px rgba(239, 68, 68, 0.3)',
                cursor: 'pointer'
              }}
              title="Snížit množství (−1 / Vratka)"
            >
              <ChevronDown size={19} strokeWidth={2.5} />
              <span>-1</span>
            </button>

            <div
              className={`multiplier-badge ${isReturn ? 'has-return' : (openPriceQty > 1 ? 'has-multiplier' : '')}`}
              style={{
                flex: 1,
                height: '42px',
                minHeight: '42px',
                aspectRatio: 'auto',
                fontSize: '1.05rem',
                letterSpacing: '0.02em',
                padding: '0 0.5rem',
                borderRadius: 'var(--radius-md)'
              }}
            >
              {isReturn ? `↩️ ${openPriceQty}×` : `${openPriceQty}×`}
            </div>

            <button
              type="button"
              className="key-btn"
              onClick={handleStepUp}
              style={{
                flex: 1,
                height: '42px',
                minHeight: '42px',
                aspectRatio: 'auto',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.96rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 2px 5px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer'
              }}
              title="Zvýšit množství (+1)"
            >
              <ChevronUp size={19} strokeWidth={2.5} />
              <span>+1</span>
            </button>
          </div>

          {/* ── Standard 4×4 Touch Numpad (Matches KeypadNumberGrid) ── */}
          <div className="keypad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
            {/* Row 1: 7 8 9 ⌫ */}
            {['7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                className="key-btn"
                onClick={() => handleDigit(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              onClick={handleBackspace}
              title="Backspace"
            >
              <Delete size={22} />
            </button>

            {/* Row 2: 4 5 6 C */}
            {['4', '5', '6'].map(num => (
              <button
                key={num}
                type="button"
                className="key-btn"
                onClick={() => handleDigit(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              style={{ fontSize: '1.15rem', fontWeight: '900' }}
              onClick={handleClear}
              title="Smazat vše (Clear)"
            >
              C
            </button>

            {/* Row 3: 1 2 3 , */}
            {['1', '2', '3'].map(num => (
              <button
                key={num}
                type="button"
                className="key-btn"
                onClick={() => handleDigit(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="key-btn"
              style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--accent-blue)' }}
              onClick={handleComma}
              title="Čárka"
            >
              ,
            </button>

            {/* Row 4: 0 00 ± × */}
            <button
              type="button"
              className="key-btn"
              onClick={() => handleDigit('0')}
            >
              0
            </button>
            <button
              type="button"
              className="key-btn"
              onClick={handleDoubleZero}
            >
              00
            </button>
            <button
              type="button"
              className={`key-btn ${isReturn ? 'active-return' : ''}`}
              style={{
                fontSize: '1.45rem',
                fontWeight: '900',
                color: isReturn ? 'var(--accent-rose)' : 'var(--text-primary)',
                background: isReturn ? 'rgba(239, 68, 68, 0.15)' : undefined,
                borderColor: isReturn ? 'rgba(239, 68, 68, 0.6)' : undefined
              }}
              onClick={handleToggleSign}
              title="Změnit znaménko (± Vratka)"
            >
              ±
            </button>
            <button
              type="button"
              className="key-btn key-action"
              style={{
                fontSize: '1.45rem',
                fontWeight: '900',
                color: openPriceQty > 1 ? '#fff' : 'var(--accent-amber)',
                background: openPriceQty > 1 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined
              }}
              onClick={handleStepUp}
              title="Zvýšit množství (×)"
            >
              ×
            </button>
          </div>

          {/* ── Action Buttons Row ── */}
          <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.45rem' }}>
            <button
              type="button"
              className="nav-tab"
              style={{
                flex: 1,
                justifyContent: 'center',
                height: '52px',
                minHeight: '52px',
                fontSize: '0.95rem',
                fontWeight: '700',
                borderRadius: 'var(--radius-md)'
              }}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={`key-btn key-enter ${hasValidAmount ? 'key-enter-active' : ''}`}
              style={{
                flex: 1.8,
                height: '52px',
                minHeight: '52px',
                aspectRatio: 'auto',
                fontSize: '1.05rem',
                fontWeight: '800',
                gap: '0.5rem',
                background: isReturn && hasValidAmount
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : undefined,
                borderColor: isReturn && hasValidAmount
                  ? '#ef4444'
                  : undefined,
                boxShadow: isReturn && hasValidAmount
                  ? '0 4px 14px rgba(239, 68, 68, 0.35)'
                  : undefined
              }}
              disabled={!hasValidAmount}
            >
              <PlusCircle size={22} />
              <span>
                {isReturn
                  ? (t('keypad.add_return_item') || '↩️ Vložit Vratku Zboží')
                  : t('keypad.add_to_cart')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
