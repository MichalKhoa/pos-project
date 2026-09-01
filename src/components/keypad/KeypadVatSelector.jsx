import React from 'react';

export default function KeypadVatSelector({
  selectedVat,
  setSelectedVat,
  amountStr,
  onKeyPress
}) {
  return (
    <div className="vat-selector" style={{ flexShrink: 0, display: 'flex', gap: '0.35rem' }}>
      {[21, 12, 0].map(rate => (
        <button
          key={rate}
          type="button"
          className={`vat-btn vat-${rate} ${selectedVat === rate ? 'active' : ''}`}
          onClick={() => setSelectedVat(rate)}
          style={{ flex: 1, padding: '0.25rem 0', fontSize: '0.8rem' }}
        >
          DPH {rate}%
        </button>
      ))}
      <button
        type="button"
        className={`vat-btn ${amountStr.startsWith('-') ? 'active' : ''}`}
        onClick={() => onKeyPress('±')}
        style={{
          flex: 1.1,
          padding: '0.25rem 0',
          fontSize: '0.8rem',
          fontWeight: '900',
          background: amountStr.startsWith('-') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'rgba(239, 68, 68, 0.12)',
          color: amountStr.startsWith('-') ? '#ffffff' : 'var(--accent-rose)',
          border: '1px solid rgba(239, 68, 68, 0.4)'
        }}
        title="Změnit znaménko / Označit jako vratku zboží"
      >
        ± Vratka
      </button>
    </div>
  );
}
