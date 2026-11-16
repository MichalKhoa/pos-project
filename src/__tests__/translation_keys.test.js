import { describe, it, expect } from 'vitest';
import { translations } from '../i18n/translations.js';

// Every t('literal') in the app must exist in Czech (the fallback language), and cs, vi and en
// must hold the same keys. A missing key shows its raw name on screen (audit F-019).
const sources = import.meta.glob(['../**/*.js', '../**/*.jsx', '!../__tests__/**', '!../i18n/translations.js'], {
  query: '?raw',
  import: 'default',
  eager: true
});

const resolve = (root, path) => path.split('.').reduce((node, k) => (node == null ? undefined : node[k]), root);

const leafKeys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? leafKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

describe('translation keys', () => {
  it('every literal t() key used in the app exists in Czech', () => {
    const missing = [];
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/(?<![\w.$])t\(\s*['"]([A-Za-z0-9_.]+)['"]/g)) {
        if (resolve(translations.cs, m[1]) === undefined) missing.push(`${m[1]} (${file.replace('../', '')})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('Czech, Vietnamese and English have the same keys', () => {
    const cs = new Set(leafKeys(translations.cs));
    for (const lang of ['vi', 'en']) {
      const other = new Set(leafKeys(translations[lang]));
      expect({ lang, missing: [...cs].filter((k) => !other.has(k)) }).toEqual({ lang, missing: [] });
      expect({ lang, extra: [...other].filter((k) => !cs.has(k)) }).toEqual({ lang, extra: [] });
    }
  });
});
