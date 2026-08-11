import React, { useState, useEffect, useRef } from 'react';
import { Printer, CheckCircle, RotateCcw } from 'lucide-react';
import { printReceiptBackend } from '../api/posApi';
import himmelLogo from '../assets/himmel_logo_icon_nobg.png';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseSaleItems(saleData) {
  if (!saleData) return [];
  let raw = saleData.items || saleData.sale_items || saleData.cart_items || [];
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => ({
    id: item.id || item.item_id || `item-${idx}`,
    name: item.name || item.title || item.item_name || 'Položka',
    price: item.price !== undefined ? parseFloat(item.price) : (item.unit_price !== undefined ? parseFloat(item.unit_price) : 0),
    quantity: item.quantity !== undefined ? parseInt(item.quantity, 10) : (item.qty !== undefined ? parseInt(item.qty, 10) : 1),
    vat: item.vat !== undefined ? parseInt(item.vat, 10) : (item.vat_rate !== undefined ? parseInt(item.vat_rate, 10) : 21),
    discountPercent: item.discountPercent !== undefined ? parseFloat(item.discountPercent) : (item.discount_percent !== undefined ? parseFloat(item.discount_percent) : 0)
  }));
}

export default function ReceiptModal({ saleData, storeConfig, onClose, onNewSale, disableAutoPrint = false }) {
  const [isPrinting, setIsPrinting] = useState(false);
  const autoPrintTriggeredRef = useRef(false);

  useEffect(() => {
    if (!disableAutoPrint && storeConfig?.autoPrintReceipt && saleData && !autoPrintTriggeredRef.current) {
      autoPrintTriggeredRef.current = true;
      handlePrint(false);
    }
  }, [storeConfig?.autoPrintReceipt, saleData, disableAutoPrint]);

  if (!saleData) return null;

  const resolvedItems = parseSaleItems(saleData);

  const safeConfig = storeConfig || {};
  const paperWidth = (safeConfig.printerPaperWidth || '80').toString().toUpperCase();
  const isA4 = paperWidth === 'A4';
  const is58mm = !isA4 && (paperWidth === '58' || paperWidth === '48');

  const handlePrint = async (forceDebugWindow = false) => {
    if (isPrinting) return;
    setIsPrinting(true);

    const isDirectPrint = storeConfig?.directHardwarePrint !== false && !forceDebugWindow;

    // 1. Attempt hardware direct print silently if directHardwarePrint is enabled
    if (isDirectPrint) {
      const res = await printReceiptBackend({ ...saleData, items: resolvedItems }, storeConfig);
      // If hardware physical thermal print succeeded, close printing state without popup
      if (res && res.status === 'PRINTED' && res.physical !== false) {
        setTimeout(() => setIsPrinting(false), 600);
        return;
      }
      console.warn('Physical thermal printer hardware not detected or simulated. Falling back to system print window...');
    }

    // 2. Debug / Fallback mode: Open dedicated print preview window
    const printWin = window.open('', '_blank', 'width=450,height=700');
    if (!printWin) {
      window.print();
      setIsPrinting(false);
      return;
    }

    const printWidth = isA4 ? '210mm' : (is58mm ? '48mm' : '72mm');
    const fontSize = isA4 ? '11px' : (is58mm ? '9px' : '11px');
    const logoSize = isA4 ? '48px' : (is58mm ? '28px' : '36px');

    const isRefund = saleData.isRefund || saleData.is_refund || (saleData.totalAmount !== undefined && saleData.totalAmount < 0) || (saleData.grandTotal !== undefined && saleData.grandTotal < 0);
    const origNumber = escapeHtml(saleData.originalReceiptNumber || saleData.original_receipt_number);
    const reasonText = escapeHtml(saleData.refundReason || saleData.refund_reason);
    const receiptNum = escapeHtml(saleData.receiptNumber);

    const storeName = escapeHtml(storeConfig.storeName || '');
    const street = escapeHtml(storeConfig.street || '');
    const city = escapeHtml(storeConfig.city || '');
    const ico = escapeHtml(storeConfig.ico || '');
    const dic = escapeHtml(storeConfig.dic || '');
    const registerNo = escapeHtml(storeConfig.registerNo || 'Pokladna #01');
    const idProvozovny = escapeHtml(storeConfig.idProvozovny || '11');
    const receiptFooter = escapeHtml(storeConfig.receiptFooter || 'Děkujeme za váš nákup!');

    const itemsHtml = resolvedItems.map((item, idx) => {
      const disc = item.discountPercent || 0;
      const effPrice = item.price * (1 - disc / 100);
      const itemName = escapeHtml(item.name);
      if (isA4) {
        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
            <td style="padding: 6px 8px; text-align: left; font-weight: 600;">${itemName}</td>
            <td style="padding: 6px 8px; text-align: center;">${item.quantity} ks</td>
            <td style="padding: 6px 8px; text-align: right;">${item.price.toFixed(2)} Kč</td>
            <td style="padding: 6px 8px; text-align: center;">${item.vat}%</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700;">${(effPrice * item.quantity).toFixed(2)} Kč</td>
          </tr>
        `;
      }
      return `
        <tr>
          <td style="text-align:left; width:50%; padding:2px 0; word-break:break-word;">
            <div>${itemName} ${disc > 0 ? `(-${disc}%)` : ''}</div>
            <div style="font-size:${is58mm ? '7.5px' : '8.5px'}; color:#555;">DPH ${item.vat}%</div>
          </td>
          <td style="text-align:center; width:15%; padding:2px 0;">${item.quantity}</td>
          <td style="text-align:right; width:35%; padding:2px 0; white-space:nowrap;">${(effPrice * item.quantity).toFixed(0)}&nbsp;Kč</td>
        </tr>
      `;
    }).join('');

    const taxHtml = saleData.taxSummary ? (
      isA4 ? `
        <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:8px; border:1px solid #d1d5db;">
          <thead>
            <tr style="background:#f3f4f6; border-bottom:1px solid #d1d5db; text-align:left;">
              <th style="padding:6px; text-align:left;">Sazba DPH</th>
              <th style="padding:6px; text-align:right;">Základ daně (Netto)</th>
              <th style="padding:6px; text-align:right;">Výše DPH</th>
              <th style="padding:6px; text-align:right;">Celkem s DPH (Brutto)</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(saleData.taxSummary).map(t => `
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px; text-align:left; font-weight:600;">${t.rate}%</td>
                <td style="padding:6px; text-align:right;">${t.net.toFixed(2)} Kč</td>
                <td style="padding:6px; text-align:right;">${t.tax.toFixed(2)} Kč</td>
                <td style="padding:6px; text-align:right; font-weight:700;">${t.gross.toFixed(2)} Kč</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : (is58mm ? `
        <table style="width:100%; border-collapse:collapse; font-size:8px; margin-top:2px;">
          <thead>
            <tr style="border-bottom:1px dashed #000; text-align:left;">
              <th style="text-align:left;">Sazba</th>
              <th style="text-align:right;">Základ</th>
              <th style="text-align:right;">Daň</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(saleData.taxSummary).map(t => `
              <tr>
                <td style="text-align:left;">${t.rate}%</td>
                <td style="text-align:right;">${t.net.toFixed(2)}</td>
                <td style="text-align:right;">${t.tax.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <table style="width:100%; border-collapse:collapse; font-size:9px; margin-top:2px;">
          <thead>
            <tr style="border-bottom:1px dashed #000; text-align:left;">
              <th style="text-align:left;">Sazba</th>
              <th style="text-align:right;">Základ (Netto)</th>
              <th style="text-align:right;">Daň (DPH)</th>
              <th style="text-align:right;">Brutto</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(saleData.taxSummary).map(t => `
              <tr>
                <td style="text-align:left;">${t.rate}%</td>
                <td style="text-align:right;">${t.net.toFixed(2)} Kč</td>
                <td style="text-align:right;">${t.tax.toFixed(2)} Kč</td>
                <td style="text-align:right;">${t.gross.toFixed(2)} Kč</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `)
    ) : '';

    const fik = escapeHtml(saleData.fik || saleData.pok || saleData.fik_code);
    const bkp = escapeHtml(saleData.bkp || saleData.bkp_code);
    const pkp = escapeHtml(saleData.pkp);

    const payLabel = saleData.paymentMethod === 'cash' ? 'HOTOVOST' : saleData.paymentMethod === 'card' ? 'KARTA' : saleData.paymentMethod === 'split' ? 'KOMBINOVANÁ' : 'QR PLATBA';

    if (isA4) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Faktura / Daňový Doklad č. ${receiptNum}</title>
            <style>
              @page { size: A4 portrait; margin: 15mm; }
              body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #111827; margin: 0; padding: 0; background: #fff; }
              .a4-container { width: 100%; max-width: 190mm; margin: 0 auto; padding: 15mm 10mm 25mm 10mm; box-sizing: border-box; }
              .flex-between { display: flex; justify-content: space-between; align-items: flex-start; }
              .header-box { border-bottom: 2px solid #111827; padding-bottom: 15px; margin-bottom: 20px; }
              .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
              table.items-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px; }
              table.items-table th { background: #f3f4f6; border-bottom: 2px solid #374151; padding: 8px; font-weight: 700; }
              .total-banner { background: #f8fafc; border: 2px solid #1e293b; padding: 12px 16px; border-radius: 4px; text-align: right; margin-top: 15px; }
              .eet-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 10px; margin-top: 20px; word-break: break-all; }
            </style>
          </head>
          <body>
            <div class="a4-container">
              <div class="flex-between header-box">
                <div style="display:flex; gap:12px; align-items:center;">
                  <img src="${himmelLogo}" style="width: 48px; height: 48px;" />
                  <div>
                    <div style="font-size: 18px; font-weight: 800; color: #111827;">${storeName}</div>
                    <div style="color:#4b5563; font-size:11px;">${street}, ${city}</div>
                    <div style="color:#4b5563; font-size:11px;">IČO: ${ico} | DIČ: ${dic}</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 18px; font-weight: 800; color: ${isRefund ? '#dc2626' : '#1e40af'};">
                    ${isRefund ? 'STORNO DOKLAD / DOBROPIS' : 'DAŇOVÝ DOKLAD - ÚČTENKA'}
                  </div>
                  <div style="font-size: 14px; font-weight: 700; margin-top:2px;">č. ${receiptNum}</div>
                  <div style="color:#6b7280; font-size:10px; margin-top:4px;">Datum vystavení: ${new Date(saleData.timestamp).toLocaleString('cs-CZ')}</div>
                  ${isRefund && origNumber ? `<div style="font-weight:700; color:#dc2626;">Původní doklad: #${origNumber}</div>` : ''}
                </div>
              </div>

              <div class="flex-between" style="margin-bottom: 20px; gap: 20px;">
                <div style="flex:1; background:#f9fafb; padding:12px; border-radius:4px; border:1px solid #e5e7eb;">
                  <div class="section-title">Dodavatel (Prodávající)</div>
                  <div style="font-weight:700; font-size:12px;">${storeName}</div>
                  <div>${street}</div>
                  <div>${city}</div>
                  <div style="margin-top:4px;">IČO: <b>${ico}</b> | DIČ: <b>${dic}</b></div>
                </div>

                <div style="flex:1; background:#f9fafb; padding:12px; border-radius:4px; border:1px solid #e5e7eb;">
                  <div class="section-title">Platební Údaje</div>
                  <div>Způsob úhrady: <b>${payLabel}</b></div>
                  <div>Označení pokladny: <b>${registerNo}</b></div>
                  <div>Provozovna ID: <b>${idProvozovny}</b></div>
                  ${saleData.paymentMethod === 'cash' ? `<div>Přijatá hotovost: ${saleData.tenderedAmount || 0} Kč</div>` : ''}
                </div>
              </div>

              <div class="section-title">Rozpis Položek Nákupu</div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 5%;">#</th>
                    <th style="text-align: left; width: 45%;">Název Položky</th>
                    <th style="width: 12%;">Množství</th>
                    <th style="text-align: right; width: 13%;">Cena / Ks</th>
                    <th style="width: 10%;">DPH</th>
                    <th style="text-align: right; width: 15%;">Celkem s DPH</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div class="total-banner">
                <span style="font-size: 13px; font-weight: 700; color: #4b5563; margin-right: 15px;">CELKEM K ${isRefund ? 'VRÁCENÍ' : 'ÚHRADĚ'}:</span>
                <span style="font-size: 22px; font-weight: 900; color: #111827;">${saleData.totalAmount.toFixed(2)} Kč</span>
              </div>

              <div style="margin-top: 20px;">
                <div class="section-title">Rekapitulace DPH</div>
                ${taxHtml}
              </div>

              <div class="eet-box">
                <div style="font-weight:700; margin-bottom:4px;">ELEKTRONICKÁ EVIDENCE TRŽEB (EET 2.0 - ${fik ? 'Běžný online režim' : 'Zjednodušený neonline režim'})</div>
                ${fik ? `<div>FIK: ${fik}</div>` : ''}
                ${bkp ? `<div>BKP: ${bkp}</div>` : ''}
                ${pkp && !fik ? `<div>PKP: ${pkp}</div>` : ''}
                ${!fik && (pkp || saleData.eet_status === 'OFFLINE_PENDING') ? `<div style="font-weight:700; margin-top:4px; color:#b45309;">Vystaveno ve zjednodušeném (neonline) režimu EET</div>` : ''}
              </div>

              <div style="margin-top: 30px; text-align: center; color: #6b7280; font-size: 10px;">
                <div>${receiptFooter}</div>
                <div style="margin-top: 2px;">Vystaveno v pokladním systému Himmel POS</div>
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
      return;
    }



    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Účtenka č. ${receiptNum}</title>
          <style>
            @page { margin: 0; size: auto; }
            body { font-family: 'Courier New', Courier, monospace; font-size: ${fontSize}; line-height: 1.35; margin: 0; padding: 0; background: #fff; color: #000; font-weight: bold; }
            .receipt-box { width: ${printWidth}; max-width: ${printWidth}; margin: 0 auto; padding: ${is58mm ? '4mm 2mm 12mm 2mm' : '6mm 4mm 16mm 4mm'}; box-sizing: border-box; text-align: left; }
            .center { text-align: center; }
            .bold { font-weight: 900; }
            .dashed { border-top: 1px dashed #000; margin: 6px 0; }
            .double-line { border-top: 2px dashed #000; border-bottom: 3px double #000; padding: 6px 0; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin: 5px 0; table-layout: fixed; }
            .total-row { display: flex; justify-content: space-between; font-size: ${is58mm ? '13px' : '17px'}; font-weight: 900; }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="center bold" style="font-size: ${is58mm ? '14px' : '18px'}; text-transform: uppercase; letter-spacing: 0.5px;">${storeName}</div>
            <div class="center" style="font-size: ${is58mm ? '9.5px' : '12px'}; color: #333;">${street}</div>
            <div class="center" style="font-size: ${is58mm ? '9.5px' : '12px'}; color: #333;">${city}</div>
            <div class="center bold" style="margin-top:2px; font-size: ${is58mm ? '9px' : '11.5px'};">IČO: ${ico} | DIČ: ${dic}</div>
            
            <div class="dashed"></div>
            <div class="center bold" style="font-size: ${is58mm ? '11px' : '14px'}; letter-spacing: 0.8px;">
              ${isRefund ? `↩️ STORNO DOKLAD č. ${receiptNum}` : `══ DAŇOVÝ DOKLAD č. ${receiptNum} ══`}
            </div>
            ${isRefund && origNumber ? `<div class="center bold" style="font-size: ${is58mm ? '9px' : '11px'}; color: #dc2626;">Původní doklad č.: #${origNumber}</div>` : ''}
            ${isRefund && reasonText ? `<div class="center" style="font-size: ${is58mm ? '9px' : '11px'}; font-style: italic;">Důvod: ${reasonText}</div>` : ''}
            <div class="center" style="font-size: ${is58mm ? '9px' : '11px'}; margin-top:2px;">Datum & čas: <b>${new Date(saleData.timestamp).toLocaleString('cs-CZ')}</b></div>
            <div class="dashed"></div>

            <table>
              <thead>
                <tr style="border-bottom: 2px dashed #000; font-size: ${is58mm ? '9.5px' : '12px'}; text-transform: uppercase;">
                  <th style="text-align:left; width:54%;">Položka</th>
                  <th style="text-align:center; width:16%;">Ks</th>
                  <th style="text-align:right; width:30%;">Cena</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="double-line">
              <div class="total-row">
                <span>CELKEM K ${isRefund ? 'VRÁCENÍ' : 'ÚHRADĚ'}</span>
                <span>${saleData.totalAmount.toFixed(0)} Kč</span>
              </div>
            </div>

            <div style="font-size: ${is58mm ? '8.5px' : '10px'}; margin: 4px 0;">
              <div style="display:flex; justify-content:space-between;">
                <span>Způsob úhrady:</span>
                <span class="bold">${payLabel}</span>
              </div>
              ${saleData.paymentMethod === 'split' && saleData.splitDetails ? `
                <div style="font-size: ${is58mm ? '7.5px' : '9px'}; margin-top:2px;">
                  <div style="display:flex; justify-content:space-between;"><span>- U hrazeno Hotově:</span><span class="bold">${(saleData.splitDetails.cash || 0).toFixed(0)} Kč</span></div>
                  <div style="display:flex; justify-content:space-between;"><span>- U hrazeno Kartou:</span><span class="bold">${(saleData.splitDetails.card || 0).toFixed(0)} Kč</span></div>
                </div>
              ` : ''}
              ${saleData.paymentMethod === 'cash' ? `
                <div style="display:flex; justify-content:space-between;"><span>Přijatá hotovost:</span><span class="bold">${(saleData.tenderedAmount || 0).toFixed(0)} Kč</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Vrácená hotovost:</span><span class="bold">${(saleData.changeDue || 0).toFixed(0)} Kč</span></div>
              ` : ''}
            </div>

            <div class="dashed"></div>
            <div style="font-size: ${is58mm ? '8.5px' : '10px'}; font-weight: bold; margin-bottom: 2px;">ROZPIS DPH:</div>
            ${taxHtml}

            <div class="dashed"></div>
            <div class="center" style="font-size: ${is58mm ? '7.5px' : '8.5px'}; word-break: break-all;">
              ${(saleData.eet_status === 'DISABLED' || storeConfig?.eetEnabled === false) ? `
                <div class="bold">Režim provozu: Běžný prodej bez EET</div>
              ` : `
                <div class="bold">EET 2.0 (${fik ? 'Běžný online režim' : 'Zjednodušený neonline režim'})</div>
                ${fik ? `<div>FIK: ${fik}</div>` : ''}
                ${bkp ? `<div>BKP: ${bkp}</div>` : ''}
                ${pkp && !fik ? `<div>PKP: ${pkp.slice(0, 32)}...</div>` : ''}
                ${!fik && (pkp || saleData.eet_status === 'OFFLINE_PENDING') ? `<div class="bold" style="margin-top:2px;">Vystaveno ve zjednodušeném (neonline) režimu EET</div>` : ''}
              `}
            </div>

            <div class="dashed"></div>
            <div class="center" style="font-size: ${is58mm ? '8px' : '9.5px'}; margin-top: 6px; padding-bottom: 6px;">
              <div style="font-size: 8px; color: #666; margin-bottom: 2px;">★ ★ ★ ★ ★</div>
              <div style="font-weight: bold; font-style: italic;">${receiptFooter}</div>
              <div style="font-size: 7.5px; color: #555; margin-top: 3px;">Vystaveno v pokladním systému Himmel POS</div>
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




  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: isA4 ? '680px' : (is58mm ? '360px' : '440px') }}>
        <div className="modal-header" style={{ background: (saleData.isRefund || saleData.is_refund) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'var(--bg-input)' }}>
          <div className="modal-title">
            <CheckCircle size={20} style={{ color: (saleData.isRefund || saleData.is_refund) ? '#fff' : 'var(--accent-emerald)' }} />
            <span>{(saleData.isRefund || saleData.is_refund) ? 'STORNO DOKLAD / DOBROPIS' : 'Prodej Dokončen'}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ alignItems: 'center' }}>
          {/* Top Streamlined Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            <button
              className="pay-btn pay-btn-card"
              style={{ flex: 1, height: '48px', fontSize: '0.85rem' }}
              onClick={() => handlePrint(false)}
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
                onClick={() => handlePrint(true)}
                title="Otevřít systémové náhledové okno pro ladění a vývoj"
              >
                🐞 Náhled pro Vývoj (Debug Window)
              </button>
            )}
          </div>

          {/* Printable Thermal Receipt Area */}
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
              {/* Optional Store Logo Header */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
                <img src={himmelLogo} alt="Himmel Logo" style={{ height: is58mm ? '28px' : '36px', opacity: 0.9 }} />
              </div>
              <div className="receipt-store-name" style={{ fontSize: is58mm ? '1.05rem' : '1.25rem' }}>{storeConfig.storeName}</div>
              <div style={{ fontSize: is58mm ? '0.72rem' : '0.82rem', color: '#444' }}>{storeConfig.street}</div>
              <div style={{ fontSize: is58mm ? '0.72rem' : '0.82rem', color: '#444' }}>{storeConfig.city}</div>
              <div style={{ marginTop: '3px', fontSize: is58mm ? '0.68rem' : '0.78rem', fontWeight: '700' }}>IČO: {storeConfig.ico} | DIČ: {storeConfig.dic}</div>

              {/* Receipt Title Divider Banner */}
              <div
                className="receipt-divider-title"
                style={{
                  fontSize: is58mm ? '0.75rem' : '0.88rem',
                  color: (saleData.isRefund || saleData.is_refund) ? '#dc2626' : '#000000',
                  borderColor: (saleData.isRefund || saleData.is_refund) ? '#dc2626' : '#222222'
                }}
              >
                {(saleData.isRefund || saleData.is_refund) ? `↩️ STORNO DOKLAD č. ${saleData.receiptNumber}` : `══ DAŇOVÝ DOKLAD č. ${saleData.receiptNumber} ══`}
              </div>

              {(saleData.isRefund || saleData.is_refund) && (saleData.originalReceiptNumber || saleData.original_receipt_number) && (
                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
                  Původní doklad: #{saleData.originalReceiptNumber || saleData.original_receipt_number}
                </div>
              )}
              {(saleData.isRefund || saleData.is_refund) && (saleData.refundReason || saleData.refund_reason) && (
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
            <div className="receipt-total-row" style={{ color: (saleData.isRefund || saleData.is_refund) ? '#dc2626' : '#000000' }}>
              <span>CELKEM K {(saleData.isRefund || saleData.is_refund) ? 'VRÁCENÍ' : 'ÚHRADĚ'}</span>
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
                    EET 2.0 ({(saleData.fik || saleData.pok || saleData.fik_code) ? 'Běžný online režim' : 'Zjednodušený neonline režim'})
                  </div>
                  { (saleData.fik || saleData.pok || saleData.fik_code) && (
                    <div><strong>FIK:</strong> {saleData.fik || saleData.pok || saleData.fik_code}</div>
                  )}
                  { (saleData.bkp || saleData.bkp_code) && (
                    <div><strong>BKP:</strong> {saleData.bkp || saleData.bkp_code}</div>
                  )}
                  { (saleData.pkp || saleData.pkp_code) && !(saleData.fik || saleData.pok || saleData.fik_code) && (
                    <div style={{ marginTop: '2px' }}><strong>PKP:</strong> {(saleData.pkp || saleData.pkp_code).slice(0, 32)}...</div>
                  )}
                  { !(saleData.fik || saleData.pok || saleData.fik_code) && ((saleData.pkp || saleData.pkp_code) || saleData.eet_status === 'OFFLINE_PENDING') && (
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
                {storeConfig.receiptFooter || 'Děkujeme za Váš nákup a těšíme se na Vaši příští návštěvu!'}
              </div>
              <div style={{ fontSize: '0.62rem', color: '#777', marginTop: '0.3rem' }}>
                Vystaveno v pokladním systému Himmel POS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
