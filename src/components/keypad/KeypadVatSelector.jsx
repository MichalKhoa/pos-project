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
          style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.82rem', height: '36px' }}
        >
          DPH {rate}%
        </button>
      ))}
      <button
        type="button"
        className={`vat-btn ${amountStr.startsWith('-') ? 'active' : ''}`}
        onClick={() => onKeyPress('±')}
        style={{
          flex: 0.8,
          height: '36px',
          padding: '0.35rem 0',
          fontSize: '1rem',
          fontWeight: '900',
          background: amountStr.startsWith('-') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'rgba(239, 68, 68, 0.1)',
          color: amountStr.startsWith('-') ? '#ffffff' : 'var(--accent-rose)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)'
        }}
        title="Změnit znaménko (±)"
      >
        ±
      </button>
    </div>
  );
}
