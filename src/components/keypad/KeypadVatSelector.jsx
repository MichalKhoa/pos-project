import React from 'react';

export default function KeypadVatSelector({
  selectedVat,
  setSelectedVat,
  activeKey
}) {
  return (
    <div className="vat-selector" style={{ flexShrink: 0, display: 'flex', gap: '0.35rem' }}>
      {[21, 12, 0].map(rate => (
        <button
          key={rate}
          type="button"
          className={`vat-btn vat-${rate} ${selectedVat === rate ? 'active' : ''} ${activeKey === `VAT_${rate}` ? 'active-press' : ''}`}
          onClick={() => setSelectedVat(rate)}
          style={{ flex: 1, height: '40px' }}
        >
          DPH {rate}%
        </button>
      ))}
    </div>
  );
}
