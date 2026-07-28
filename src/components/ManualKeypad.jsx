import React, { useState, useEffect } from 'react';
import { Calculator, Delete, PlusCircle, Tag } from 'lucide-react';

export default function ManualKeypad({
  onAddToCart,
  amountStr = '',
  setAmountStr,
  defaultVat = 21
}) {
  const [label, setLabel] = useState('');
  const [selectedVat, setSelectedVat] = useState(defaultVat);

  useEffect(() => {
    if (defaultVat !== undefined) {
      setSelectedVat(defaultVat);
    }
  }, [defaultVat]);

  const handleKeyPress = (val) => {
    if (!setAmountStr) return;

    if (val === 'CLEAR') {
      setAmountStr('');
      return;
    }
    if (val === 'BACK') {
      setAmountStr(prev => prev.slice(0, -1));
      return;
    }
    if (val === '.' && amountStr.includes('.')) return;

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
  };

  return (
    <div className="keypad-section">
      <div className="section-header" style={{ marginBottom: '0.2rem' }}>
        <div className="section-title">
          <Calculator size={18} style={{ color: 'var(--accent-emerald)' }} />
          <span>Ruční Zadání Částky</span>
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
        />
      </div>

      {/* Row 2: Cost Line directly below */}
      <div
        className="keypad-amount-display"
        style={{
          width: '100%',
          minWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '0.5rem 0.85rem'
        }}
      >
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Částka k úhradě
        </span>
        <div style={{
          fontSize: '1.8rem',
          fontWeight: '800',
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent-emerald)',
          width: '100%',
          textAlign: 'right',
          marginTop: '-2px'
        }}>
          {amountStr ? `${amountStr} Kč` : '0 Kč'}
        </div>
      </div>

      {/* Row 3: Prechosen VAT Selector */}
      <div className="vat-selector">
        {[21, 12, 0].map(rate => (
          <button
            key={rate}
            type="button"
            className={`vat-btn ${selectedVat === rate ? 'active' : ''}`}
            onClick={() => setSelectedVat(rate)}
          >
            DPH {rate}%
          </button>
        ))}
      </div>

      {/* Touch Keypad Grid */}
      <div className="keypad-grid">
        {['7', '8', '9'].map(num => (
          <button key={num} type="button" className="key-btn" onClick={() => handleKeyPress(num)}>{num}</button>
        ))}
        <button type="button" className="key-btn key-action" onClick={() => handleKeyPress('BACK')}>
          <Delete size={20} />
        </button>

        {['4', '5', '6'].map(num => (
          <button key={num} type="button" className="key-btn" onClick={() => handleKeyPress(num)}>{num}</button>
        ))}
        <button type="button" className="key-btn key-action" onClick={() => handleKeyPress('CLEAR')}>C</button>

        {['1', '2', '3'].map(num => (
          <button key={num} type="button" className="key-btn" onClick={() => handleKeyPress(num)}>{num}</button>
        ))}
        <button type="button" className="key-btn" onClick={() => handleKeyPress('.')}>,</button>

        <button type="button" className="key-btn" onClick={() => handleKeyPress('0')}>0</button>
        <button type="button" className="key-btn" onClick={() => handleKeyPress('00')}>00</button>

        <button
          type="button"
          className="key-btn key-enter"
          style={{ gridColumn: 'span 4', height: '54px', marginTop: '0.2rem' }}
          onClick={handleAddCustomItem}
        >
          <PlusCircle size={20} />
          <span>Přidat do Košíku</span>
        </button>
      </div>
    </div>
  );
}
