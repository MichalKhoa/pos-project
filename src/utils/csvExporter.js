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

/**
 * Export inventory catalog and stock levels to CSV format with UTF-8 BOM encoding for Microsoft Excel & Czech accents.
 */
export function exportInventoryToCSV(presets = [], categories = []) {
  if (!Array.isArray(presets) || presets.length === 0) {
    alert('Žádné skladové položky k exportu.');
    return;
  }

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.name;
    return acc;
  }, {});

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'ID položky',
    'Název',
    'Kategorie ID',
    'Kategorie Název',
    'Prodejní cena (Kč)',
    'Nákupní cena (Kč)',
    'Sazba DPH (%)',
    'Skladová zásoba',
    'Minimální stav',
    'Sledovat sklad (1/0)',
    'Čárový kód (EAN)',
    'Zobrazit na pokladně (1/0)'
  ];

  const rows = presets.map(p => {
    const isPinned = p.showInPresets !== undefined ? !!p.showInPresets : (p.show_in_presets !== undefined ? !!p.show_in_presets : true);
    const cost = p.costPrice !== undefined ? p.costPrice : (p.cost_price !== undefined ? p.cost_price : 0);
    const track = p.trackStock !== undefined ? !!p.trackStock : (p.track_stock !== undefined ? !!p.track_stock : false);
    const stock = p.stockQuantity !== undefined ? p.stockQuantity : (p.stock_quantity || 0);
    const minStock = p.minStockAlert !== undefined ? p.minStockAlert : (p.min_stock_alert || 5);
    const catName = categoryMap[p.category] || p.category || '';

    return [
      escapeCSV(p.id),
      escapeCSV(p.name || ''),
      escapeCSV(p.category || 'general'),
      escapeCSV(catName),
      (p.price || 0).toFixed(2),
      cost.toFixed(2),
      (p.vat !== undefined ? p.vat : 21),
      stock,
      minStock,
      track ? 1 : 0,
      escapeCSV(p.barcode || ''),
      isPinned ? 1 : 0
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateToday = new Date().toISOString().slice(0, 10);

  link.setAttribute('href', url);
  link.setAttribute('download', `voltflow_pos_sklad_${dateToday}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV text into validated inventory preset updates/creates.
 */
export function parseInventoryCSV(csvText, existingPresets = []) {
  if (!csvText || typeof csvText !== 'string') {
    return { toUpdate: [], toCreate: [], errors: ['Prázdný soubor'] };
  }

  // Strip BOM
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  const lines = cleaned.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    return { toUpdate: [], toCreate: [], errors: ['Soubor neobsahuje žádná data'] };
  }

  // Detect delimiter (; or ,)
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';

  // Parse CSV line taking quotes into account
  const parseLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const rawHeaders = parseLine(headerLine).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  // Find column indices
  const findCol = (...keywords) => {
    return rawHeaders.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const idIdx = findCol('id');
  const nameIdx = findCol('nzev', 'nazev', 'name');
  const catIdx = findCol('kategorieid', 'kategorie', 'category');
  const priceIdx = findCol('prodejn', 'cena', 'price');
  const costIdx = findCol('nkupn', 'nakup', 'cost');
  const vatIdx = findCol('dph', 'vat');
  const stockIdx = findCol('skladov', 'sklad', 'stock', 'mnozstvi');
  const minIdx = findCol('min', 'minimum');
  const trackIdx = findCol('sledovat', 'track');
  const barcodeIdx = findCol('rov', 'ean', 'barcode', 'kod');
  const pinIdx = findCol('pokladn', 'dlazdic', 'pinned', 'pin');

  const existingMap = new Map();
  existingPresets.forEach(p => {
    if (p.id) existingMap.set(String(p.id).toLowerCase(), p);
    if (p.barcode) existingMap.set(String(p.barcode).trim(), p);
  });

  const toUpdate = [];
  const toCreate = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : '';
    const rawId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : '';
    const barcode = barcodeIdx !== -1 && cols[barcodeIdx] ? cols[barcodeIdx] : '';

    if (!name && !rawId && !barcode) continue;

    // Check if matching existing preset
    let existing = null;
    if (rawId && existingMap.has(rawId.toLowerCase())) {
      existing = existingMap.get(rawId.toLowerCase());
    } else if (barcode && existingMap.has(barcode.trim())) {
      existing = existingMap.get(barcode.trim());
    }

    const price = priceIdx !== -1 && cols[priceIdx] ? parseFloat(cols[priceIdx].replace(',', '.')) : (existing ? existing.price : 0);
    const cost = costIdx !== -1 && cols[costIdx] ? parseFloat(cols[costIdx].replace(',', '.')) : (existing ? (existing.costPrice || existing.cost_price || 0) : 0);
    const vat = vatIdx !== -1 && cols[vatIdx] ? parseInt(cols[vatIdx], 10) : (existing ? existing.vat : 21);
    const stock = stockIdx !== -1 && cols[stockIdx] ? parseInt(cols[stockIdx], 10) : (existing ? (existing.stockQuantity || 0) : 0);
    const minStock = minIdx !== -1 && cols[minIdx] ? parseInt(cols[minIdx], 10) : (existing ? (existing.minStockAlert || 5) : 5);
    const track = trackIdx !== -1 && cols[trackIdx] !== undefined 
      ? (cols[trackIdx] === '1' || cols[trackIdx].toLowerCase() === 'true' || cols[trackIdx].toLowerCase() === 'ano')
      : (existing ? !!existing.trackStock : true);
    const isPinned = pinIdx !== -1 && cols[pinIdx] !== undefined
      ? (cols[pinIdx] === '1' || cols[pinIdx].toLowerCase() === 'true' || cols[pinIdx].toLowerCase() === 'ano')
      : (existing ? (existing.showInPresets !== undefined ? !!existing.showInPresets : true) : true);
    const category = catIdx !== -1 && cols[catIdx] ? cols[catIdx] : (existing ? existing.category : 'general');

    const itemObj = {
      id: existing ? existing.id : (rawId || `preset-csv-${Date.now()}-${i}`),
      name: name || (existing ? existing.name : 'Položka'),
      price: isNaN(price) ? 0 : price,
      costPrice: isNaN(cost) ? 0 : cost,
      vat: isNaN(vat) ? 21 : vat,
      stockQuantity: isNaN(stock) ? 0 : stock,
      minStockAlert: isNaN(minStock) ? 5 : minStock,
      trackStock: track,
      barcode: barcode || (existing ? existing.barcode || '' : ''),
      showInPresets: isPinned,
      category: category,
      color: existing ? existing.color || 'blue' : 'blue',
      position: existing ? existing.position || 0 : (existingPresets.length + i)
    };

    if (existing) {
      toUpdate.push(itemObj);
    } else {
      toCreate.push(itemObj);
    }
  }

  return { toUpdate, toCreate, errors };
}
