import React from 'react';
import { Printer, RotateCcw, FileText } from 'lucide-react';

export default function ReceiptActionButtons({
  isPrinting,
  storeConfig,
  onPrint,
  onNewSale,
  isInvoice,
  onPrintA4Invoice
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

      {/* A4 Printable Invoice Button */}
      {isInvoice && onPrintA4Invoice && (
        <button
          type="button"
          className="pay-btn"
          style={{
            width: '100%',
            height: '46px',
            fontSize: '0.88rem',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid var(--accent-blue)',
            color: 'var(--accent-blue)',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            cursor: 'pointer'
          }}
          onClick={onPrintA4Invoice}
        >
          <FileText size={18} />
          <span>🖨️ Tisknout A4 Fakturu / Daňový doklad</span>
        </button>
      )}

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
