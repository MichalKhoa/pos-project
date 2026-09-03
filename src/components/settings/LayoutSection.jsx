import React from 'react';
import { Layout, Tag, ArrowRight, Tv, Sliders } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function LayoutSection({
  config,
  setConfig,
  presets = [],
  onNavigateToPresets,
  onSaveStoreConfig
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Product Grid Layout Settings */}
      <div className="table-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Sliders size={20} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('settings.preset_layout_title') || 'Tlačítka a Dlaždice Sortimentu'}</span>
        </div>

        {/* Preset Columns Setting */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {t('settings.grid_density_label') || 'Počet sloupců'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {config.presetGridColumns === 'auto' || !config.presetGridColumns ? (t('settings.grid_auto') || 'Automaticky') : `${config.presetGridColumns} ${t('settings.grid_density_label')?.toLowerCase() || 'sloupců'}`}
            </div>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', gap: '4px' }}>
            {[
              { id: 'auto', label: t('settings.grid_auto') || 'Auto' },
              { id: '3', label: '3' },
              { id: '4', label: '4' },
              { id: '5', label: '5' },
              { id: '6', label: '6' }
            ].map(col => (
              <button
                key={col.id}
                type="button"
                onClick={() => {
                  const updated = { ...config, presetGridColumns: col.id };
                  setConfig(updated);
                  onSaveStoreConfig(updated);
                }}
                style={{
                  minHeight: '40px',
                  minWidth: col.id === 'auto' ? '70px' : '40px',
                  padding: '0 0.65rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: 'none',
                  background: (config.presetGridColumns || 'auto') === col.id ? 'var(--accent-blue)' : 'transparent',
                  color: (config.presetGridColumns || 'auto') === col.id ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {col.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '1rem 0' }} />

        {/* Preset Button Size Setting */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {t('settings.preset_size_label') || 'Velikost tlačítek'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('settings.preset_size_desc') || 'Výška a velikost písma dlaždic produktů na pokladně.'}
            </div>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', gap: '4px' }}>
            {[
              { id: 'compact', label: t('settings.preset_size_compact') || 'Kompaktní (S)' },
              { id: 'standard', label: t('settings.preset_size_standard') || 'Standardní (M)' },
              { id: 'large', label: t('settings.preset_size_large') || 'Velká (L)' }
            ].map(sz => (
              <button
                key={sz.id}
                type="button"
                onClick={() => {
                  const updated = { ...config, presetDensity: sz.id };
                  setConfig(updated);
                  onSaveStoreConfig(updated);
                  try {
                    localStorage.setItem('voltflow_pos_preset_density', sz.id);
                    localStorage.setItem('himmel_pos_preset_density', sz.id);
                  } catch (e) {
                    console.warn(e);
                  }
                }}
                style={{
                  minHeight: '40px',
                  padding: '0 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: 'none',
                  background: (config.presetDensity || 'standard') === sz.id ? 'var(--accent-blue)' : 'transparent',
                  color: (config.presetDensity || 'standard') === sz.id ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {sz.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '1rem 0' }} />

        {/* Preset Button Style Setting */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {t('settings.preset_style_label') || 'Styl tlačítek'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('settings.preset_style_desc') || 'Vzhled a barevné provedení tlačítek v pokladně.'}
            </div>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', gap: '4px' }}>
            {[
              { id: 'left-stripe', label: `▍ ${t('settings.preset_style_left_stripe') || 'Levý proužek'}` },
              { id: 'color-fill', label: `█ ${t('settings.preset_style_color_fill') || 'Plná barva'}` }
            ].map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  const updated = { ...config, presetButtonStyle: st.id };
                  setConfig(updated);
                  onSaveStoreConfig(updated);
                  try {
                    localStorage.setItem('pos_preset_button_style', st.id);
                  } catch (e) {
                    console.warn(e);
                  }
                }}
                style={{
                  minHeight: '40px',
                  padding: '0 0.95rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: 'none',
                  background: (config.presetButtonStyle || 'left-stripe') === st.id ? 'var(--accent-blue)' : 'transparent',
                  color: (config.presetButtonStyle || 'left-stripe') === st.id ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '1rem 0' }} />

        {/* VAT Rate on Presets */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {t('settings.show_preset_vat_label') || 'Sazba DPH na tlačítkách sortimentu'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('settings.show_preset_vat_desc') || 'Zobrazovat procento DPH na dlaždicích produktů. Vypněte pro neplátce DPH.'}
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
            {t('settings.catalog_desc', { count: presets.length }) || `Spravovat a upravovat ${presets.length} tlačítek sortimentu`}
          </div>
        </div>

        <button
          className="pay-btn pay-btn-card"
          style={{ height: '42px', padding: '0 1.25rem', fontSize: '0.85rem' }}
          onClick={onNavigateToPresets}
        >
          <span>{t('settings.open_catalog') || 'Otevřít Katalog'}</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Register Ergonomics & Layout */}
      <div className="table-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Layout size={20} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('settings.register_layout_title') || 'Ergonomie a Rozvržení Pokladny'}</span>
        </div>

        {/* Cart Position (Left vs Right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {t('settings.cart_position_label') || 'Pozice košíku'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('settings.cart_position_desc') || 'Umístění účtenkového košíku v rozvržení pokladny.'}
            </div>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', gap: '4px' }}>
            {[
              { id: 'left', label: t('settings.cart_left') || 'Vlevo (Standard)' },
              { id: 'right', label: t('settings.cart_right') || 'Vpravo' }
            ].map(pos => (
              <button
                key={pos.id}
                type="button"
                onClick={() => {
                  const updated = { ...config, cartPosition: pos.id };
                  setConfig(updated);
                  onSaveStoreConfig(updated);
                }}
                style={{
                  minHeight: '40px',
                  padding: '0 0.95rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: 'none',
                  background: (config.cartPosition || 'left') === pos.id ? 'var(--accent-blue)' : 'transparent',
                  color: (config.cartPosition || 'left') === pos.id ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '1rem 0' }} />

        {/* High-Legibility Mode */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {t('settings.high_legibility_label') || 'Vysoká čitelnost (High-Legibility Mode)'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('settings.high_legibility_desc') || 'Zvětší dlaždice produktů o 25 %, ztuční ceny na 18pt+ pro snadný dotyk na malých displejích.'}
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
      </div>

      {/* Customer LCD Display Settings */}
      <div className="table-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Tv size={20} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('settings.customer_display_title') || 'Zákaznický LCD Displej'}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              {t('settings.customer_display_greeting') || 'Pozdrav / Název na zákaznickém displeji'}
            </label>
            <input
              type="text"
              value={config.customerDisplayTitle || ''}
              onChange={e => setConfig({ ...config, customerDisplayTitle: e.target.value })}
              onBlur={() => onSaveStoreConfig(config)}
              placeholder="např. Vítejte v našem obchodě"
              style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
            />
          </div>

          <div style={{ padding: '0.85rem', background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={config.customerDisplayAutoSleep !== false}
                onChange={e => {
                  const updated = { ...config, customerDisplayAutoSleep: e.target.checked };
                  setConfig(updated);
                  onSaveStoreConfig(updated);
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>{t('settings.customer_display_auto_sleep_label') || 'Zhasínat zákaznický displej při vypnutí pokladny (Auto-Sleep / Standby)'}</span>
            </label>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.8rem' }}>
              {t('settings.customer_display_auto_sleep_desc') || 'Při kliknutí na "Vypnout pokladnu" odešle signál do okna zákaznického LCD displeje, aby se okamžitě přepnul do režimu černého šetřiče s minimálním jasem.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
