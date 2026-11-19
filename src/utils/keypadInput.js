// Shared amount-entry rules for the on-screen keypad, the custom item modal and the
// physical keyboard. Amounts are strings: optional '-' prefix, digits, one optional '.'.

export const MAX_AMOUNT_CHARS = 8; // digits and the dot, sign not counted
export const MAX_DECIMALS = 2;
export const MAX_MULTIPLIER = 99;

const splitSign = (str) => (str.startsWith('-') ? ['-', str.slice(1)] : ['', str]);

// key: '0'-'9' or '00'. Adds as many characters as the rules allow.
export function appendDigit(str, key) {
  const [sign, body] = splitSign(str || '');
  let next = body;
  for (const ch of key) {
    if (next.length >= MAX_AMOUNT_CHARS) break;
    const dot = next.indexOf('.');
    if (dot !== -1 && next.length - dot - 1 >= MAX_DECIMALS) break;
    if (next === '0' && dot === -1) {
      if (ch === '0') continue;
      next = ch;
      continue;
    }
    next += ch;
  }
  return sign + next;
}

export function appendDecimal(str) {
  const [sign, body] = splitSign(str || '');
  if (body.includes('.')) return str;
  if (body.length >= MAX_AMOUNT_CHARS - 2) return str; // dot plus at least one decimal must fit
  return sign + (body ? body + '.' : '0.');
}

// × key: turn the typed whole number into the quantity multiplier.
// A positive multiplier is toggled off (typed amount kept). Return mode (sign or
// negative multiplier) stays return mode.
// Returns { amountStr, itemMultiplier } or null when the press is rejected.
export function applyMultiply(amountStr, itemMultiplier) {
  if (itemMultiplier > 1) {
    return { amountStr, itemMultiplier: 1 };
  }
  const [sign, body] = splitSign(amountStr || '');
  const qty = /^\d+$/.test(body) ? parseInt(body, 10) : 0;
  if (qty < 1 || qty > MAX_MULTIPLIER) {
    // Nothing usable typed: a negative stepper multiplier is cleared, otherwise reject.
    return itemMultiplier < 0 && !sign ? { amountStr, itemMultiplier: 1 } : null;
  }
  return { amountStr: '', itemMultiplier: sign || itemMultiplier < 0 ? -qty : qty };
}
