import React, { useState, useEffect } from 'react';
import { Calculator, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import KeypadNumberGrid from './keypad/KeypadNumberGrid';
import KeypadVatSelector from './keypad/KeypadVatSelector';
import ParkedCartsDrawer from './keypad/ParkedCartsDrawer';

export default function ManualKeypad({
  onAddToCart,
  amountStr = '',
  setAmountStr,
  itemMultiplier = 1,
  setItemMultiplier,
  defaultVat = 21,
  onOpenCashDrawer,
  parkedCarts = [],
  onParkCart,
  onRestoreParkedCart,
  onDeleteParkedCart,
  hasCartItems = false
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

    if (val === 'PLUSMINUS' || val === '±') {
      setAmountStr(prev => {
        if (!prev) return '-';
        if (prev.startsWith('-')) return prev.slice(1);
        return '-' + prev;
      });
      return;
    }
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

    if (amountStr.includes('.')) {
      const parts = amountStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }

    if (amountStr.length >= 10) return;
    setAmountStr(prev => prev + val);
  };

  const handleAddCustomItem = () => {
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount === 0) return;

    const isReturn = numericAmount < 0;
    onAddToCart({
      id: `custom-${Date.now()}`,
      name: label.trim() || (isReturn ? '↩️ Vratka / Vrácené zboží' : 'Volný prodej'),
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

      if (isInput && activeEl.className?.includes('keypad-label-input')) return;

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
      {/* ── CARD 1: STANDALONE NUMERIC KEYPAD CARD ───────────────── */}
      <div
        className="keypad-section touch-large-keypad pos-standalone-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}
      >
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
            fontSize: itemMultiplier !== 1 ? '1.2rem' : '1.4rem',
            fontWeight: '900',
            fontFamily: 'var(--font-mono)',
            color: itemMultiplier < 0 ? 'var(--accent-rose)' : (itemMultiplier > 1 ? 'var(--accent-amber)' : (amountStr ? 'var(--text-primary)' : 'var(--text-muted)')),
            wordBreak: 'break-all'
          }}>
            {itemMultiplier !== 1
              ? `${itemMultiplier} × ${amountStr ? `${amountStr} Kč` : '___ Kč'} ${itemMultiplier < 0 ? '(VRATKA)' : ''}`
              : (amountStr ? `${amountStr} Kč` : '0 Kč')}
          </div>

          {/* Subtotal line */}
          {itemMultiplier !== 1 && hasValidAmount && (
            <div style={{
              fontSize: '0.82rem', fontWeight: '800', fontFamily: 'var(--font-mono)',
              color: itemMultiplier < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', textAlign: 'right',
              borderTop: '1px dashed rgba(245,158,11,0.35)',
              paddingTop: '2px', marginTop: '2px'
            }}>
              = Celkem {(itemMultiplier * parseFloat(amountStr)).toLocaleString('cs-CZ')} Kč
            </div>
          )}
        </div>

        {/* ── Qty arrow row ───── */}
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              triggerKeyAnimation('DEC_QTY');
              if (amountStr && !amountStr.startsWith('-') && itemMultiplier === 1) {
                setAmountStr('-' + amountStr);
                return;
              }
              if (setItemMultiplier) {
                setItemMultiplier(prev => {
                  if (prev === 1) return -1;
                  if (prev < 0) return prev - 1;
                  return prev - 1;
                });
              }
            }}
            style={{
              flex: 1, height: '34px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.3rem', borderRadius: '8px',
              background: (itemMultiplier < 0 || (amountStr && amountStr.startsWith('-'))) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : (itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--bg-input)'),
              border: (itemMultiplier < 0 || (amountStr && amountStr.startsWith('-'))) ? 'none' : '1.5px solid var(--border-color)',
              fontWeight: '900', fontSize: '0.85rem',
              color: (itemMultiplier < 0 || itemMultiplier > 1 || (amountStr && amountStr.startsWith('-'))) ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease', boxShadow: (itemMultiplier < 0 || (amountStr && amountStr.startsWith('-'))) ? '0 2px 8px rgba(239,68,68,0.35)' : 'none'
            }}
            title="Snížit množství / Vratka (-1)"
          >
            <ChevronDown size={16} />
            <span>-1</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerKeyAnimation('INC_QTY');
              if (amountStr && amountStr.startsWith('-') && itemMultiplier === 1) {
                setAmountStr(amountStr.slice(1));
                return;
              }
              if (setItemMultiplier) {
                setItemMultiplier(prev => {
                  if (prev === -1) return 1;
                  if (prev < -1) return prev + 1;
                  return (prev || 1) + 1;
                });
              }
            }}
            style={{
              flex: 1, height: '34px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.3rem', borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none', fontWeight: '900', fontSize: '0.85rem', color: '#fff',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
              transition: 'all 0.15s ease'
            }}
            title="Zvýšit množství (+1)"
          >
            <ChevronUp size={16} />
            <span>+1</span>
          </button>
        </div>

        {/* ── VAT selector & Return Sign Toggle (Subcomponent) ── */}
        <KeypadVatSelector
          selectedVat={selectedVat}
          setSelectedVat={setSelectedVat}
          amountStr={amountStr}
          onKeyPress={handleKeyPress}
        />

        {/* ── Number grid (Subcomponent) ── */}
        <KeypadNumberGrid
          activeKey={activeKey}
          onKeyPress={handleKeyPress}
          itemMultiplier={itemMultiplier}
          setItemMultiplier={setItemMultiplier}
          amountStr={amountStr}
          setAmountStr={setAmountStr}
          triggerKeyAnimation={triggerKeyAnimation}
          hasValidAmount={hasValidAmount}
          onAddCustomItem={handleAddCustomItem}
        />
      </div>

      {/* ── CARD 2: STANDALONE HOLD / PARK CART STORAGE CARD (Subcomponent) ── */}
      <ParkedCartsDrawer
        hasCartItems={hasCartItems}
        parkedCarts={parkedCarts}
        onParkCart={onParkCart}
        onRestoreParkedCart={onRestoreParkedCart}
        onDeleteParkedCart={onDeleteParkedCart}
        onOpenCashDrawer={onOpenCashDrawer}
      />
    </div>
  );
}
