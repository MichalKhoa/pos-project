import React from 'react';
import { Layout, Tag, ArrowRight, Tv, Sliders } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function LayoutSection({
  config,
  setConfig,
  saveConfigBatch,
  presets = [],
  onNavigateToPresets,
  onSaveStoreConfig
}) {
  const { t } = useTranslation();

  const handleUpdate = (updates) => {
    if (saveConfigBatch) {
      saveConfigBatch(updates);
    } else {
      const updated = { ...config, ...updates };
      setConfig(updated);
      onSaveStoreConfig(updated);
    }
  };

  return (
    <div className="settings-grid-layout">
      {/* 🎛️ LEFT COLUMN: Preset Buttons & Catalog */}
      <div className="settings-grid-col">
        {/* 🎛️ Card 1: Product Grid Layout Settings */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Sliders size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.preset_layout_title') || 'Tlačítka a Dlaždice Sortimentu'}</span>
            </h3>
            <p className="settings-section-desc">
              Nastavte velikost, počet sloupců a barevný vzhled tlačítek pro rychlý prodej.
            </p>
          </div>
        </div>

        {/* Preset Columns Setting */}
        <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.9rem' }}>
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              {t('settings.grid_density_label') || 'Počet sloupců dlaždic'}
            </span>
            <span className="settings-toggle-subtitle">
              {config.presetGridColumns === 'auto' || !config.presetGridColumns ? 'Automatické přizpůsobení velikosti obrazovky' : `Pevně nastaveno na ${config.presetGridColumns} sloupce`}
            </span>
          </div>

          <div className="settings-segmented-group">
            {[
              { id: 'auto', label: 'Auto' },
              { id: '3', label: '3' },
              { id: '4', label: '4' },
              { id: '5', label: '5' },
              { id: '6', label: '6' }
            ].map(col => (
              <button
                key={col.id}
                type="button"
                className={`settings-segmented-btn ${(config.presetGridColumns || 'auto') === col.id ? 'active' : ''}`}
                onClick={() => handleUpdate({ presetGridColumns: col.id })}
              >
                {col.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preset Button Size Setting */}
        <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.9rem' }}>
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              {t('settings.preset_size_label') || 'Velikost tlačítek'}
            </span>
            <span className="settings-toggle-subtitle">
              {t('settings.preset_size_desc') || 'Výška a velikost písma dlaždic produktů na pokladně.'}
            </span>
          </div>

          <div className="settings-segmented-group">
            {[
              { id: 'compact', label: 'Kompaktní (S)' },
              { id: 'standard', label: 'Standardní (M)' },
              { id: 'large', label: 'Velká (L)' }
            ].map(sz => (
              <button
                key={sz.id}
                type="button"
                className={`settings-segmented-btn ${(config.presetDensity || 'standard') === sz.id ? 'active' : ''}`}
                onClick={() => {
                  handleUpdate({ presetDensity: sz.id });
                  try {
                    localStorage.setItem('voltflow_pos_preset_density', sz.id);
                    localStorage.setItem('himmel_pos_preset_density', sz.id);
                  } catch (e) {
                    console.warn(e);
                  }
                }}
              >
                {sz.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preset Button Style Setting */}
        <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.9rem' }}>
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              {t('settings.preset_style_label') || 'Barevný styl tlačítek'}
            </span>
            <span className="settings-toggle-subtitle">
              {t('settings.preset_style_desc') || 'Vzhled a provedení barevného odlišení kategorií.'}
            </span>
          </div>

          <div className="settings-segmented-group">
            {[
              { id: 'left-stripe', label: '▍ Levý proužek' },
              { id: 'color-fill', label: '█ Plná barva' }
            ].map(st => (
              <button
                key={st.id}
                type="button"
                className={`settings-segmented-btn ${(config.presetButtonStyle || 'left-stripe') === st.id ? 'active' : ''}`}
                onClick={() => {
                  handleUpdate({ presetButtonStyle: st.id });
                  try {
                    localStorage.setItem('pos_preset_button_style', st.id);
                  } catch (e) {
                    console.warn(e);
                  }
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* VAT Rate on Presets */}
        <div className="settings-toggle-row">
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              {t('settings.show_preset_vat_label') || 'Zobrazovat sazbu DPH na tlačítkách'}
            </span>
            <span className="settings-toggle-subtitle">
              Zobrazí malé procento DPH na každé dlaždici. Vypněte pro neplátce DPH.
            </span>
          </div>

          <label className="settings-switch-toggle">
            <input
              type="checkbox"
              checked={config.showPresetVat !== false}
              onChange={e => handleUpdate({ showPresetVat: e.target.checked })}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>
      </div>

      {/* 🏷️ Card 2: Preset Catalog Shortcut Banner */}
      <div className="settings-action-banner" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            <Tag size={19} style={{ color: 'var(--accent-blue)' }} />
            <span>Katalog produktů & Tlačítek sortimentu</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Spravovat, přidávat a upravovat všech {presets.length} rychlých produktů a kategorií.
          </div>
        </div>

        <button
          type="button"
          className="pay-btn pay-btn-card"
          style={{ height: '42px', padding: '0 1.25rem', fontSize: '0.85rem' }}
          onClick={onNavigateToPresets}
        >
          <span>{t('settings.open_catalog') || 'Otevřít Katalog'}</span>
          <ArrowRight size={16} />
        </button>
      </div>
      </div>

      {/* 📐 RIGHT COLUMN: Register Ergonomics & Customer Display */}
      <div className="settings-grid-col">
        {/* 📐 Card 3: Register Ergonomics & Layout */}
        <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Layout size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.register_layout_title') || 'Ergonomie a Rozvržení Pokladny'}</span>
            </h3>
            <p className="settings-section-desc">
              Přizpůsobení obrazovky pro praváky / leváky a starší obsluhu.
            </p>
          </div>
        </div>

        {/* Cart Position (Left vs Right) */}
        <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.9rem' }}>
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              {t('settings.cart_position_label') || 'Pozice košíku s účtenkou'}
            </span>
            <span className="settings-toggle-subtitle">
              {t('settings.cart_position_desc') || 'Umístění účtenkového košíku v rozvržení pokladny.'}
            </span>
          </div>

          <div className="settings-segmented-group">
            {[
              { id: 'left', label: 'Vlevo (Standard)' },
              { id: 'right', label: 'Vpravo' }
            ].map(pos => (
              <button
                key={pos.id}
                type="button"
                className={`settings-segmented-btn ${(config.cartPosition || 'left') === pos.id ? 'active' : ''}`}
                onClick={() => handleUpdate({ cartPosition: pos.id })}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        {/* High-Legibility Mode */}
        <div className="settings-toggle-row">
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              {t('settings.high_legibility_label') || 'Vysoká čitelnost (High-Legibility Mode)'}
            </span>
            <span className="settings-toggle-subtitle">
              Zvětší dlaždice produktů o 25 % a ztuční texty pro snadný dotyk bez brýlí na menších displejích.
            </span>
          </div>

          <label className="settings-switch-toggle">
            <input
              type="checkbox"
              checked={config.highLegibilityMode || false}
              onChange={e => handleUpdate({ highLegibilityMode: e.target.checked })}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>
      </div>

      {/* 📺 Card 4: Customer LCD Display Settings */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Tv size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.customer_display_title') || 'Zákaznický LCD Displej'}</span>
            </h3>
            <p className="settings-section-desc">
              Nastavení druhé obrazovky otočené k zákazníkovi nebo mobilního náhledu.
            </p>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">
            {t('settings.customer_display_greeting') || 'Uvítací text na zákaznickém displeji'}
          </label>
          <input
            type="text"
            className="settings-input"
            value={config.customerDisplayTitle || ''}
            onChange={e => setConfig({ ...config, customerDisplayTitle: e.target.value })}
            onBlur={e => handleUpdate({ customerDisplayTitle: e.target.value })}
            placeholder="např. Vítejte v Potravinách U Nádraží"
          />
        </div>

        <div className="settings-toggle-row">
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              {t('settings.customer_display_auto_sleep_label') || 'Automaticky zhasínat displej při vypnutí pokladny'}
            </span>
            <span className="settings-toggle-subtitle">
              Při kliknutí na "Vypnout pokladnu" přepne zákaznický displej do úsporného černého režimu.
            </span>
          </div>

          <label className="settings-switch-toggle">
            <input
              type="checkbox"
              checked={config.customerDisplayAutoSleep !== false}
              onChange={e => handleUpdate({ customerDisplayAutoSleep: e.target.checked })}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>
      </div>
      </div>
    </div>
  );
}
