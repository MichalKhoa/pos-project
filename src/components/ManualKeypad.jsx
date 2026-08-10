import React, { useState, useEffect } from 'react';
import { Calculator, Delete, PlusCircle, ChevronUp, ChevronDown } from 'lucide-react';
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

    // Enforce max 2 decimal places
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

      if (isInput && activeEl.className.includes('keypad-label-input')) return;

      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACK');
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        handleKeyPress('CLEAR');
      } else if (e.key === '.' || e.key === ',') {
        handleKeyPress('.');
      } else if (e.key === '+' || e.key === 'Add') {
        e.preventDefault();
        if (setItemMultiplier) setItemMultiplier(prev => (prev || 1) + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountStr, label, selectedVat]);

  const hasValidAmount = parseFloat(amountStr) > 0;

  return (
    <div className="keypad-section touch-large-keypad">

      {/* ── Item name (ultra-slim 1-line bar) ─────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        height: '28px', padding: '0 0.5rem', flexShrink: 0,
        background: 'var(--bg-input)', borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <Calculator size={13} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
        <input
          type="text"
          className="keypad-label-input"
          placeholder={t('keypad.item_placeholder') || 'Název položky (volitelné)...'}
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{
            fontSize: '0.8rem', border: 'none', outline: 'none',
            background: 'transparent', width: '100%', height: '100%',
            color: 'var(--text-primary)'
          }}
        />
      </div>

      {/* ── Amount display card ───────────────────────────────── */}
      <div
        className={`keypad-amount-display ${hasValidAmount ? 'has-value' : ''}`}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          padding: '0.4rem 0.75rem', flexShrink: 0, borderRadius: '10px',
          border: itemMultiplier > 1 ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)',
          background: itemMultiplier > 1 ? 'rgba(245,158,11,0.04)' : 'var(--bg-input)',
          boxShadow: itemMultiplier > 1 ? '0 0 14px rgba(245,158,11,0.2)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{
          fontSize: '0.63rem', fontWeight: '800', textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--text-muted)'
        }}>
          {t('keypad.amount_label')}
        </span>

        {/* Big price / equation */}
        <div style={{
          fontSize: itemMultiplier > 1 ? '1.5rem' : '1.7rem',
          fontWeight: '900', fontFamily: 'var(--font-mono)',
          textAlign: 'right', lineHeight: '1.25',
          color: itemMultiplier > 1
            ? 'var(--accent-amber)'
            : (hasValidAmount ? 'var(--accent-emerald)' : 'var(--text-muted)')
        }}>
          {itemMultiplier > 1
            ? `${itemMultiplier} × ${amountStr ? `${amountStr} Kč` : '___ Kč'}`
            : (amountStr ? `${amountStr} Kč` : '0 Kč')}
        </div>

        {/* Subtotal line */}
        {itemMultiplier > 1 && hasValidAmount && (
          <div style={{
            fontSize: '0.82rem', fontWeight: '800', fontFamily: 'var(--font-mono)',
            color: 'var(--accent-emerald)', textAlign: 'right',
            borderTop: '1px dashed rgba(245,158,11,0.35)',
            paddingTop: '2px', marginTop: '2px'
          }}>
            = Celkem {(itemMultiplier * parseFloat(amountStr)).toLocaleString('cs-CZ')} Kč
          </div>
        )}
      </div>

      {/* ── Qty arrow row — directly below the amount card ───── */}
      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setItemMultiplier && setItemMultiplier(prev => Math.max(1, prev - 1))}
          disabled={itemMultiplier <= 1}
          style={{
            flex: 1, height: '34px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.3rem', borderRadius: '8px',
            background: itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--bg-input)',
            border: '1.5px solid var(--border-color)',
            fontWeight: '900', fontSize: '0.82rem',
            color: itemMultiplier > 1 ? '#000' : 'var(--text-muted)',
            opacity: itemMultiplier <= 1 ? 0.38 : 1,
            cursor: itemMultiplier > 1 ? 'pointer' : 'default',
            transition: 'all 0.15s ease', boxShadow: 'none'
          }}
          title="Snížit množství"
        >
          <ChevronDown size={16} />
          <span>-1</span>
        </button>

        <button
          type="button"
          onClick={() => { triggerKeyAnimation('INC_QTY'); if (setItemMultiplier) setItemMultiplier(prev => (prev || 1) + 1); }}
          style={{
            flex: 1, height: '34px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.3rem', borderRadius: '8px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none', fontWeight: '900', fontSize: '0.82rem', color: '#fff',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
            transition: 'all 0.15s ease'
          }}
          title="Zvýšit množství"
        >
          <ChevronUp size={16} />
          <span>+1</span>
        </button>
      </div>

      {/* ── VAT selector ──────────────────────────────────────── */}
      <div className="vat-selector" style={{ flexShrink: 0 }}>
        {[21, 12, 0].map(rate => (
          <button
            key={rate}
            type="button"
            className={`vat-btn vat-${rate} ${selectedVat === rate ? 'active' : ''}`}
            onClick={() => setSelectedVat(rate)}
            style={{ padding: '0.25rem 0', fontSize: '0.8rem' }}
          >
            DPH {rate}%
          </button>
        ))}
      </div>

      {/* ── Number grid (4 × 4 + enter bar) ─────────────────── */}
      <div className="keypad-grid">
        {/* Row 1: 7 8 9 ⌫ */}
        {['7','8','9'].map(n => (
          <button key={n} type="button"
            className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(n)}>{n}</button>
        ))}
        <button type="button"
          className={`key-btn key-action ${activeKey === 'BACK' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('BACK')} title="Backspace">
          <Delete size={20} />
        </button>

        {/* Row 2: 4 5 6 C */}
        {['4','5','6'].map(n => (
          <button key={n} type="button"
            className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(n)}>{n}</button>
        ))}
        <button type="button"
          className={`key-btn key-action ${activeKey === 'CLEAR' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('CLEAR')} title="Clear">C</button>

        {/* Row 3: 1 2 3 , */}
        {['1','2','3'].map(n => (
          <button key={n} type="button"
            className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(n)}>{n}</button>
        ))}
        <button type="button"
          className={`key-btn ${activeKey === '.' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('.')}>,</button>

        {/* Row 4: 0  00  +1ks  × */}
        <button type="button"
          className={`key-btn ${activeKey === '0' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('0')}>0</button>
        <button type="button"
          className={`key-btn ${activeKey === '00' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('00')}>00</button>

        {/* +1 ks — green quick-add */}
        <button type="button"
          className={`key-btn ${activeKey === 'INC_QTY' ? 'active-press' : ''}`}
          onClick={() => { triggerKeyAnimation('INC_QTY'); if (setItemMultiplier) setItemMultiplier(prev => (prev || 1) + 1); }}
          style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', color: '#fff', fontWeight: '900', fontSize: '0.9rem', border: 'none' }}
          title="+1 ks">+1 ks</button>

        {/* × multiplier */}
        <button type="button"
          className={`key-btn key-action ${itemMultiplier > 1 ? 'active-multiplier' : ''} ${activeKey === 'MULTIPLY' ? 'active-press' : ''}`}
          onClick={() => {
            triggerKeyAnimation('MULTIPLY');
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
          style={{
            color: itemMultiplier > 1 ? '#fff' : 'var(--accent-amber)',
            fontWeight: '800', fontSize: '1.25rem',
            background: itemMultiplier > 1 ? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)' : undefined
          }}
          title="Násobit">×</button>

        {/* Enter / Add to cart */}
        <button type="button"
          className={`key-btn key-enter ${hasValidAmount ? 'key-enter-active' : ''} ${activeKey === 'ENTER' ? 'active-press' : ''}`}
          style={{ gridColumn: 'span 4', minHeight: '46px' }}
          onClick={handleAddCustomItem}
          disabled={!hasValidAmount}>
          <PlusCircle size={20} />
          <span>{hasValidAmount ? t('keypad.add_to_cart') : t('keypad.enter_amount')}</span>
        </button>
      </div>
    </div>
  );
}
