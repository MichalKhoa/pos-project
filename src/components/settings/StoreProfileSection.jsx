import React from 'react';
import { Store, MapPin, Receipt, Globe } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import LanguageSelector from '../LanguageSelector.jsx';

function formatIban(val) {
  if (!val) return '';
  const clean = val.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

export default function StoreProfileSection({
  config,
  setConfig,
  saveConfigField
}) {
  const { t, setLanguage } = useTranslation();

  const handleBlurField = (key, val) => {
    if (saveConfigField) {
      saveConfigField(key, val);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 🏢 Card 1: Základní identifikační údaje */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Store size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.store_info') || 'Identifikační údaje prodejny'}</span>
            </h3>
            <p className="settings-section-desc">
              Údaje tištěné v záhlaví účtenky pro zákazníky a finanční kontrolu.
            </p>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">
            {t('settings.store_name') || 'Název firmy / provozovny'}
          </label>
          <input
            type="text"
            className="settings-input"
            value={config.storeName || ''}
            placeholder="např. Potraviny U Nádraží s.r.o."
            onChange={e => setConfig({ ...config, storeName: e.target.value })}
            onBlur={e => handleBlurField('storeName', e.target.value)}
          />
        </div>

        <div className="settings-form-grid">
          <div className="settings-field">
            <label className="settings-label">
              {t('settings.ico') || 'IČO'}
            </label>
            <input
              type="text"
              className="settings-input"
              value={config.ico || ''}
              placeholder="12345678"
              onChange={e => setConfig({ ...config, ico: e.target.value })}
              onBlur={e => handleBlurField('ico', e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">
              {t('settings.dic') || 'DIČ (volitelné)'}
            </label>
            <input
              type="text"
              className="settings-input"
              value={config.dic || ''}
              placeholder="CZ12345678"
              onChange={e => setConfig({ ...config, dic: e.target.value })}
              onBlur={e => handleBlurField('dic', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 📍 Card 2: Adresa provozovny */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <MapPin size={19} style={{ color: 'var(--accent-emerald)' }} />
              <span>Adresa provozovny</span>
            </h3>
            <p className="settings-section-desc">
              Fyzická adresa obchodu uváděná na daňových dokladech.
            </p>
          </div>
        </div>

        <div className="settings-form-grid">
          <div className="settings-field">
            <label className="settings-label">
              {t('settings.street') || 'Ulice a číslo'}
            </label>
            <input
              type="text"
              className="settings-input"
              value={config.street || ''}
              placeholder="např. Nádražní 124"
              onChange={e => setConfig({ ...config, street: e.target.value })}
              onBlur={e => handleBlurField('street', e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">
              {t('settings.city') || 'Město a PSČ'}
            </label>
            <input
              type="text"
              className="settings-input"
              value={config.city || ''}
              placeholder="např. 110 00 Praha 1"
              onChange={e => setConfig({ ...config, city: e.target.value })}
              onBlur={e => handleBlurField('city', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 💰 Card 3: Finance a Daně */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Receipt size={19} style={{ color: 'var(--accent-amber)' }} />
              <span>Finance & Výchozí DPH</span>
            </h3>
            <p className="settings-section-desc">
              Nastavení základní sazby DPH pro nové položky a bankovní účet pro QR platby.
            </p>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">
            {t('settings.default_vat') || 'Výchozí sazba DPH pro prodej'}
          </label>
          <div className="settings-segmented-group" style={{ width: '100%' }}>
            {[
              { val: 21, label: '21 % (Základní)' },
              { val: 12, label: '12 % (Snížená potraviny)' },
              { val: 0, label: '0 % (Neplátce / Osvobozeno)' }
            ].map(vat => (
              <button
                key={vat.val}
                type="button"
                className={`settings-segmented-btn ${(config.defaultVat ?? 21) === vat.val ? 'active' : ''}`}
                onClick={() => {
                  if (saveConfigField) {
                    saveConfigField('defaultVat', vat.val);
                  } else {
                    setConfig({ ...config, defaultVat: vat.val });
                  }
                }}
              >
                {vat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">
            {t('settings.bank_account_iban') || 'Bankovní účet (IBAN pro okamžité QR platby)'}
          </label>
          <input
            type="text"
            className="settings-input"
            value={config.bankAccountIban || ''}
            placeholder="CZ65 0800 0000 0012 3456 7890"
            onChange={e => setConfig({ ...config, bankAccountIban: formatIban(e.target.value) })}
            onBlur={e => handleBlurField('bankAccountIban', formatIban(e.target.value))}
            style={{ fontFamily: 'var(--font-mono)' }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Z tohoto účtu se automaticky generují QR kódy na zákaznickém displeji pro okamžitou platbu mobilem.
          </span>
        </div>
      </div>

      {/* 🌐 Card 4: Jazyk rozhraní */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Globe size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.default_language') || 'Jazyk pokladny'}</span>
            </h3>
            <p className="settings-section-desc">
              Přepíná jazyk pro celou pokladnu, účtenky i zákaznický displej.
            </p>
          </div>
        </div>

        <LanguageSelector
          variant="bar"
          value={config.defaultLanguage || 'cs'}
          onChange={(lang) => {
            if (saveConfigField) {
              saveConfigField('defaultLanguage', lang);
            } else {
              setConfig({ ...config, defaultLanguage: lang });
              setLanguage(lang);
            }
          }}
        />
      </div>
    </div>
  );
}
