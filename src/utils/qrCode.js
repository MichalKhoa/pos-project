/**
 * Himmel POS — Pure JavaScript Offline QR Code Generator
 * Generates valid standard QR Codes (SVG / Data URL) directly in the browser.
 * Zero external network or backend dependencies.
 */

// Galois Field 256 math tables for Reed-Solomon error correction
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    LOG_TABLE[val] = i;
    val = (val << 1) ^ (val & 0x80 ? 0x11d : 0);
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function gfMultiply(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = [1];
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] || 0) ^ gfMultiply(poly[j], EXP_TABLE[i]);
    }
    next.push(0);
    for (let j = 0; j < poly.length; j++) {
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCalculateEcc(dataBytes, eccCount) {
  const genPoly = rsGeneratorPoly(eccCount);
  const ecc = new Array(eccCount).fill(0);
  for (let i = 0; i < dataBytes.length; i++) {
    const factor = dataBytes[i] ^ ecc[0];
    ecc.shift();
    ecc.push(0);
    if (factor !== 0) {
      for (let j = 0; j < eccCount; j++) {
        ecc[j] ^= gfMultiply(genPoly[j + 1], factor);
      }
    }
  }
  return ecc;
}

// QR Code Version specifications (Version 1-8, EC level M)
const QR_SPECS = [
  null,
  { version: 1, size: 21, dataCap: 14, totalBytes: 26, ecBytes: 10, align: [] },
  { version: 2, size: 25, dataCap: 26, totalBytes: 44, ecBytes: 16, align: [6, 18] },
  { version: 3, size: 29, dataCap: 42, totalBytes: 70, ecBytes: 26, align: [6, 22] },
  { version: 4, size: 33, dataCap: 62, totalBytes: 100, ecBytes: 36, align: [6, 26] },
  { version: 5, size: 37, dataCap: 84, totalBytes: 134, ecBytes: 48, align: [6, 30] },
  { version: 6, size: 41, dataCap: 106, totalBytes: 172, ecBytes: 64, align: [6, 34] },
  { version: 7, size: 45, dataCap: 122, totalBytes: 196, ecBytes: 72, align: [6, 22, 38] },
  { version: 8, size: 49, dataCap: 152, totalBytes: 242, ecBytes: 88, align: [6, 24, 42] }
];

export function createQrMatrix(text) {
  const utf8Bytes = new TextEncoder().encode(text);
  const textLen = utf8Bytes.length;

  // Select minimum suitable version (EC level M)
  let spec = QR_SPECS.find(s => s && s.dataCap >= textLen + 3);
  if (!spec) spec = QR_SPECS[QR_SPECS.length - 1];

  const size = spec.size;
  const matrix = Array.from({ length: size }, () => Array(size).fill(null));
  const isReserved = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder patterns
  function placeFinder(startX, startY) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBlack = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        matrix[startY + r][startX + c] = isBlack ? 1 : 0;
        isReserved[startY + r][startX + c] = true;
      }
    }
    // Separators
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = startY + r;
        const x = startX + c;
        if (y >= 0 && y < size && x >= 0 && x < size && !isReserved[y][x]) {
          matrix[y][x] = 0;
          isReserved[y][x] = true;
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(size - 7, 0);
  placeFinder(0, size - 7);

  // 2. Alignment patterns
  for (const py of spec.align) {
    for (const px of spec.align) {
      if (isReserved[py][px]) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          matrix[py + r][px + c] = isBlack ? 1 : 0;
          isReserved[py + r][px + c] = true;
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isReserved[6][i]) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0;
      isReserved[6][i] = true;
    }
    if (!isReserved[i][6]) {
      matrix[i][6] = i % 2 === 0 ? 1 : 0;
      isReserved[i][6] = true;
    }
  }

  // 4. Dark module & format info reservations
  matrix[size - 8][8] = 1;
  isReserved[size - 8][8] = true;

  for (let i = 0; i < 9; i++) {
    if (!isReserved[8][i]) isReserved[8][i] = true;
    if (!isReserved[i][8]) isReserved[i][8] = true;
    if (!isReserved[8][size - 1 - i]) isReserved[8][size - 1 - i] = true;
    if (!isReserved[size - 1 - i][8]) isReserved[size - 1 - i][8] = true;
  }

  // 5. Data encoding (Byte mode: 0100)
  const bitBuffer = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bitBuffer.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(textLen, 8); // Character count
  for (let i = 0; i < textLen; i++) {
    pushBits(utf8Bytes[i], 8);
  }

  // Terminator & padding
  const totalDataBits = spec.dataCap * 8;
  const termLen = Math.min(4, totalDataBits - bitBuffer.length);
  pushBits(0, termLen);

  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.push(0);
  }

  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bitBuffer.length < totalDataBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataBytes = [];
  for (let i = 0; i < bitBuffer.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bitBuffer[i + j] || 0);
    dataBytes.push(b);
  }

  const eccBytes = rsCalculateEcc(dataBytes, spec.ecBytes);
  const finalBytes = [...dataBytes, ...eccBytes];

  const finalBits = [];
  for (const byte of finalBytes) {
    for (let i = 7; i >= 0; i--) finalBits.push((byte >> i) & 1);
  }

  // 6. Matrix placement
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const left = right - 1;
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, left]) {
        if (!isReserved[r][c]) {
          const bit = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          // Mask 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = (bit ^ (mask ? 1 : 0)) ? 1 : 0;
        }
      }
    }
    upward = !upward;
  }

  // 7. Format information (EC M, Mask 0 => 101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i];
  matrix[8][7] = formatBits[6];
  matrix[8][8] = formatBits[7];
  matrix[7][8] = formatBits[8];
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i];

  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i];
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i];

  return matrix;
}

/**
 * Generate standard SVG string from QR text
 */
export function generateQrSvg(text, sizePx = 200, margin = 2) {
  try {
    const matrix = createQrMatrix(text);
    const matrixSize = matrix.length;
    const totalUnits = matrixSize + margin * 2;
    const unitPx = sizePx / totalUnits;

    let rects = '';
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix[r][c] === 1) {
          const x = (c + margin) * unitPx;
          const y = (r + margin) * unitPx;
          rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(unitPx + 0.3).toFixed(1)}" height="${(unitPx + 0.3).toFixed(1)}" fill="#000000" />`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">
      <rect width="${sizePx}" height="${sizePx}" fill="#ffffff" rx="8" />
      ${rects}
    </svg>`;
  } catch (err) {
    console.error('Failed to generate offline QR SVG:', err);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}">
      <rect width="${sizePx}" height="${sizePx}" fill="#ffffff" rx="8" />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#ef4444" font-size="12" font-family="sans-serif">QR Error</text>
    </svg>`;
  }
}

/**
 * Generate Data URL string from QR text
 */
export function generateQrDataUrl(text, sizePx = 200) {
  const svg = generateQrSvg(text, sizePx);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
