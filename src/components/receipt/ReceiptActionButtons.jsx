import React from 'react';
import { Printer, RotateCcw } from 'lucide-react';

export default function ReceiptActionButtons({
  isPrinting,
  storeConfig,
  onPrint,
  onNewSale
}) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
      <button
        className="pay-btn pay-btn-card"
        style={{ flex: 1, height: '48px', fontSize: '0.85rem' }}
        onClick={() => onPrint(false)}
        disabled={isPrinting}
      >
        <Printer size={16} />
        <span>{isPrinting ? 'Tisknu...' : (storeConfig?.directHardwarePrint !== false ? '⚡ Přímý Tisk Účtenky' : 'Tisk Účtenky')}</span>
      </button>

      <button
        className="pay-btn pay-btn-cash"
        style={{ flex: 1, height: '48px', fontSize: '0.85rem' }}
        onClick={onNewSale}
      >
        <RotateCcw size={16} />
        <span>Nový Prodej</span>
      </button>

      {/* Debug Preview Window Button */}
      {storeConfig?.directHardwarePrint !== false && (
        <button
          type="button"
          className="key-btn"
          style={{ width: '100%', height: '34px', fontSize: '0.75rem', color: 'var(--text-muted)' }}
          onClick={() => onPrint(true)}
          title="Otevřít systémové náhledové okno pro ladění a vývoj"
        >
          🐞 Náhled pro Vývoj (Debug Window)
        </button>
      )}
    </div>
  );
}
