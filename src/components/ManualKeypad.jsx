import React, { useState, useEffect } from 'react';
import { Calculator, Delete, PlusCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

export default function ManualKeypad({
  onAddToCart,
  amountStr = '',
  setAmountStr,
  itemMultiplier = 1,
  setItemMultiplier,
  defaultVat = 21
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [selectedVat, setSelectedVat] = useState(() => defaultVat !== undefined ? parseInt(defaultVat, 10) : 21);
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (defaultVat !== undefined && defaultVat !== null) {
      setSelectedVat(parseInt(defaultVat, 10));
    }
  }, [defaultVat]);

  const triggerKeyAnimation = (key) => {
    setActiveKey(key);
    setTimeout(() => setActiveKey(null), 150);
  };

  const handleKeyPress = (val) => {
    if (!setAmountStr) return;
    triggerKeyAnimation(val);

    if (val === 'CLEAR') {
      setAmountStr('');
      if (setItemMultiplier) setItemMultiplier(1);
      return;
    }
    if (val === 'BACK') {
      setAmountStr(prev => prev.slice(0, -1));
      return;
    }
    if (val === '.' || val === ',') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => (prev ? prev + '.' : '0.'));
      return;
    }
    if (val === '.00') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => (prev ? prev + '.00' : '0.00'));
      return;
    }

    // Enforce max 2 decimal places after decimal point
    if (amountStr.includes('.')) {
      const parts = amountStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }

    if (amountStr.length >= 10) return;

    setAmountStr(prev => prev + val);
  };

  const handleAddCustomItem = () => {
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    onAddToCart({
      id: `custom-${Date.now()}`,
      name: label.trim() || 'Volný prodej',
      price: numericAmount,
      vat: selectedVat,
      quantity: itemMultiplier || 1,
      isCustom: true
    });

    // Reset keypad
    if (setAmountStr) setAmountStr('');
    setLabel('');
    if (setItemMultiplier && itemMultiplier !== 1) setItemMultiplier(1);
    triggerKeyAnimation('ENTER');
  };

  // Hardware numpad & keyboard hotkey listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomItem();
        return;
      }

      if (isInput && activeEl.className.includes('keypad-label-input')) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACK');
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        handleKeyPress('CLEAR');
      } else if (e.key === '.' || e.key === ',') {
        handleKeyPress('.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountStr, label, selectedVat]);

  const hasValidAmount = parseFloat(amountStr) > 0;

  return (
    <div className="keypad-section touch-large-keypad">
      <div className="section-header" style={{ marginBottom: '0.2rem' }}>
        <div className="section-title">
          <Calculator size={20} style={{ color: 'var(--accent-emerald)' }} />
          <span style={{ fontSize: '1.05rem', fontWeight: '800' }}>{t('keypad.manual_title')}</span>
        </div>
      </div>

      {/* Row 1: Item Description Input */}
      <div className="keypad-input-container" style={{ width: '100%' }}>
        <input
          type="text"
          className="keypad-label-input"
          placeholder={t('keypad.item_placeholder')}
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ fontSize: '1.05rem', padding: '0.4rem 0' }}
        />
      </div>

      {/* Row 2: Amount & Live Formula Display Line */}
      <div
        className={`keypad-amount-display ${hasValidAmount ? 'has-value' : ''}`}
        style={{
          width: '100%',
          minWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '0.65rem 1rem',
          border: itemMultiplier > 1 ? '2px solid var(--accent-amber)' : undefined,
          boxShadow: itemMultiplier > 1 ? '0 0 18px rgba(245, 158, 11, 0.3)' : undefined,
          transition: 'all 0.25s ease'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {t('keypad.amount_label')}
            {itemMultiplier > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (setItemMultiplier) setItemMultiplier(1);
                  if (setAmountStr) setAmountStr('');
                }}
                style={{
                  background: 'var(--accent-amber)',
                  border: 'none',
                  color: '#000',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {t('keypad.cancel_multiplier')}
              </button>
            )}
          </span>
        </div>

        {/* Giant Live Equation or Single Price */}
        <div style={{
          fontSize: itemMultiplier > 1 ? '2.1rem' : '2.2rem',
          fontWeight: '900',
          fontFamily: 'var(--font-mono)',
          color: itemMultiplier > 1 ? 'var(--accent-amber)' : (hasValidAmount ? 'var(--accent-emerald)' : 'var(--text-muted)'),
          width: '100%',
          textAlign: 'right',
          marginTop: '-2px',
          transition: 'all 0.2s ease'
        }}>
          {itemMultiplier > 1
            ? `${itemMultiplier} × ${amountStr ? `${amountStr} Kč` : '___ Kč'}`
            : (amountStr ? `${amountStr} Kč` : '0 Kč')
          }
        </div>

        {/* Subtotal Calculation Callout Line */}
        {itemMultiplier > 1 && hasValidAmount && (
          <div style={{
            fontSize: '0.95rem',
            fontWeight: '800',
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-emerald)',
            width: '100%',
            textAlign: 'right',
            marginTop: '2px',
            borderTop: '1px dashed rgba(245, 158, 11, 0.3)',
            paddingTop: '3px'
          }}>
            = Celkem {(itemMultiplier * parseFloat(amountStr)).toLocaleString('cs-CZ')} Kč
          </div>
        )}
      </div>

      {/* Row 3: Prechosen Vibrant VAT Selector */}
      <div className="vat-selector" style={{ gap: '0.5rem' }}>
        {[21, 12, 0].map(rate => (
          <button
            key={rate}
            type="button"
            className={`vat-btn vat-${rate} ${selectedVat === rate ? 'active' : ''}`}
            onClick={() => setSelectedVat(rate)}
            style={{ padding: '0.6rem 0.5rem', fontSize: '0.9rem' }}
          >
            DPH {rate}%
          </button>
        ))}
      </div>

      {/* Complete 4x4 Keypad Grid (16 Full Buttons + Enter Row) */}
      <div className="keypad-grid">
        {/* Row 1: 7, 8, 9, Backspace */}
        {['7', '8', '9'].map(num => (
          <button
            key={num}
            type="button"
            className={`key-btn ${activeKey === num ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(num)}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          className={`key-btn key-action ${activeKey === 'BACK' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('BACK')}
          title="Backspace"
        >
          <Delete size={24} />
        </button>

        {/* Row 2: 4, 5, 6, Clear */}
        {['4', '5', '6'].map(num => (
          <button
            key={num}
            type="button"
            className={`key-btn ${activeKey === num ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(num)}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          className={`key-btn key-action ${activeKey === 'CLEAR' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('CLEAR')}
          title="Clear"
        >
          C
        </button>

        {/* Row 3: 1, 2, 3, Decimal Comma */}
        {['1', '2', '3'].map(num => (
          <button
            key={num}
            type="button"
            className={`key-btn ${activeKey === num ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(num)}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          className={`key-btn ${activeKey === '.' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('.')}
          title=","
        >
          ,
        </button>

        {/* Row 4: 0, 00, 000, .00 (Perfect 16-Button Complete 4x4 Grid) */}
        <button
          type="button"
          className={`key-btn ${activeKey === '0' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('0')}
        >
          0
        </button>
        <button
          type="button"
          className={`key-btn ${activeKey === '00' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('00')}
        >
          00
        </button>
        <button
          type="button"
          className={`key-btn key-action ${itemMultiplier > 1 ? 'active-multiplier' : ''} ${activeKey === 'MULTIPLY' ? 'active-press' : ''}`}
          onClick={() => {
            triggerKeyAnimation('MULTIPLY');
            // If multiplier is already active (> 1), clicking x again cancels multiplier
            if (itemMultiplier > 1) {
              if (setItemMultiplier) setItemMultiplier(1);
              if (setAmountStr) setAmountStr('');
              return;
            }

            if (amountStr && !amountStr.includes('.')) {
              const q = parseInt(amountStr, 10);
              if (!isNaN(q) && q >= 1 && q <= 99) {
                if (setItemMultiplier) setItemMultiplier(q);
                if (setAmountStr) setAmountStr('');
              }
            }
          }}
          title="Multiplikátor množství (např. 5 × 120 Kč)"
          style={{
            background: itemMultiplier > 1 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined,
            color: itemMultiplier > 1 ? '#ffffff' : 'var(--accent-amber)',
            fontWeight: '800',
            fontSize: '1.35rem'
          }}
        >
          ×
        </button>
        <button
          type="button"
          className={`key-btn ${activeKey === '.00' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('.00')}
          title=".00"
        >
          .00
        </button>

        {/* Bottom Row: Add to Cart Action Bar (Span 4) */}
        <button
          type="button"
          className={`key-btn key-enter ${hasValidAmount ? 'key-enter-active' : ''} ${activeKey === 'ENTER' ? 'active-press' : ''}`}
          style={{ gridColumn: 'span 4', height: '62px', marginTop: '0.35rem' }}
          onClick={handleAddCustomItem}
          disabled={!hasValidAmount}
        >
          <PlusCircle size={24} />
          <span>{hasValidAmount ? t('keypad.add_to_cart') : t('keypad.enter_amount')}</span>
        </button>
      </div>
    </div>
  );
}
