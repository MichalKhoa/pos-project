import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

export const LANGUAGES = [
  { code: 'cs', label: 'CZ', flag: '🇨🇿', name: 'Čeština' },
  { code: 'vi', label: 'VI', flag: '🇻🇳', name: 'Tiếng Việt' },
  { code: 'en', label: 'EN', flag: '🇬🇧', name: 'English' }
];

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('himmel_pos_lang') || 'cs';
  });

  const setLanguage = (lang) => {
    if (translations[lang]) {
      setLanguageState(lang);
      localStorage.setItem('himmel_pos_lang', lang);
    }
  };

  /**
   * Translate key path (e.g. 'cart.total') with optional param interpolation.
   * Fallback hierarchy: selected language -> Czech -> key string itself.
   */
  const t = (keyPath, params = {}) => {
    const keys = keyPath.split('.');
    let val = translations[language];

    for (const k of keys) {
      if (val && val[k] !== undefined) {
        val = val[k];
      } else {
        val = null;
        break;
      }
    }

    // Fallback to Czech if key missing in target language
    if (!val && language !== 'cs') {
      let fallbackVal = translations.cs;
      for (const k of keys) {
        if (fallbackVal && fallbackVal[k] !== undefined) {
          fallbackVal = fallbackVal[k];
        } else {
          fallbackVal = null;
          break;
        }
      }
      val = fallbackVal;
    }

    if (!val) return keyPath;

    // Interpolate {param} placeholders
    if (typeof val === 'string' && Object.keys(params).length > 0) {
      let result = val;
      for (const [pKey, pVal] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${pKey}\\}`, 'g'), pVal);
      }
      return result;
    }

    return val;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Fallback stub if context unmounted
    return {
      language: 'cs',
      setLanguage: () => {},
      t: (key) => key,
      languages: LANGUAGES
    };
  }
  return ctx;
}
