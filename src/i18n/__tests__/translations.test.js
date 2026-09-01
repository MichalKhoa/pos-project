import { describe, it, expect } from 'vitest';
import { translations } from '../translations';

describe('i18n Multi-Language Key Parity (cs, vi, en)', () => {
  const supportedLanguages = ['cs', 'vi', 'en'];

  it('contains all supported languages in translation dictionary', () => {
    supportedLanguages.forEach((lang) => {
      expect(translations).toHaveProperty(lang);
      expect(typeof translations[lang]).toBe('object');
    });
  });

  it('has identical top-level sections across cs, vi, and en', () => {
    const csSections = Object.keys(translations.cs).sort();
    const viSections = Object.keys(translations.vi).sort();
    const enSections = Object.keys(translations.en).sort();

    expect(viSections).toEqual(csSections);
    expect(enSections).toEqual(csSections);
  });

  it('has 100% translation key parity across all subsections', () => {
    const csSections = Object.keys(translations.cs);

    csSections.forEach((section) => {
      const csKeys = Object.keys(translations.cs[section] || {}).sort();
      const missingVi = csKeys.filter((k) => !(k in (translations.vi[section] || {})));
      const missingEn = csKeys.filter((k) => !(k in (translations.en[section] || {})));

      expect(
        missingVi,
        `Missing keys in VI section "${section}": ${missingVi.join(', ')}`
      ).toEqual([]);

      expect(
        missingEn,
        `Missing keys in EN section "${section}": ${missingEn.join(', ')}`
      ).toEqual([]);
    });
  });

  it('guarantees critical register and keypad keys are non-empty strings', () => {
    supportedLanguages.forEach((lang) => {
      const nav = translations[lang].nav;
      const keypad = translations[lang].keypad;
      const cart = translations[lang].cart;

      expect(nav.register).toBeTruthy();
      expect(nav.settings).toBeTruthy();
      expect(keypad.add_to_cart).toBeTruthy();
      expect(cart.total).toBeTruthy();
      expect(cart.pay).toBeTruthy();
    });
  });
});
