import React, { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import KeypadNumberGrid from './keypad/KeypadNumberGrid';
import KeypadVatSelector from './keypad/KeypadVatSelector';
import KeypadStepperBar from './keypad/KeypadStepperBar';
import ParkedCartsDrawer from './keypad/ParkedCartsDrawer';
import ShiftStatsWidget from './keypad/ShiftStatsWidget';

export default function ManualKeypad({
  onAddToCart,
  amountStr = '',
  setAmountStr,
  itemMultiplier = 1,
  setItemMultiplier,
  defaultVat = 21,
  parkedCarts = [],
  onParkCart,
  onRestoreParkedCart,
  onDeleteParkedCart,
  hasCartItems = false,
  salesHistory = [],
  onNavigateToHistory
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
      const currentlyReturn = (itemMultiplier < 0) || Boolean(amountStr && amountStr.startsWith('-'));
      if (currentlyReturn) {
        // Toggle return mode OFF
        if (setItemMultiplier && itemMultiplier < 0) {
          setItemMultiplier(Math.abs(itemMultiplier));
        }
        setAmountStr(prev => (prev.startsWith('-') ? prev.slice(1) : prev));
      } else {
        // Toggle return mode ON
        setAmountStr(prev => (prev ? '-' + prev : '-'));
      }
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

  const isReturn = (itemMultiplier < 0) || Boolean(amountStr && amountStr.startsWith('-'));
  const hasValidAmount = !isNaN(parseFloat(amountStr)) && parseFloat(amountStr) !== 0;

  const handleAddCustomItem = () => {
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount === 0) return;

    const qty = Math.max(1, Math.abs(itemMultiplier || 1));
    const unitPrice = isReturn ? -Math.abs(numericAmount) : Math.abs(numericAmount);

    onAddToCart({
      id: `custom-${Date.now()}`,
      name: label.trim() || (isReturn ? '↩️ Vratka / Vrácené zboží' : 'Volný prodej'),
      price: unitPrice,
      vat: selectedVat,
      quantity: qty,
      isCustom: true
    });

    if (setAmountStr) setAmountStr('');
    setLabel('');
    if (setItemMultiplier && itemMultiplier !== 1) setItemMultiplier(1);
    triggerKeyAnimation('ENTER');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%', overflowY: 'auto' }}>
      {/* ── CARD 1: NUMERIC KEYPAD SECTION ───────────────── */}
      <div
        className="keypad-section touch-large-keypad"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          flexShrink: 0
        }}
      >
        {/* ── Item name input ─────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          height: '36px', padding: '0 0.65rem', flexShrink: 0,
          background: 'var(--bg-main)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <Calculator size={15} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
          <input
            type="text"
            className="keypad-label-input"
            placeholder={t('keypad.item_placeholder') || 'Název položky (volitelné)...'}
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomItem();
              }
            }}
            style={{
              fontSize: '0.85rem', border: 'none', outline: 'none',
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
            border: isReturn
              ? '2px solid var(--accent-rose)'
              : (itemMultiplier > 1 ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)'),
            background: isReturn
              ? 'rgba(239,68,68,0.06)'
              : (itemMultiplier > 1 ? 'rgba(245,158,11,0.04)' : 'var(--bg-input)'),
            boxShadow: isReturn
              ? '0 0 14px rgba(239,68,68,0.2)'
              : (itemMultiplier > 1 ? '0 0 14px rgba(245,158,11,0.2)' : 'none'),
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{
            fontSize: '0.63rem', fontWeight: '800', textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isReturn
              ? 'var(--accent-rose)'
              : (itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--text-muted)')
          }}>
            {isReturn ? `${t('keypad.amount_label')} — ↩️ VRATKA` : t('keypad.amount_label')}
          </span>

          {/* Big price / equation */}
          <div style={{
            fontSize: itemMultiplier !== 1 ? '1.2rem' : '1.4rem',
            fontWeight: '900',
            fontFamily: 'var(--font-mono)',
            color: isReturn ? 'var(--accent-rose)' : (itemMultiplier > 1 ? 'var(--accent-amber)' : (amountStr ? 'var(--text-primary)' : 'var(--text-muted)')),
            wordBreak: 'break-all'
          }}>
            {itemMultiplier !== 1
              ? `${itemMultiplier} × ${amountStr ? `${amountStr} Kč` : (isReturn ? '-___ Kč' : '___ Kč')}`
              : (amountStr ? `${amountStr} Kč` : (isReturn ? '-0 Kč' : '0 Kč'))}
          </div>

          {/* Subtotal line */}
          {itemMultiplier !== 1 && hasValidAmount && (
            <div style={{
              fontSize: '0.82rem', fontWeight: '800', fontFamily: 'var(--font-mono)',
              color: isReturn ? 'var(--accent-rose)' : 'var(--accent-emerald)', textAlign: 'right',
              borderTop: '1px dashed rgba(245,158,11,0.35)',
              paddingTop: '2px', marginTop: '2px'
            }}>
              = Celkem {(Math.abs(itemMultiplier) * Math.abs(parseFloat(amountStr)) * (isReturn ? -1 : 1)).toLocaleString('cs-CZ')} Kč
            </div>
          )}
        </div>

        {/* ── VAT selector (Subcomponent) ── */}
        <KeypadVatSelector
          selectedVat={selectedVat}
          setSelectedVat={setSelectedVat}
          activeKey={activeKey}
        />

        {/* ── Quantity Stepper Bar (New Subcomponent) ── */}
        <KeypadStepperBar
          itemMultiplier={itemMultiplier}
          setItemMultiplier={setItemMultiplier}
          triggerKeyAnimation={triggerKeyAnimation}
          activeKey={activeKey}
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

      {/* ── CARD 2: STANDALONE HOLD / PARK CART STORAGE CARD ─────── */}
      <ParkedCartsDrawer
        hasCartItems={hasCartItems}
        parkedCarts={parkedCarts}
        onParkCart={onParkCart}
        onRestoreParkedCart={onRestoreParkedCart}
        onDeleteParkedCart={onDeleteParkedCart}
      />

      {/* ── CARD 3: SHIFT QUICK STATS MINI-WIDGET (Option D) ─────── */}
      <ShiftStatsWidget
        salesHistory={salesHistory}
        onNavigateToHistory={onNavigateToHistory}
      />
    </div>
  );
}
