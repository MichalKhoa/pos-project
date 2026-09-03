import React, { useState } from 'react';
import { Printer, RefreshCw, Receipt, DollarSign, CheckCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { openCashDrawerBackend } from '../../api/posApi.js';
import { soundFx } from '../../utils/audio.js';

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
      setDrawerMessage('Signál pro otevření zásuvky byl úspěšně odeslán.');
      setTimeout(() => setDrawerMessage(null), 3500);
    } catch {
      setDrawerMessage('Zásuvku se nepodařilo otevřít přes tiskárnu.');
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
              <span>Pokladní tiskárna účtenek (ESC/POS)</span>
            </h3>
            <p className="settings-section-desc">
              Výběr připojené USB nebo síťové termotiskárny pro tisk účtenek a bonů.
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
            <span>{scanningPrinters ? 'Hledám...' : 'Vyhledat tiskárny'}</span>
          </button>
        </div>

        <div className="settings-field">
          <label className="settings-label">
            Aktivní tiskové zařízení
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
              Stav tiskárny: {currentDev.status === 'CONNECTED' ? 'Připojeno a připraveno k tisku' : 'Virtuální / offline náhled'}
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
              <span>Parametry účtenky & Tisk</span>
            </h3>
            <p className="settings-section-desc">
              Šířka papírové role a automatický tisk po zaplacení nákupu.
            </p>
          </div>
        </div>

        {/* Paper Width */}
        <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.9rem' }}>
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              Šířka papírové role tiskárny
            </span>
            <span className="settings-toggle-subtitle">
              Standardní pokladní kotouček má šířku 80 mm (48 znaků na řádek).
            </span>
          </div>

          <div className="settings-segmented-group">
            {[
              { val: '80', label: '80 mm (Standard)' },
              { val: '58', label: '58 mm (Úzká)' }
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

        {/* Auto Print */}
        <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.9rem' }}>
          <div className="settings-toggle-label-wrap">
            <span className="settings-toggle-title">
              Automaticky tisknout účtenku po zaplacení
            </span>
            <span className="settings-toggle-subtitle">
              Při dokončení prodeje ihned vytiskne účtenku bez nutnosti klikat na tlačítko Tisk.
            </span>
          </div>

          <label className="settings-switch-toggle">
            <input
              type="checkbox"
              checked={config.autoPrintReceipt !== false}
              onChange={e => handleUpdate({ autoPrintReceipt: e.target.checked })}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>

        {/* Receipt Footer */}
        <div className="settings-field">
          <label className="settings-label">
            {t('settings.receipt_footer') || 'Text v patičce účtenky'}
          </label>
          <input
            type="text"
            className="settings-input"
            value={config.receiptFooter || ''}
            placeholder="Děkujeme za váš nákup a těšíme se na další návštěvu!"
            onChange={e => setConfig({ ...config, receiptFooter: e.target.value })}
            onBlur={e => handleUpdate({ receiptFooter: e.target.value })}
          />
        </div>
      </div>

      {/* 💵 Card 3: Pokladní zásuvka (Cash Drawer) */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <DollarSign size={19} style={{ color: 'var(--accent-emerald)' }} />
              <span>Pokladní zásuvka na peníze</span>
            </h3>
            <p className="settings-section-desc">
              Zásuvka připojená kabelem RJ11 do tiskárny se automaticky otevírá při platbě hotovostí.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Test elektrického impulsu zásuvky
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Ověřte, zda tiskárna dokáže elektromagneticky uvolnit západku zásuvky.
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
            <span>{drawerTesting ? 'Otevírám...' : 'Vyzkoušet otevření zásuvky'}</span>
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
