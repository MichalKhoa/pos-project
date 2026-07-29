import React, { useState, useEffect } from 'react';
import { Calculator, Delete, PlusCircle, Sparkles } from 'lucide-react';

export default function ManualKeypad({
  onAddToCart,
  amountStr = '',
  setAmountStr,
  defaultVat = 21
}) {
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

    if (amountStr.length >= 8) return;

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
      isCustom: true
    });

    // Reset keypad
    if (setAmountStr) setAmountStr('');
    setLabel('');
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
  }, [amountStr, label, selectedVat]);

  const hasValidAmount = parseFloat(amountStr) > 0;

  return (
    <div className="keypad-section touch-large-keypad">
      <div className="section-header" style={{ marginBottom: '0.2rem' }}>
        <div className="section-title">
          <Calculator size={20} style={{ color: 'var(--accent-emerald)' }} />
          <span style={{ fontSize: '1.05rem', fontWeight: '800' }}>Ruční Zadání Částky</span>
        </div>
      </div>

      {/* Row 1: Item Description Input */}
      <div className="keypad-input-container" style={{ width: '100%' }}>
        <input
          type="text"
          className="keypad-label-input"
          placeholder="Název / popis položky (volitelné)..."
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ fontSize: '1.05rem', padding: '0.4rem 0' }}
        />
      </div>

      {/* Row 2: Amount Display Line */}
      <div
        className={`keypad-amount-display ${hasValidAmount ? 'has-value' : ''}`}
        style={{
          width: '100%',
          minWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '0.65rem 1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Částka k úhradě
          </span>
          {hasValidAmount && (
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Sparkles size={13} /> Připraveno
            </span>
          )}
        </div>
        <div style={{
          fontSize: '2.2rem',
          fontWeight: '800',
          fontFamily: 'var(--font-mono)',
          color: hasValidAmount ? 'var(--accent-emerald)' : 'var(--text-muted)',
          width: '100%',
          textAlign: 'right',
          marginTop: '-2px',
          transition: 'color 0.2s ease, transform 0.15s ease'
        }}>
          {amountStr ? `${amountStr} Kč` : '0 Kč'}
        </div>
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
          title="Smazat znak (Backspace)"
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
          title="Vynulovat (Clear)"
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
          title="Desetinná čárka (,)"
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
          className={`key-btn ${activeKey === '000' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('000')}
        >
          000
        </button>
        <button
          type="button"
          className={`key-btn ${activeKey === '.00' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('.00')}
          title="Přidat .00"
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
          <span>{hasValidAmount ? 'Přidat do Košíku' : 'Zadejte Částku'}</span>
        </button>
      </div>
    </div>
  );
}
