import React from 'react';

export default function KeypadVatSelector({
  selectedVat,
  setSelectedVat
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
    </div>
  );
}
