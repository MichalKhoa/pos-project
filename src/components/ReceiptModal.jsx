import React, { useState } from 'react';
import { Printer, CheckCircle, RotateCcw, QrCode, Smartphone, Check } from 'lucide-react';

export default function ReceiptModal({ saleData, storeConfig, onClose, onNewSale }) {
  if (!saleData) return null;

  const [showQrModal, setShowQrModal] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  // Generate Digital Receipt URL / QR Payload
  const receiptPayload = JSON.stringify({
    receipt: saleData.receiptNumber,
    date: saleData.timestamp,
    total: saleData.totalAmount,
    store: storeConfig.storeName,
    ico: storeConfig.ico
  });

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(receiptPayload)}`;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <CheckCircle size={20} style={{ color: 'var(--accent-emerald)' }} />
            <span>Prodej Dokončen</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ alignItems: 'center' }}>
          {/* Printable 80mm Receipt Area */}
          <div className="receipt-paper printable-receipt">
            <div className="receipt-header">
              <div className="receipt-store-name">{storeConfig.storeName}</div>
              <div>{storeConfig.street}</div>
              <div>{storeConfig.city}</div>
              <div style={{ marginTop: '4px' }}>IČO: {storeConfig.ico} | DIČ: {storeConfig.dic}</div>
              <div style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: '700' }}>
                ÚČTENKA č. {saleData.receiptNumber}
              </div>
              <div style={{ fontSize: '0.7rem' }}>
                {new Date(saleData.timestamp).toLocaleString('cs-CZ')}
              </div>
            </div>

            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Položka</th>
                  <th style={{ textAlign: 'center' }}>Ks</th>
                  <th>Cena</th>
                </tr>
              </thead>
              <tbody>
                {saleData.items.map((item, idx) => {
                  const itemDisc = item.discountPercent || 0;
                  const unitPrice = item.price * (1 - itemDisc / 100);
                  return (
                    <tr key={idx}>
                      <td>
                        <div>{item.name} {itemDisc > 0 ? `(-${itemDisc}%)` : ''}</div>
                        <div style={{ fontSize: '0.65rem', color: '#666' }}>DPH {item.vat}%</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td>{(unitPrice * item.quantity).toFixed(0)} Kč</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="receipt-total-row">
              <span>CELKEM</span>
              <span>{saleData.totalAmount.toFixed(0)} Kč</span>
            </div>

            <div style={{ fontSize: '0.75rem', margin: '0.4rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Způsob úhrady:</span>
                <span style={{ fontWeight: '700' }}>
                  {saleData.paymentMethod === 'cash' ? 'HOTOVOST' : saleData.paymentMethod === 'card' ? 'KARTA' : saleData.paymentMethod === 'split' ? 'KOMBINOVANÁ' : 'QR PLATBA'}
                </span>
              </div>

              {saleData.paymentMethod === 'split' && saleData.splitDetails && (
                <div style={{ background: '#f5f5f5', padding: '0.3rem 0.5rem', borderRadius: '4px', marginTop: '0.3rem', fontSize: '0.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>- Hotově:</span>
                    <span style={{ fontWeight: '700' }}>{saleData.splitDetails.cash.toFixed(0)} Kč</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>- Kartou:</span>
                    <span style={{ fontWeight: '700' }}>{saleData.splitDetails.card.toFixed(0)} Kč</span>
                  </div>
                </div>
              )}

              {saleData.paymentMethod === 'cash' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Přijato:</span>
                    <span>{saleData.tenderedAmount?.toFixed(0)} Kč</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Vráceno:</span>
                    <span>{saleData.changeDue?.toFixed(0)} Kč</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #444', paddingTop: '0.4rem', marginTop: '0.4rem', fontSize: '0.7rem' }}>
              <div style={{ fontWeight: '700', marginBottom: '2px' }}>Rozpis DPH:</div>
              {saleData.taxSummary && Object.values(saleData.taxSummary).map(t => (
                <div key={t.rate} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sazba {t.rate}%:</span>
                  <span>Základ: {t.net.toFixed(2)} Kč | Daň: {t.tax.toFixed(2)} Kč</span>
                </div>
              ))}
            </div>

            {/* Customer Digital QR Code Section on Receipt */}
            <div style={{ textTransform: 'none', textAlign: 'center', margin: '0.75rem 0 0.25rem 0', borderTop: '1px dashed #444', paddingTop: '0.5rem' }}>
              <img
                src={qrImageUrl}
                alt="Digital Receipt QR"
                style={{ width: '100px', height: '100px', margin: '0 auto', display: 'block' }}
              />
              <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>
                📱 Naskenujte pro digitální účtenku
              </div>
            </div>

            {/* Czech EET Fiscal Placeholder Block */}
            <div className="receipt-eet-box">
              <div style={{ fontWeight: '700', textTransform: 'uppercase' }}>EET Evidováno v režimu běžném</div>
              <div>FIK: 4f8d9b2a-1c3e-4567-89ab-0123456789ab-01</div>
              <div>BKP: 12345678-ABCDEF12-34567890-ABCDEF12-34567890</div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.7rem', fontWeight: '600' }}>
              {storeConfig.receiptFooter}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              className="pay-btn pay-btn-card"
              style={{ flex: 1, height: '48px', fontSize: '0.85rem' }}
              onClick={handlePrint}
            >
              <Printer size={16} />
              <span>Tisk Účtenky</span>
            </button>

            <button
              className="pay-btn pay-btn-cash"
              style={{ flex: 1, height: '48px', fontSize: '0.85rem' }}
              onClick={onNewSale}
            >
              <RotateCcw size={16} />
              <span>Nový Prodej</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
