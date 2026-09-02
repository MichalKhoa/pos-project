import React from 'react';
import { Store, Tag, Save, Eye, ArrowRight } from 'lucide-react';
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
  presets,
  onNavigateToPresets,
  onSaveStoreConfig,
  onSubmit,
  saveSuccess
}) {
  const { t, setLanguage } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* High-Legibility Mode Section */}
      <div className="table-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
          <Eye size={20} style={{ color: 'var(--accent-blue)' }} />
          <span>Zobrazení a Čitelnost (Display & Legibility)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Vysoká čitelnost a obří tlačítka (High-Legibility Mode)
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Zvětší dlaždice produktů a tlačítka o 25 % (min 80px), ztuční ceny na 18pt+ a upraví košík do přehledného jednorádkového zobrazení pro dotykové obrazovky.
            </div>
          </div>

          <label className="switch-toggle" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '0.65rem' }}>
            <input
              type="checkbox"
              checked={config.highLegibilityMode || false}
              onChange={(e) => {
                const isChecked = e.target.checked;
                const updated = { ...config, highLegibilityMode: isChecked };
                setConfig(updated);
                onSaveStoreConfig(updated);
              }}
              style={{ width: '22px', height: '22px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: '800', fontSize: '0.92rem', color: config.highLegibilityMode ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
              {config.highLegibilityMode ? 'ZAPNUTO' : 'VYPNUTO'}
            </span>
          </label>
        </div>

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '1rem 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {t('settings.show_preset_vat_label')}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('settings.show_preset_vat_desc')}
            </div>
          </div>

          <label className="switch-toggle" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '0.65rem' }}>
            <input
              type="checkbox"
              checked={config.showPresetVat !== false}
              onChange={(e) => {
                const isChecked = e.target.checked;
                const updated = { ...config, showPresetVat: isChecked };
                setConfig(updated);
                onSaveStoreConfig(updated);
              }}
              style={{ width: '22px', height: '22px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: '800', fontSize: '0.92rem', color: config.showPresetVat !== false ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
              {config.showPresetVat !== false ? 'ZAPNUTO' : 'VYPNUTO'}
            </span>
          </label>
        </div>
      </div>

      {/* Preset Catalog Shortcut Banner */}
      <div className="table-card" style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12))', borderColor: 'rgba(59, 130, 246, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <Tag size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>{t('presets.title')}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('settings.catalog_desc', { count: presets.length })}
          </div>
        </div>

        <button
          className="pay-btn pay-btn-card"
          style={{ height: '42px', padding: '0 1.25rem', fontSize: '0.85rem' }}
          onClick={onNavigateToPresets}
        >
          <span>{t('settings.open_catalog')}</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Store Info Form */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Store size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('settings.store_info')}</span>
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

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              Pozdrav / Název na zákaznickém displeji
            </label>
            <input
              type="text"
              value={config.customerDisplayTitle || ''}
              onChange={e => setConfig({ ...config, customerDisplayTitle: e.target.value })}
              placeholder="např. Vítejte v našem obchodě"
              style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
            />
          </div>

          <div style={{ padding: '0.85rem', background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={config.customerDisplayAutoSleep !== false}
                onChange={e => setConfig({ ...config, customerDisplayAutoSleep: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Zhasínat zákaznický displej při vypnutí pokladny (Auto-Sleep / Standby)</span>
            </label>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.8rem' }}>
              Při kliknutí na "Vypnout pokladnu" odešle signál do okna zákaznického LCD displeje, aby se okamžitě přepnul do režimu černého šetřiče s minimálním jasem.
            </p>
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
