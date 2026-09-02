import React from 'react';
import { Store, Save } from 'lucide-react';
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
  onSubmit,
  saveSuccess
}) {
  const { t, setLanguage } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Store Info Form */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Store size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('settings.store_info') || 'Identifikační Údaje Prodejny'}</span>
        </h3>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              {t('settings.store_name')} (Právnická osoba / Účtenka)
            </label>
            <input
              type="text"
              value={config.storeName || ''}
              onChange={e => setConfig({ ...config, storeName: e.target.value })}
              style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                {t('settings.street')}
              </label>
              <input
                type="text"
                value={config.street || ''}
                onChange={e => setConfig({ ...config, street: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                {t('settings.city')}
              </label>
              <input
                type="text"
                value={config.city || ''}
                onChange={e => setConfig({ ...config, city: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                {t('settings.ico')}
              </label>
              <input
                type="text"
                value={config.ico || ''}
                onChange={e => setConfig({ ...config, ico: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                {t('settings.dic')}
              </label>
              <input
                type="text"
                value={config.dic || ''}
                onChange={e => setConfig({ ...config, dic: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                {t('settings.default_vat')}
              </label>
              <select
                value={config.defaultVat || 21}
                onChange={e => setConfig({ ...config, defaultVat: parseInt(e.target.value, 10) })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
              >
                <option value={21}>21% (Základní sazba DPH)</option>
                <option value={12}>12% (Snížená sazba DPH)</option>
                <option value={0}>0% (Osvobozeno od DPH)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              {t('settings.bank_account_iban')}
            </label>
            <input
              type="text"
              value={config.bankAccountIban || ''}
              onChange={e => setConfig({ ...config, bankAccountIban: formatIban(e.target.value) })}
              placeholder="CZ00 0000 0000 0000 0000 0000"
              style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              {t('settings.default_language')}
            </label>
            <LanguageSelector
              currentLang={config.defaultLanguage || 'cs'}
              onSelectLang={(lang) => {
                setConfig({ ...config, defaultLanguage: lang });
                setLanguage(lang);
              }}
            />
          </div>

          <button
            type="submit"
            className="pay-btn pay-btn-cash"
            style={{ marginTop: '0.5rem', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Save size={18} />
            <span>{saveSuccess ? 'Uloženo!' : t('settings.save_store')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
