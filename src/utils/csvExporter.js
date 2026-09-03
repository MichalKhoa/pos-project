/**
 * Utility to export sales transactions to CSV format with UTF-8 BOM encoding for Microsoft Excel & Czech accents.
 */
export function exportSalesToCSV(salesHistory, periodLabel = 'vsechna_data') {
  if (!Array.isArray(salesHistory) || salesHistory.length === 0) {
    alert('Žádné prodeje k exportu.');
    return;
  }

  // Define CSV headers
  const headers = [
    'Číslo účtenky',
    'Datum a čas',
    'Typ dokladu',
    'Způsob platby',
    'Celková částka (Kč)',
    'Základ 21% (Kč)',
    'DPH 21% (Kč)',
    'Základ 12% (Kč)',
    'DPH 12% (Kč)',
    'Základ 0% (Kč)',
    'EET Stav',
    'FIK Kód',
    'BKP Kód',
    'Původní účtenka (Storno)',
    'Důvod storna'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = salesHistory.map(sale => {
    const isRefund = sale.isRefund || sale.is_refund;
    const docType = isRefund ? 'Storno' : 'Prodej';
    const dateStr = sale.timestamp ? new Date(sale.timestamp).toLocaleString('cs-CZ') : 'N/A';
    
    // Payment method mapping
    let pMethod = sale.paymentMethod || sale.payment_method || 'cash';
    if (pMethod === 'cash') pMethod = 'Hotovost';
    else if (pMethod === 'card') pMethod = 'Karta';
    else if (pMethod === 'qr') pMethod = 'QR Platba';
    else if (pMethod === 'split') pMethod = 'Kombinovaná';

    // Tax breakdown calculation
    let net21 = 0, tax21 = 0, net12 = 0, tax12 = 0, net0 = 0;
    if (sale.taxSummary) {
      if (sale.taxSummary[21]) {
        net21 = sale.taxSummary[21].net || 0;
        tax21 = sale.taxSummary[21].tax || 0;
      }
      if (sale.taxSummary[12]) {
        net12 = sale.taxSummary[12].net || 0;
        tax12 = sale.taxSummary[12].tax || 0;
      }
      if (sale.taxSummary[0]) {
        net0 = sale.taxSummary[0].net || 0;
      }
    }

    const receiptNum = sale.receiptNumber || sale.receipt_number || '';
    const total = sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0);
    const eetStatus = sale.eetStatus || sale.eet_status || 'N/A';
    const fik = sale.fikCode || sale.fik_code || sale.fik || '';
    const bkp = sale.bkpCode || sale.bkp_code || sale.bkp || '';
    const origReceipt = sale.originalReceiptNumber || sale.original_receipt_number || '';
    const reason = sale.refundReason || sale.refund_reason || '';

    return [
      escapeCSV(receiptNum),
      escapeCSV(dateStr),
      escapeCSV(docType),
      escapeCSV(pMethod),
      total.toFixed(2),
      net21.toFixed(2),
      tax21.toFixed(2),
      net12.toFixed(2),
      tax12.toFixed(2),
      net0.toFixed(2),
      escapeCSV(eetStatus),
      escapeCSV(fik),
      escapeCSV(bkp),
      escapeCSV(origReceipt),
      escapeCSV(reason)
    ].join(';');
  });

  // UTF-8 BOM prefix (\uFEFF) forces Excel to open file with UTF-8 encoding
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const sanitizedLabel = periodLabel.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const dateToday = new Date().toISOString().slice(0, 10);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `voltflow_pos_sales_${sanitizedLabel}_${dateToday}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
