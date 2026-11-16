// The word for a count in the active language: pluralWord(t, 'cs', 'shift_stats.receipts', 2) -> "účtenky".
// Keys are <base>_one, _few, _many and _other; a missing form falls back to _other.
export function pluralWord(t, language, base, count) {
  const category = new Intl.PluralRules(language).select(Math.abs(count));
  const word = t(`${base}_${category}`);
  return word.startsWith(`${base}_`) ? t(`${base}_other`) : word;
}
