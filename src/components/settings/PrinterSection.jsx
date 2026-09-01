import React from 'react';
import { Printer, RefreshCw, Save } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function PrinterSection({
  config,
  setConfig,
  printerDevices,
  scanningPrinters,
  onScanPrinters,
  onSubmit,
  saveSuccess
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Printer size={20} style={{ color: 'var(--accent-blue)' }} />
          <span>Nastavení Tiskárny Účtenek (ESC/POS)</span>
        </h3>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={16} style={{ color: 'var(--accent-blue)' }} />
                <span>Výběr Připojeného Tiskového Zařízení</span>
              </label>
              <button
                type="button"
                className="key-btn"
                onClick={onScanPrinters}
                disabled={scanningPrinters}
                style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <RefreshCw size={12} className={scanningPrinters ? 'spin-icon' : ''} />
                <span>{scanningPrinters ? 'Hledám...' : 'Obnovit'}</span>
              </button>
            </div>

            <select
              value={config.printerAddress || '/dev/usb/lp0'}
              onChange={e => {
                const selectedAddr = e.target.value;
                const matchedDev = printerDevices.find(d => d.address === selectedAddr || d.id === selectedAddr);
                const interfaceType = matchedDev ? matchedDev.interface : (selectedAddr.includes('192.') ? 'NETWORK' : 'USB');
                setConfig({
                  ...config,
                  printerAddress: selectedAddr,
                  printerInterface: interfaceType
                });
              }}
              style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}
            >
              {printerDevices.map(dev => (
                <option key={dev.id} value={dev.address} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  {dev.status === 'CONNECTED' ? '🟢 ' : dev.status === 'VIRTUAL' ? '🌐 ' : '⚙️ '}{dev.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Šířka Papíru Účtenky
              </label>
              <select
                value={config.printerPaperWidth || '80'}
                onChange={e => setConfig({ ...config, printerPaperWidth: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700' }}
              >
                <option value="80">{t('settings.printer_80mm')}</option>
                <option value="58">{t('settings.printer_58mm')}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Automatický Tisk Účtenky po Dokončení Prodeje
              </label>
              <select
                value={config.autoPrintReceipt !== false ? 'yes' : 'no'}
                onChange={e => setConfig({ ...config, autoPrintReceipt: e.target.value === 'yes' })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700' }}
              >
                <option value="yes">Ano (Automaticky odeslat na tiskárnu)</option>
                <option value="no">Ne (Pouze zobrazit náhled na obrazovce)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              {t('settings.receipt_footer')}
            </label>
            <input
              type="text"
              value={config.receiptFooter || ''}
              onChange={e => setConfig({ ...config, receiptFooter: e.target.value })}
              placeholder="Děkujeme za nákup!"
              style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
            />
          </div>

          <button
            type="submit"
            className="pay-btn pay-btn-cash"
            style={{ marginTop: '0.5rem', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Save size={18} />
            <span>{saveSuccess ? 'Uloženo!' : 'Uložit Nastavení Tiskárny'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
