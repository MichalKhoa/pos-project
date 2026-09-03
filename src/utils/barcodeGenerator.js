/**
 * Zero-dependency SVG Barcode Generator (EAN-13 & Code-128)
 * Generates clean SVG bar data for live preview and browser label printing.
 */

// EAN-13 Tables
const EAN_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const EAN_G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];
const EAN_R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];
const EAN_STRUCTURE = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

export function calculateEAN13Checksum(digits12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

export function encodeEAN13(codeStr) {
  let clean = codeStr.replace(/[^0-9]/g, '');
  if (clean.length === 12) {
    clean += calculateEAN13Checksum(clean);
  }
  if (clean.length !== 13) return null;

  const firstDigit = parseInt(clean[0], 10);
  const pattern = EAN_STRUCTURE[firstDigit];

  let bits = '101'; // Left guard
  // First 6 digits (indexes 1 to 6)
  for (let i = 1; i <= 6; i++) {
    const digit = parseInt(clean[i], 10);
    const useG = pattern[i - 1] === 'G';
    bits += useG ? EAN_G[digit] : EAN_L[digit];
  }

  bits += '01010'; // Center guard

  // Last 6 digits (indexes 7 to 12)
  for (let i = 7; i <= 12; i++) {
    const digit = parseInt(clean[i], 10);
    bits += EAN_R[digit];
  }

  bits += '101'; // Right guard

  return { bits, text: clean };
}

// Code 128 (Subset B) table
const CODE128_PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '11000111010' // 106 = Stop
];

export function encodeCode128B(text) {
  const clean = text.replace(/[\u0080-\uFFFF]/g, '');
  if (!clean) return null;

  // Start B is code index 104
  const startCode = 104;
  const codes = [startCode];
  let checksum = startCode;

  for (let i = 0; i < clean.length; i++) {
    const ascii = clean.charCodeAt(i);
    const code = ascii - 32;
    if (code >= 0 && code <= 95) {
      codes.push(code);
      checksum += code * (i + 1);
    }
  }

  const checkCode = checksum % 103;
  codes.push(checkCode);
  codes.push(106); // Stop code

  let bits = '';
  for (const c of codes) {
    bits += CODE128_PATTERNS[c] || '11011001100';
  }
  bits += '11'; // Stop bar

  return { bits, text: clean };
}

/**
 * Returns SVG path or elements for rendering a barcode in HTML/React.
 */
export function generateBarcodeSVG(codeStr, { height = 60, barWidth = 2, quietZone = 10 } = {}) {
  const str = String(codeStr || '').trim();
  if (!str) return null;

  // Try EAN-13 if numeric 12-13 digits, otherwise Code-128
  let encoded = null;
  const isEan = /^\d{12,13}$/.test(str);
  if (isEan) {
    encoded = encodeEAN13(str);
  }
  if (!encoded) {
    encoded = encodeCode128B(str);
  }
  if (!encoded) return null;

  const { bits, text } = encoded;
  const totalWidth = bits.length * barWidth + quietZone * 2;

  const rects = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      rects.push({
        x: quietZone + i * barWidth,
        width: barWidth,
        height: height
      });
    }
  }

  return {
    svgWidth: totalWidth,
    svgHeight: height + 20,
    rects,
    text,
    type: isEan ? 'EAN-13' : 'CODE-128'
  };
}
