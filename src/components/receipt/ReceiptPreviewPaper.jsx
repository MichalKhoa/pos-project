import React from 'react';

export default function ReceiptPreviewPaper({
  saleData,
  storeConfig,
  resolvedItems,
  is58mm
}) {
  const isRefund = saleData.isRefund || saleData.is_refund;
  const fik = saleData.fik || saleData.pok || saleData.fik_code;
  const bkp = saleData.bkp || saleData.bkp_code;
  const pkp = saleData.pkp || saleData.pkp_code;

  return (
    <div
      className={`receipt-paper printable-receipt ${is58mm ? 'paper-58mm' : 'paper-80mm'}`}
      style={{
        width: is58mm ? '220px' : '320px',
        padding: is58mm ? '8px 8px 16px 8px' : '10px 14px 18px 14px',
        fontSize: is58mm ? '0.75rem' : '0.95rem',
        lineHeight: is58mm ? '1.25' : '1.35'
      }}
    >
      <div className="receipt-header">
        <div className="receipt-store-name" style={{ fontSize: is58mm ? '1.05rem' : '1.25rem' }}>{storeConfig?.storeName}</div>
        <div style={{ fontSize: is58mm ? '0.72rem' : '0.82rem', color: '#444' }}>{storeConfig?.street}</div>
        <div style={{ fontSize: is58mm ? '0.72rem' : '0.82rem', color: '#444' }}>{storeConfig?.city}</div>
        <div style={{ marginTop: '3px', fontSize: is58mm ? '0.68rem' : '0.78rem', fontWeight: '700' }}>IČO: {storeConfig?.ico} | DIČ: {storeConfig?.dic}</div>

        {/* Receipt Title Divider Banner */}
        <div
          className="receipt-divider-title"
          style={{
            fontSize: is58mm ? '0.75rem' : '0.88rem',
            color: isRefund ? '#dc2626' : '#000000',
            borderColor: isRefund ? '#dc2626' : '#222222'
          }}
        >
          {isRefund ? `↩️ STORNO DOKLAD č. ${saleData.receiptNumber}` : `══ DAŇOVÝ DOKLAD č. ${saleData.receiptNumber} ══`}
        </div>

        {isRefund && (saleData.originalReceiptNumber || saleData.original_receipt_number) && (
          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
            Původní doklad: #{saleData.originalReceiptNumber || saleData.original_receipt_number}
          </div>
        )}
        {isRefund && (saleData.refundReason || saleData.refund_reason) && (
          <div style={{ fontSize: '0.7rem', color: '#444', fontStyle: 'italic', marginTop: '2px' }}>
            Důvod vrácení: <em>{saleData.refundReason || saleData.refund_reason}</em>
          </div>
        )}
        <div style={{ fontSize: is58mm ? '0.68rem' : '0.75rem', marginTop: '3px', color: '#555' }}>
          Datum & čas: <b>{new Date(saleData.timestamp).toLocaleString('cs-CZ')}</b>
        </div>
      </div>

      <table className="receipt-table" style={{ tableLayout: 'fixed', width: '100%' }}>
        <thead>
          <tr style={{ fontSize: is58mm ? '0.68rem' : '0.78rem' }}>
            <th style={{ width: '50%', textAlign: 'left' }}>Položka</th>
            <th style={{ width: '15%', textAlign: 'center' }}>Ks</th>
            <th style={{ width: '35%', textAlign: 'right' }}>Cena</th>
          </tr>
        </thead>
        <tbody>
          {resolvedItems.map((item, idx) => {
            const itemDisc = item.discountPercent || 0;
            const unitPrice = item.price * (1 - itemDisc / 100);
            return (
              <tr key={idx}>
                <td style={{ wordBreak: 'break-word', padding: '0.35rem 0' }}>
                  <div className="receipt-item-title">{item.name} {itemDisc > 0 ? <span style={{ color: '#dc2626', fontStyle: 'italic' }}>(-{itemDisc}%)</span> : ''}</div>
                  <div className="receipt-item-sub">DPH {item.vat}%</div>
                </td>
                <td style={{ textAlign: 'center', fontWeight: '700', padding: '0.35rem 0' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', fontWeight: '900', whiteSpace: 'nowrap', fontFamily: 'monospace', padding: '0.35rem 0' }}>{(unitPrice * item.quantity).toFixed(0)}&nbsp;Kč</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* High-Contrast Thermal Total Banner */}
      <div className="receipt-total-row" style={{ color: isRefund ? '#dc2626' : '#000000' }}>
        <span>CELKEM K {isRefund ? 'VRÁCENÍ' : 'ÚHRADĚ'}</span>
        <span className="receipt-total-amount">{saleData.totalAmount.toFixed(0)} Kč</span>
      </div>

      <div style={{ fontSize: is58mm ? '0.72rem' : '0.8rem', margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Způsob úhrady:</span>
          <span style={{ fontWeight: '900', letterSpacing: '0.5px' }}>
            {saleData.paymentMethod === 'cash' ? 'HOTOVOST' : saleData.paymentMethod === 'card' ? 'KARTA' : saleData.paymentMethod === 'split' ? 'KOMBINOVANÁ' : 'QR PLATBA'}
          </span>
        </div>

        {saleData.paymentMethod === 'split' && saleData.splitDetails && (
          <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', padding: '0.35rem 0.6rem', borderRadius: '4px', marginTop: '0.2rem', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>- U hrazeno Hotově:</span>
              <span style={{ fontWeight: '800', fontFamily: 'monospace' }}>{saleData.splitDetails.cash.toFixed(0)} Kč</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>- U hrazeno Kartou:</span>
              <span style={{ fontWeight: '800', fontFamily: 'monospace' }}>{saleData.splitDetails.card.toFixed(0)} Kč</span>
            </div>
          </div>
        )}

        {saleData.paymentMethod === 'cash' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Přijatá hotovost:</span>
              <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{saleData.tenderedAmount?.toFixed(0)} Kč</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Vrácená hotovost:</span>
              <span style={{ fontWeight: '800', fontFamily: 'monospace', color: '#059669' }}>{saleData.changeDue?.toFixed(0)} Kč</span>
            </div>
          </>
        )}
      </div>

      {/* DPH Tax Matrix */}
      <div style={{ borderTop: '2px dashed #222', paddingTop: '0.45rem', marginTop: '0.5rem', fontSize: is58mm ? '0.68rem' : '0.75rem' }}>
        <div style={{ fontWeight: '900', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.4px' }}>Rekapitulace DPH:</div>
        {saleData.taxSummary && (
          is58mm ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.65rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #666', textAlign: 'left', fontWeight: '800' }}>
                  <th style={{ textAlign: 'left' }}>Sazba</th>
                  <th style={{ textAlign: 'right' }}>Základ</th>
                  <th style={{ textAlign: 'right' }}>Daň</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(saleData.taxSummary).map(t => (
                  <tr key={t.rate}>
                    <td style={{ fontWeight: '700' }}>{t.rate}%</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.net.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.tax.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #666', textAlign: 'left', fontWeight: '800' }}>
                  <th style={{ textAlign: 'left' }}>Sazba</th>
                  <th style={{ textAlign: 'right' }}>Základ (Netto)</th>
                  <th style={{ textAlign: 'right' }}>Daň (DPH)</th>
                  <th style={{ textAlign: 'right' }}>Brutto</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(saleData.taxSummary).map(t => (
                  <tr key={t.rate}>
                    <td style={{ fontWeight: '700' }}>{t.rate}%</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.net.toFixed(2)} Kč</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.tax.toFixed(2)} Kč</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '800' }}>{t.gross.toFixed(2)} Kč</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Fiscal EET Block */}
      <div className="receipt-eet-box" style={{ wordBreak: 'break-all', fontSize: is58mm ? '0.62rem' : '0.68rem', marginTop: '0.6rem' }}>
        {(saleData.eet_status === 'DISABLED' || storeConfig?.eetEnabled === false) ? (
          <div style={{ fontWeight: '800', textTransform: 'uppercase', color: '#555555' }}>
            Režim provozu: Běžný prodej bez EET
          </div>
        ) : (
          <>
            <div style={{ fontWeight: '900', textTransform: 'uppercase', marginBottom: '3px' }}>
              EET 2.0 ({fik ? 'Běžný online režim' : 'Zjednodušený neonline režim'})
            </div>
            {fik && (
              <div><strong>FIK:</strong> {fik}</div>
            )}
            {bkp && (
              <div><strong>BKP:</strong> {bkp}</div>
            )}
            {pkp && !fik && (
              <div style={{ marginTop: '2px' }}><strong>PKP:</strong> {pkp.slice(0, 32)}...</div>
            )}
            {!fik && (pkp || saleData.eet_status === 'OFFLINE_PENDING') && (
              <div style={{ fontWeight: '800', marginTop: '4px', color: '#b45309' }}>
                Vystaveno ve zjednodušeném (neonline) režimu EET
              </div>
            )}
          </>
        )}
      </div>

      {/* Decorative Thermal Footer */}
      <div style={{ textAlign: 'center', marginTop: '0.8rem', borderTop: '1px dashed #666', paddingTop: '0.6rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.2rem' }}>★ ★ ★ ★ ★</div>
        <div style={{ fontSize: is58mm ? '0.72rem' : '0.8rem', fontWeight: '700', fontStyle: 'italic' }}>
          {storeConfig?.receiptFooter || 'Děkujeme za Váš nákup a těšíme se na Vaši příští návštěvu!'}
        </div>
        <div style={{ fontSize: '0.62rem', color: '#777', marginTop: '0.3rem' }}>
          Vystaveno v pokladním systému VoltFlow POS
        </div>
      </div>
    </div>
  );
}
