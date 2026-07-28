import React, { useState } from 'react';
import { Store, Tag, Save, Trash2, Download, Shield, ArrowRight } from 'lucide-react';

export default function SettingsView({
  storeConfig,
  onSaveStoreConfig,
  presets,
  onResetData,
  onNavigateToPresets
}) {
  const [config, setConfig] = useState({ ...storeConfig });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveStoreConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ storeConfig: config, presets }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `himmel_pos_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="full-view-container">
      <div className="section-header">
        <div className="section-title" style={{ fontSize: '1.4rem' }}>
          <Store size={24} style={{ color: 'var(--accent-purple)' }} />
          <span>Nastavení Pokladny & Prodejny</span>
        </div>
      </div>

      {/* Preset Catalog Shortcut Banner */}
      <div className="table-card" style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12))', borderColor: 'rgba(59, 130, 246, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <Tag size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>Katalog Rychlých Tlačítek & Ceník</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Spravujte všech {presets.length} položek v novém celoobrazovkovém katalogu (tabulka, vyhledávání, filtrování podle kategorií).
          </div>
        </div>

        <button
          className="pay-btn pay-btn-card"
          style={{ height: '42px', padding: '0 1.25rem', fontSize: '0.85rem' }}
          onClick={onNavigateToPresets}
        >
          <span>Otevřít Katalog Položek</span>
          <ArrowRight size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Store Config Form */}
        <div className="table-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Store size={18} style={{ color: 'var(--accent-blue)' }} />
            <span>Údaje o Prodejně (Účtenka)</span>
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Název firmy / provozovny
              </label>
              <input
                type="text"
                value={config.storeName}
                onChange={e => setConfig({ ...config, storeName: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Ulice a č.p.</label>
                <input
                  type="text"
                  value={config.street}
                  onChange={e => setConfig({ ...config, street: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
                  required
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Město a PSČ</label>
                <input
                  type="text"
                  value={config.city}
                  onChange={e => setConfig({ ...config, city: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>IČO</label>
                <input
                  type="text"
                  value={config.ico}
                  onChange={e => setConfig({ ...config, ico: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
                  required
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>DIČ (VAT ID)</label>
                <input
                  type="text"
                  value={config.dic}
                  onChange={e => setConfig({ ...config, dic: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Výchozí sazba DPH (Ruční klávesnice)
              </label>
              <select
                value={config.defaultVat !== undefined ? config.defaultVat : 21}
                onChange={e => setConfig({ ...config, defaultVat: parseInt(e.target.value, 10) })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700' }}
              >
                <option value={21}>21% (Základní sazba)</option>
                <option value={12}>12% (Snížená sazba)</option>
                <option value={0}>0% (Osvobozeno)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Text v zápatí účtenky
              </label>
              <input
                type="text"
                value={config.receiptFooter}
                onChange={e => setConfig({ ...config, receiptFooter: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
              />
            </div>

            <button type="submit" className="pay-btn pay-btn-card" style={{ height: '46px', marginTop: '0.5rem' }}>
              <Save size={18} />
              <span>{saveSuccess ? 'Uloženo!' : 'Uložit Nastavení'}</span>
            </button>
          </form>
        </div>

        {/* EET Fiscal Module & Data Backup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} style={{ color: 'var(--accent-emerald)' }} />
              <span>Příprava EET 2.0 (Česká republika)</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1rem' }}>
              Aplikace je připravena na napojení Python backendového modulu s podporou certifikátů PKCS12 pro Finanční správu ČR.
            </p>
            <div className="status-badge" style={{ display: 'inline-flex', padding: '0.5rem 1rem' }}>
              <span className="status-dot"></span>
              <span>Režim simulace (Frontend Standalone)</span>
            </div>
          </div>

          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem' }}>Záloha a Správa Dat</h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="nav-tab" style={{ flex: 1, padding: '0.6rem' }} onClick={handleExportJSON}>
                <Download size={16} />
                <span>Stáhnout Zálohu (JSON)</span>
              </button>
              <button className="nav-tab" style={{ padding: '0.6rem', color: 'var(--accent-rose)' }} onClick={onResetData}>
                <Trash2 size={16} />
                <span>Resetovat Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
