import React, { useState } from 'react';
import { Printer, RefreshCw, Receipt, DollarSign, CheckCircle } from 'lucide-react';
import { openCashDrawerBackend } from '../../api/posApi.js';
import { soundFx } from '../../utils/audio.js';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function PrinterSection({
  config,
  setConfig,
  saveConfigBatch,
  printerDevices = [],
  scanningPrinters = false,
  onScanPrinters
}) {
  const { t } = useTranslation();
  const [drawerTesting, setDrawerTesting] = useState(false);
  const [drawerMessage, setDrawerMessage] = useState(null);

  const handleUpdate = (updates) => {
    if (saveConfigBatch) {
      saveConfigBatch(updates);
    } else {
      const updated = { ...config, ...updates };
      setConfig(updated);
    }
  };

  const handleTestDrawer = async () => {
    setDrawerTesting(true);
    setDrawerMessage(null);
    soundFx.playCashChime();
    try {
      await openCashDrawerBackend();
      setDrawerMessage(t('settings.drawer_success') || 'Signál pro otevření zásuvky byl úspěšně odeslán.');
      setTimeout(() => setDrawerMessage(null), 3500);
    } catch {
      setDrawerMessage(t('settings.drawer_error') || 'Zásuvku se nepodařilo otevřít přes tiskárnu.');
    } finally {
      setDrawerTesting(false);
    }
  };

  const currentDev = printerDevices.find(d => d.address === config.printerAddress || d.id === config.printerAddress);

  return (
    <div className="settings-grid-layout">
      {/* 🖨️ LEFT COLUMN: Printer Device Selection */}
      <div className="settings-grid-col">
        {/* 🖨️ Card 1: Připojené tiskové zařízení */}
        <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Printer size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.printer_title') || 'Pokladní tiskárna účtenek (ESC/POS)'}</span>
            </h3>
            <p className="settings-section-desc">
              {t('settings.printer_desc') || 'Výběr připojené USB nebo síťové termotiskárny pro tisk účtenek a bonů.'}
            </p>
          </div>

          <button
            type="button"
            className="key-btn"
            onClick={onScanPrinters}
            disabled={scanningPrinters}
            style={{ height: '36px', padding: '0 0.85rem', fontSize: '0.82rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={scanningPrinters ? 'spin-icon' : ''} />
            <span>{scanningPrinters ? (t('settings.printer_searching') || 'Hledám...') : (t('settings.printer_search_btn') || 'Vyhledat tiskárny')}</span>
          </button>
        </div>

        <div className="settings-field">
          <label className="settings-label">
            {t('settings.printer_active_device') || 'Aktivní tiskové zařízení'}
          </label>
          <select
            className="settings-input"
            value={config.printerAddress || '/dev/usb/lp0'}
            onChange={e => {
              const selectedAddr = e.target.value;
              const matchedDev = printerDevices.find(d => d.address === selectedAddr || d.id === selectedAddr);
              const interfaceType = matchedDev ? matchedDev.interface : (selectedAddr.includes('192.') ? 'NETWORK' : 'USB');
              handleUpdate({
                printerAddress: selectedAddr,
                printerInterface: interfaceType
              });
            }}
          >
            {printerDevices.map(dev => (
              <option key={dev.id} value={dev.address}>
                {dev.status === 'CONNECTED' ? '🟢 ' : dev.status === 'VIRTUAL' ? '🌐 ' : '⚙️ '}
                {dev.name} ({dev.interface})
              </option>
            ))}
          </select>
          {currentDev && (
            <span style={{ fontSize: '0.78rem', color: currentDev.status === 'CONNECTED' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
              {currentDev.status === 'CONNECTED' ? (t('settings.printer_status_connected') || 'Připojeno a připraveno k tisku') : (t('settings.printer_status_virtual') || 'Virtuální / offline náhled')}
            </span>
          )}
        </div>
      </div>
      </div>

      {/* 📄 RIGHT COLUMN: Receipt Parameters & Drawer Test */}
      <div className="settings-grid-col">
        {/* 📄 Card 2: Formátování a parametry tisku */}
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Receipt size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.tab_receipt') || 'Kotouček & Vzhled Účtenky'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.tab_receipt_sub') || 'Základní formát papíru a odkaz do vizuálního editoru účtenky.'}
              </p>
            </div>
          </div>

          {/* Paper Width */}
          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.9rem' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">
                {t('settings.printer_paper_width_label') || 'Šířka papírové role tiskárny'}
              </span>
              <span className="settings-toggle-subtitle">
                {t('settings.printer_paper_width_desc') || 'Standardní pokladní kotouček má šířku 80 mm (48 znaků na řádek).'}
              </span>
            </div>

            <div className="settings-segmented-group">
              {[
                { val: '80', label: t('settings.printer_width_80_std') || '80 mm (Standard)' },
                { val: '58', label: t('settings.printer_width_58_narrow') || '58 mm (Úzká)' }
              ].map(w => (
                <button
                  key={w.val}
                  type="button"
                  className={`settings-segmented-btn ${(config.printerPaperWidth || '80') === w.val ? 'active' : ''}`}
                  onClick={() => handleUpdate({ printerPaperWidth: w.val })}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '0.85rem 1rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.2)', marginTop: '0.85rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-blue)', marginBottom: '0.2rem' }}>
              {t('settings.printer_customization_notice_title') || 'Kompletní přizpůsobení účtenky'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {t('settings.printer_customization_notice_desc') || 'Pro nastavení oddělovačů, loga, písma, kontaktů a živého náhledu přepněte v levém menu do záložky Účtenka & Vzhled.'}
            </div>
          </div>
        </div>

      {/* 💵 Card 3: Pokladní zásuvka (Cash Drawer) */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <DollarSign size={19} style={{ color: 'var(--accent-emerald)' }} />
              <span>{t('settings.drawer_title') || 'Pokladní zásuvka na peníze'}</span>
            </h3>
            <p className="settings-section-desc">
              {t('settings.drawer_desc') || 'Zásuvka připojená kabelem RJ11 do tiskárny se automaticky otevírá při platbě hotovostí.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {t('settings.drawer_test_title') || 'Test elektrického impulsu zásuvky'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {t('settings.drawer_test_desc') || 'Ověřte, zda tiskárna dokáže elektromagneticky uvolnit západku zásuvky.'}
            </div>
          </div>

          <button
            type="button"
            className="pay-btn"
            style={{
              height: '42px',
              padding: '0 1.25rem',
              fontSize: '0.85rem',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(99, 102, 241, 0.25) 100%)',
              color: 'var(--accent-indigo, #4f46e5)',
              border: '1px solid var(--accent-indigo, #4f46e5)'
            }}
            onClick={handleTestDrawer}
            disabled={drawerTesting}
          >
            <DollarSign size={16} />
            <span>{drawerTesting ? (t('settings.drawer_opening') || 'Otevírám...') : (t('settings.drawer_test_btn') || 'Vyzkoušet otevření zásuvky')}</span>
          </button>
        </div>

        {drawerMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-emerald)', fontSize: '0.82rem', fontWeight: '700' }}>
            <CheckCircle size={16} />
            <span>{drawerMessage}</span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
