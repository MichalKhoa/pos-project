export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateReceiptHtml({ saleData, items, storeConfig, paperWidth }) {
  const isA4 = paperWidth === 'A4';
  const is58mm = !isA4 && (paperWidth === '58' || paperWidth === '48');
  const printWidth = isA4 ? '210mm' : (is58mm ? '48mm' : '72mm');
  const fontSize = isA4 ? '11px' : (is58mm ? '9px' : '11px');

  const isRefund = saleData.isRefund || saleData.is_refund || (saleData.totalAmount !== undefined && saleData.totalAmount < 0) || (saleData.grandTotal !== undefined && saleData.grandTotal < 0);
  const origNumber = escapeHtml(saleData.originalReceiptNumber || saleData.original_receipt_number);
  const reasonText = escapeHtml(saleData.refundReason || saleData.refund_reason);
  const receiptNum = escapeHtml(saleData.receiptNumber);

  const storeName = escapeHtml(storeConfig?.storeName || '');
  const street = escapeHtml(storeConfig?.street || '');
  const city = escapeHtml(storeConfig?.city || '');
  const ico = escapeHtml(storeConfig?.ico || '');
  const dic = escapeHtml(storeConfig?.dic || '');
  const registerNo = escapeHtml(storeConfig?.registerNo || 'Pokladna #01');
  const idProvozovny = escapeHtml(storeConfig?.idProvozovny || '11');
  const receiptFooter = escapeHtml(storeConfig?.receiptFooter || 'Děkujeme za váš nákup!');

  const itemsHtml = items.map((item, idx) => {
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
        <td style="text-align:left; width:50%; padding: 4px 0; word-break: break-word;">
          <div style="font-weight: 800; font-size: ${is58mm ? '9.5px' : '12px'}; color: #000;">${itemName} ${disc > 0 ? `<span style="font-style: italic; color: #dc2626;">(-${disc}%)</span>` : ''}</div>
          <div style="font-size: ${is58mm ? '7.5px' : '8.5px'}; color: #555;">DPH ${item.vat}%</div>
        </td>
        <td style="text-align: center; width: 15%; padding: 4px 0; font-weight: 800; font-size: ${is58mm ? '9.5px' : '12px'};">${item.quantity}</td>
        <td style="text-align: right; width: 35%; padding: 4px 0; font-weight: 900; font-family: monospace; font-size: ${is58mm ? '10px' : '13px'}; white-space: nowrap;">${(effPrice * item.quantity).toFixed(0)}&nbsp;Kč</td>
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
      <table style="width:100%; border-collapse:collapse; font-size:8.5px; margin-top:3px;">
        <thead>
          <tr style="border-bottom:1px dashed #000; text-align:left; font-weight:900;">
            <th style="text-align:left; padding: 2px 0;">Sazba</th>
            <th style="text-align:right; padding: 2px 0;">Základ</th>
            <th style="text-align:right; padding: 2px 0;">Daň</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(saleData.taxSummary).map(t => `
            <tr>
              <td style="text-align:left; font-weight:bold; padding: 2px 0;">${t.rate}%</td>
              <td style="text-align:right; font-family:monospace; padding: 2px 0;">${t.net.toFixed(2)}</td>
              <td style="text-align:right; font-family:monospace; padding: 2px 0;">${t.tax.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : `
      <table style="width:100%; border-collapse:collapse; font-size:9.5px; margin-top:3px;">
        <thead>
          <tr style="border-bottom:1px dashed #000; text-align:left; font-weight:900;">
            <th style="text-align:left; padding: 2px 0;">Sazba</th>
            <th style="text-align:right; padding: 2px 0;">Základ (Netto)</th>
            <th style="text-align:right; padding: 2px 0;">Daň (DPH)</th>
            <th style="text-align:right; padding: 2px 0;">Brutto</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(saleData.taxSummary).map(t => `
            <tr>
              <td style="text-align:left; font-weight:bold; padding: 2px 0;">${t.rate}%</td>
              <td style="text-align:right; font-family:monospace; padding: 2px 0;">${t.net.toFixed(2)} Kč</td>
              <td style="text-align:right; font-family:monospace; padding: 2px 0;">${t.tax.toFixed(2)} Kč</td>
              <td style="text-align:right; font-family:monospace; font-weight:bold; padding: 2px 0;">${t.gross.toFixed(2)} Kč</td>
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
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Faktura / Daňový doklad č. ${receiptNum}</title>
          <style>
            @page { margin: 15mm; size: A4; }
            body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #1f2937; margin: 0; padding: 0; background: #fff; }
            .invoice-card { max-width: 800px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; }
            .inv-header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
            .inv-title { font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 0; }
            .inv-meta { font-size: 12px; color: #4b5563; text-align: right; }
            .inv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
            .inv-box { background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 6px; padding: 12px 16px; }
            .inv-box-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #f3f4f6; padding: 8px; font-weight: 700; color: #374151; font-size: 11px; }
            .grand-total-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; }
          </style>
        </head>
        <body>
          <div class="invoice-card">
            <div class="inv-header">
              <div>
                <h1 class="inv-title">${isRefund ? 'STORNO DOKLAD / DOBROPIS' : 'FAKTURA - DAŇOVÝ DOKLAD'}</h1>
                <div style="font-size: 14px; font-weight: 700; color: #2563eb; margin-top: 4px;">Číslo dokladu: ${receiptNum}</div>
              </div>
              <div class="inv-meta">
                <div>Datum vystavení: <strong>${new Date(saleData.timestamp).toLocaleString('cs-CZ')}</strong></div>
                <div>Způsob úhrady: <strong>${payLabel}</strong></div>
                ${isRefund && origNumber ? `<div style="color: #dc2626; font-weight: 700; margin-top: 2px;">Původní doklad: #${origNumber}</div>` : ''}
              </div>
            </div>

            <div class="inv-grid">
              <div class="inv-box">
                <div class="inv-box-title">Dodavatel (Prodejce)</div>
                <div style="font-size: 14px; font-weight: 800; color: #111827;">${storeName}</div>
                <div>${street}</div>
                <div>${city}</div>
                <div style="margin-top: 6px; font-weight: 600;">IČO: ${ico} | DIČ: ${dic}</div>
                <div style="font-size: 10px; color: #6b7280;">Provozovna č.: ${idProvozovny} | ${registerNo}</div>
              </div>
              <div class="inv-box">
                <div class="inv-box-title">Odběratel (Zákazník)</div>
                <div style="font-size: 13px; font-weight: 700; color: #374151;">Koncový zákazník</div>
                <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Běžný hotovostní / kartový prodej</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th style="text-align: left;">Položka / Název zboží</th>
                  <th style="width: 70px; text-align: center;">Množství</th>
                  <th style="width: 90px; text-align: right;">Jedn. cena</th>
                  <th style="width: 60px; text-align: center;">DPH %</th>
                  <th style="width: 100px; text-align: right;">Celkem s DPH</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="grand-total-box">
              <div>
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #1e40af;">Celkem k úhradě včetně DPH</div>
                <div style="font-size: 11px; color: #3b82f6;">Způsob úhrady: ${payLabel}</div>
              </div>
              <div style="font-size: 24px; font-weight: 900; color: #1e3a8a;">${saleData.totalAmount.toFixed(2)} Kč</div>
            </div>

            ${taxHtml}

            <div style="margin-top: 24px; border-top: 1px dashed #d1d5db; padding-top: 12px; font-size: 10px; color: #6b7280; display: flex; justify-content: space-between;">
              <div>
                ${(saleData.eet_status === 'DISABLED' || storeConfig?.eetEnabled === false) ? 'Režim provozu: Běžný prodej bez EET' : `EET FIK: ${fik || 'N/A'} | BKP: ${bkp || 'N/A'}`}
              </div>
              <div>${receiptFooter}</div>
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
    `;
  }

  return `
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
          .divider-title { border: 1px dashed #000; padding: 4px 0; margin: 6px 0; font-size: ${is58mm ? '11px' : '13.5px'}; font-weight: 900; letter-spacing: 0.5px; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin: 5px 0; table-layout: fixed; }
          .total-row { display: flex; justify-content: space-between; font-size: ${is58mm ? '13.5px' : '17px'}; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="center bold" style="font-size: ${is58mm ? '14px' : '18px'}; text-transform: uppercase; letter-spacing: 0.5px;">${storeName}</div>
          <div class="center" style="font-size: ${is58mm ? '9.5px' : '12px'}; color: #333;">${street}</div>
          <div class="center" style="font-size: ${is58mm ? '9.5px' : '12px'}; color: #333;">${city}</div>
          <div class="center bold" style="margin-top:2px; font-size: ${is58mm ? '9px' : '11.5px'};">IČO: ${ico} | DIČ: ${dic}</div>
          
          <div class="divider-title">
            ${isRefund ? `↩️ STORNO DOKLAD č. ${receiptNum}` : `══ DAŇOVÝ DOKLAD č. ${receiptNum} ══`}
          </div>
          ${isRefund && origNumber ? `<div class="center bold" style="font-size: ${is58mm ? '9px' : '11px'}; color: #dc2626;">Původní doklad č.: #${origNumber}</div>` : ''}
          ${isRefund && reasonText ? `<div class="center" style="font-size: ${is58mm ? '9px' : '11px'}; font-style: italic;">Důvod: ${reasonText}</div>` : ''}
          <div class="center" style="font-size: ${is58mm ? '9px' : '11px'}; margin-top:2px;">Datum & čas: <b>${new Date(saleData.timestamp).toLocaleString('cs-CZ')}</b></div>
          <div class="dashed"></div>

          <table>
            <thead>
              <tr style="border-bottom: 2px dashed #000; font-size: ${is58mm ? '9.5px' : '12px'}; text-transform: uppercase;">
                <th style="text-align:left; width:50%; padding: 4px 0;">Položka</th>
                <th style="text-align:center; width:15%; padding: 4px 0;">Ks</th>
                <th style="text-align:right; width:35%; padding: 4px 0;">Cena</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="border-top: 2px dashed #000; border-bottom: 3px double #000; padding: 8px 0; margin: 6px 0;">
            <div class="total-row">
              <span>CELKEM K ${isRefund ? 'VRÁCENÍ' : 'ÚHRADĚ'}</span>
              <span>${saleData.totalAmount.toFixed(0)} Kč</span>
            </div>
          </div>

          <div style="font-size: ${is58mm ? '8.5px' : '10px'}; margin: 4px 0;">
            <div style="display:flex; justify-content:space-between;">
              <span>Způsob úhrady:</span>
              <span class="bold" style="letter-spacing: 0.5px;">${payLabel}</span>
            </div>
            ${saleData.paymentMethod === 'split' && saleData.splitDetails ? `
              <div style="font-size: ${is58mm ? '7.5px' : '9px'}; margin-top:2px;">
                <div style="display:flex; justify-content:space-between;"><span>- U hrazeno Hotově:</span><span class="bold">${(saleData.splitDetails.cash || 0).toFixed(0)} Kč</span></div>
                <div style="display:flex; justify-content:space-between;"><span>- U hrazeno Kartou:</span><span class="bold">${(saleData.splitDetails.card || 0).toFixed(0)} Kč</span></div>
              </div>
            ` : ''}
            ${saleData.paymentMethod === 'cash' ? `
              <div style="display:flex; justify-content:space-between;"><span>Přijatá hotovost:</span><span class="bold">${(saleData.tenderedAmount || 0).toFixed(0)} Kč</span></div>
              <div style="display:flex; justify-content:space-between;"><span>Vrácená hotovost:</span><span class="bold" style="color: #059669;">${(saleData.changeDue || 0).toFixed(0)} Kč</span></div>
            ` : ''}
          </div>

          <div class="dashed"></div>
          <div style="font-size: ${is58mm ? '8.5px' : '10px'}; font-weight: 900; margin-bottom: 2px;">REKAPITULACE DPH:</div>
          ${taxHtml}

          <div class="dashed"></div>
          <div class="center" style="font-size: ${is58mm ? '7.5px' : '8.5px'}; word-break: break-all;">
            ${(saleData.eet_status === 'DISABLED' || storeConfig?.eetEnabled === false) ? `
              <div class="bold">REŽIM PROVOZU: BĚŽNÝ PRODEJ BEZ EET</div>
            ` : `
              <div class="bold">EET 2.0 (${fik ? 'Běžný online režim' : 'Zjednodušený neonline režim'})</div>
              ${fik ? `<div>FIK: ${fik}</div>` : ''}
              ${bkp ? `<div>BKP: ${bkp}</div>` : ''}
              ${pkp && !fik ? `<div>PKP: ${pkp.slice(0, 32)}...</div>` : ''}
              ${!fik && (pkp || saleData.eet_status === 'OFFLINE_PENDING') ? `<div class="bold" style="margin-top:2px; color: #b45309;">Vystaveno ve zjednodušeném (neonline) režimu EET</div>` : ''}
            `}
          </div>

          <div class="dashed"></div>
          <div class="center" style="font-size: ${is58mm ? '8px' : '9.5px'}; margin-top: 6px; padding-bottom: 6px;">
            <div style="font-size: 8px; color: #666; margin-bottom: 2px;">★ ★ ★ ★ ★</div>
            <div style="font-weight: bold; font-style: italic;">${receiptFooter}</div>
            <div style="font-size: 7.5px; color: #555; margin-top: 3px;">Vystaveno v pokladním systému VoltFlow POS</div>
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
  `;
}
