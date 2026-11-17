// Characters per line the receipt printer code accepts, by paper width and font.
// Must match the choices in backend/services/escpos_service.py (_do_print_receipt).
// 80 mm: Font A 48 (576 dots) or 42 (512 dots), Font B 64 or 56. 58 mm: Font A 32/30/28, Font B 42/35.
export function receiptColumnOptions(paperWidth, fontSize) {
  const compact = fontSize === 'compact';
  const paper = String(paperWidth || '80').toUpperCase();
  if (paper === 'A4') return [80];
  if (paper === '58' || paper === '48') return compact ? [42, 35] : [32, 30, 28];
  return compact ? [64, 56] : [48, 42];
}

// The saved choice when the printer code would use it, otherwise the default for this paper and font.
export function effectiveReceiptColumns(paperWidth, fontSize, saved) {
  const options = receiptColumnOptions(paperWidth, fontSize);
  const value = parseInt(saved, 10);
  return options.includes(value) ? value : options[0];
}
