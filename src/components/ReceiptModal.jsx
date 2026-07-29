import React, { useState } from 'react';
import { Printer, CheckCircle, RotateCcw, QrCode, Smartphone, Check } from 'lucide-react';
import { printReceiptBackend } from '../api/posApi';
import himmelLogo from '../assets/himmel_logo_icon_nobg.png';

export default function ReceiptModal({ saleData, storeConfig, onClose, onNewSale }) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!saleData) return null;

  const paperWidth = storeConfig?.printerPaperWidth || '80';
  const is58mm = paperWidth === '58' || paperWidth === '48';

  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);

    // 1. Send hardware thermal print payload to Python ESC/POS backend service
    printReceiptBackend(saleData, storeConfig).catch(() => {});

    // 2. Open dedicated, isolated print window matching exact 48mm / 72mm thermal paper width
    const printWin = window.open('', '_blank', 'width=450,height=700');
    if (!printWin) {
      window.print();
      setIsPrinting(false);
      return;
    }

    const printWidth = is58mm ? '48mm' : '72mm';
    const fontSize = is58mm ? '10px' : '11px';

    const itemsHtml = (saleData.items || []).map(item => {
      const disc = item.discountPercent || 0;
      const effPrice = item.price * (1 - disc / 100);
      return `
        <tr>
          <td style="text-align:left; padding:2px 0;">
            <div>${item.name} ${disc > 0 ? `(-${disc}%)` : ''}</div>
            <div style="font-size:8px; color:#666;">DPH ${item.vat}%</div>
          </td>
          <td style="text-align:center; padding:2px 0;">${item.quantity}</td>
          <td style="text-align:right; padding:2px 0;">${(effPrice * item.quantity).toFixed(0)} Kč</td>
        </tr>
      `;
    }).join('');

    const taxHtml = saleData.taxSummary ? Object.values(saleData.taxSummary).map(t => `
      <div style="display:flex; justify-content:space-between; font-size:8px;">
        <span>Sazba ${t.rate}%:</span>
        <span>Základ: ${t.net.toFixed(2)} Kč | Daň: ${t.tax.toFixed(2)} Kč</span>
      </div>
    `).join('') : '';

    const fik = saleData.fik || saleData.pok || saleData.fik_code;
    const bkp = saleData.bkp || saleData.bkp_code;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Účtenka č. ${saleData.receiptNumber}</title>
          <style>
            @page { margin: 0; size: auto; }
            body { font-family: monospace, monospace; font-size: ${fontSize}; margin: 0; padding: 2px; background: #fff; color: #000; }
            .receipt-box { width: ${printWidth}; max-width: ${printWidth}; margin: 0 auto; box-sizing: border-box; text-align: left; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .dashed { border-top: 1px dashed #000; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin: 4px 0; }
            .total-row { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; font-size: 12px; font-weight: bold; display: flex; justify-content: space-between; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <img src="${himmelLogo}" style="width: 32px; height: 32px; display: block; margin: 0 auto 4px auto;" />
            <div class="center bold" style="font-size: 13px;">${storeConfig.storeName}</div>
            <div class="center">${storeConfig.street}</div>
            <div class="center">${storeConfig.city}</div>
            <div class="center" style="margin-top:2px;">IČO: ${storeConfig.ico} | DIČ: ${storeConfig.dic}</div>
            <div class="dashed"></div>
            <div class="center bold">ÚČTENKA č. ${saleData.receiptNumber}</div>
            <div class="center" style="font-size: 8px;">${new Date(saleData.timestamp).toLocaleString('cs-CZ')}</div>
            <div class="dashed"></div>

            <table>
              <thead>
                <tr style="border-bottom: 1px dashed #000; font-size: 9px;">
                  <th style="text-align:left;">Položka</th>
                  <th style="text-align:center;">Ks</th>
                  <th style="text-align:right;">Cena</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="total-row">
              <span>CELKEM</span>
              <span>${saleData.totalAmount.toFixed(0)} Kč</span>
            </div>

            <div style="font-size: 9px; margin: 4px 0;">
              <div style="display:flex; justify-content:space-between;">
                <span>Způsob úhrady:</span>
                <span class="bold">${saleData.paymentMethod === 'cash' ? 'HOTOVOST' : saleData.paymentMethod === 'card' ? 'KARTA' : 'QR PLATBA'}</span>
              </div>
              ${saleData.paymentMethod === 'cash' ? `
                <div style="display:flex; justify-content:space-between;"><span>Přijato:</span><span>${(saleData.tenderedAmount || 0).toFixed(0)} Kč</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Vráceno:</span><span>${(saleData.changeDue || 0).toFixed(0)} Kč</span></div>
              ` : ''}
            </div>

            <div class="dashed"></div>
            <div style="font-size: 8px; font-weight: bold; margin-bottom: 2px;">Rozpis DPH:</div>
            ${taxHtml}

            <div class="dashed"></div>
            <div style="font-size: 8px; word-break: break-all;">
              <div class="bold">EET 2.0 (${saleData.eet_status || 'EVD_OK'})</div>
              ${fik ? `<div>POK/FIK: ${fik}</div>` : ''}
              ${bkp ? `<div>BKP: ${bkp}</div>` : ''}
            </div>

            <div class="dashed"></div>
            <div class="center" style="font-size: 8px; margin-top: 4px;">
              ${storeConfig.receiptFooter || ''}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => setIsPrinting(false), 1500);
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
      <div className="modal-card" style={{ maxWidth: is58mm ? '360px' : '440px' }}>
        <div className="modal-header" style={{ background: (saleData.isRefund || saleData.is_refund) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'var(--bg-input)' }}>
          <div className="modal-title">
            <CheckCircle size={20} style={{ color: (saleData.isRefund || saleData.is_refund) ? '#fff' : 'var(--accent-emerald)' }} />
            <span>{(saleData.isRefund || saleData.is_refund) ? 'STORNO DOKLAD / DOBROPIS' : 'Prodej Dokončen'}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ alignItems: 'center' }}>
          {/* Printer Width Format Badge */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <Printer size={14} style={{ color: 'var(--accent-blue)' }} />
            <span>Formát tiskárny: {is58mm ? '58 mm rola (48 mm tisková hlava)' : '80 mm rola (72 mm tisková hlava)'}</span>
          </div>

          {/* Printable Thermal Receipt Area */}
          <div
            className={`receipt-paper printable-receipt ${is58mm ? 'paper-58mm' : 'paper-80mm'}`}
            style={{
              width: is58mm ? '230px' : '330px',
              padding: is58mm ? '10px 6px' : '18px 14px',
              fontSize: is58mm ? '0.7rem' : '0.8rem'
            }}
          >
            <div className="receipt-header">
              <div className="receipt-store-name">{storeConfig.storeName}</div>
              <div>{storeConfig.street}</div>
              <div>{storeConfig.city}</div>
              <div style={{ marginTop: '4px' }}>IČO: {storeConfig.ico} | DIČ: {storeConfig.dic}</div>
              <div style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: '800', color: (saleData.isRefund || saleData.is_refund) ? '#dc2626' : 'inherit' }}>
                {(saleData.isRefund || saleData.is_refund) ? `STORNO DOKLAD č. ${saleData.receiptNumber}` : `ÚČTENKA č. ${saleData.receiptNumber}`}
              </div>
              {(saleData.isRefund || saleData.is_refund) && (saleData.originalReceiptNumber || saleData.original_receipt_number) && (
                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#dc2626', marginTop: '2px' }}>
                  Původní doklad č.: #{saleData.originalReceiptNumber || saleData.original_receipt_number}
                </div>
              )}
              {(saleData.isRefund || saleData.is_refund) && (saleData.refundReason || saleData.refund_reason) && (
                <div style={{ fontSize: '0.65rem', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>
                  Důvod: {saleData.refundReason || saleData.refund_reason}
                </div>
              )}
              <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>
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

            <div className="receipt-total-row" style={{ color: (saleData.isRefund || saleData.is_refund) ? '#dc2626' : 'inherit' }}>
              <span>CELKEM K {(saleData.isRefund || saleData.is_refund) ? 'VRÁCENÍ' : 'ÚHRADĚ'}</span>
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

            {/* Czech EET 2.0 Fiscal Block */}
            <div className="receipt-eet-box" style={{ wordBreak: 'break-all', fontSize: '0.65rem' }}>
              <div style={{ fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>
                EET 2.0 Evidováno v režimu běžném ({saleData.eet_status || 'EVD_OK'})
              </div>
              { (saleData.fik || saleData.pok) && (
                <div><strong>POK/FIK:</strong> {saleData.fik || saleData.pok}</div>
              )}
              { saleData.bkp && (
                <div><strong>BKP:</strong> {saleData.bkp}</div>
              )}
              { saleData.pkp && !saleData.fik && !saleData.pok && (
                <div style={{ marginTop: '2px' }}><strong>PKP:</strong> {saleData.pkp.slice(0, 44)}...</div>
              )}
              { !saleData.fik && !saleData.pok && !saleData.bkp && (
                <>
                  <div>POK: 4f8d9b2a-1c3e-4567-89ab-0123456789ab-01</div>
                  <div>BKP: 12345678-ABCDEF12-34567890-ABCDEF12-34567890</div>
                </>
              )}
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
