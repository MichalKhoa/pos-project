export const PRESET_TILE_STYLES = ['tinted', 'color-fill'];

// Legacy values (left-stripe, modern-card, modern-glass) and unknown input fall back to tinted.
export function normalizePresetStyle(value) {
  return PRESET_TILE_STYLES.includes(value) ? value : 'tinted';
}

// Pick white or near-black text for a hex background (WCAG relative luminance).
export function readableTextOn(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#ffffff';
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#111827' : '#ffffff';
}
