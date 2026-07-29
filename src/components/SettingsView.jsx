import React, { useState, useEffect } from 'react';
import {
  Store,
  Tag,
  Save,
  Trash2,
  Download,
  Shield,
  ArrowRight,
  Upload,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Server,
  Key,
  Send,
  Calendar,
  FileCheck,
  Printer
} from 'lucide-react';
import {
  fetchBackendRoot,
  fetchEetStatus,
  verifyEetConnection,
  uploadEetCert,
  processEetQueue
} from '../api/posApi';

export default function SettingsView({
  storeConfig,
  onSaveStoreConfig,
  presets,
  onResetData,
  onNavigateToPresets
}) {
  const [config, setConfig] = useState({
    id_provozovny: '11',
    id_pokl: '1',
    eet_environment: 'playground',
    ...storeConfig
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Backend Connection & EET State
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendLoading, setBackendLoading] = useState(true);
  const [eetStatusData, setEetStatusData] = useState(null);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState(null);
  const [certPassword, setCertPassword] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Verification State
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  // Queue Processing State
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueResult, setQueueResult] = useState(null);

  // Load backend status on mount
  const loadBackendInfo = async () => {
    setBackendLoading(true);
    const rootRes = await fetchBackendRoot();
    setBackendConnected(rootRes.online);

    if (rootRes.online) {
      const eetStatus = await fetchEetStatus();
      if (eetStatus) {
        setEetStatusData(eetStatus);
        setConfig(prev => ({
          ...prev,
          dic: eetStatus.dic || prev.dic,
          id_provozovny: eetStatus.id_provozovny || eetStatus.id_jednotky || prev.id_provozovny || '11',
          id_pokl: eetStatus.id_pokl || prev.id_pokl || '1',
          eet_environment: eetStatus.environment || prev.eet_environment || 'playground'
        }));
      }
    }
    setBackendLoading(false);
  };

  useEffect(() => {
    loadBackendInfo();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveStoreConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportJSON = () => {
    const categories = JSON.parse(localStorage.getItem('himmel_pos_categories') || '[]');
    const salesHistory = JSON.parse(localStorage.getItem('himmel_pos_sales') || '[]');

    const backupData = {
      storeConfig: config,
      presets,
      categories,
      salesHistory,
      exportedAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `himmel_pos_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData.storeConfig) {
          setConfig(importedData.storeConfig);
          onSaveStoreConfig(importedData.storeConfig);
          localStorage.setItem('himmel_pos_config', JSON.stringify(importedData.storeConfig));
        }
        if (Array.isArray(importedData.presets)) {
          localStorage.setItem('himmel_pos_presets', JSON.stringify(importedData.presets));
        }
        if (Array.isArray(importedData.categories)) {
          localStorage.setItem('himmel_pos_categories', JSON.stringify(importedData.categories));
        }
        if (Array.isArray(importedData.salesHistory)) {
          localStorage.setItem('himmel_pos_sales', JSON.stringify(importedData.salesHistory));
        }

        alert('✅ Záloha byla úspěšně načtena! Obnovuji rozhraní...');
        window.location.reload();
      } catch (err) {
        alert('❌ Nepodařilo se načíst záložní soubor. Zkontrolujte, zda jde o platný JSON záložní soubor.');
      }
    };
    reader.readAsText(file);
  };

  const handleCertUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadLoading(true);
    setUploadResult(null);

    const res = await uploadEetCert(selectedFile, certPassword, config.eet_environment || 'playground');
    setUploadResult(res);
    setUploadLoading(false);

    if (res.status === 'SUCCESS') {
      setSelectedFile(null);
      setCertPassword('');
      loadBackendInfo();
    }
  };

  const handleTestVerify = async () => {
    setVerifyLoading(true);
    setVerifyResult(null);
    const res = await verifyEetConnection();
    setVerifyResult(res);
    setVerifyLoading(false);
  };

  const handleProcessQueue = async () => {
    setQueueLoading(true);
    setQueueResult(null);
    const res = await processEetQueue();
    setQueueResult(res);
    setQueueLoading(false);
    loadBackendInfo();
  };

  const certInfo = eetStatusData?.certificate;

  const handlePrintWidthRulerTest = () => {
    const is58 = (config.printerPaperWidth || '80') === '58';
    const testWindow = window.open('', '_blank', 'width=400,height=600');
    if (!testWindow) return;

    const charCount = is58 ? 32 : 48;
    const printWidth = is58 ? '48mm' : '72mm';
    const rulerNumbers = is58 ? '12345678901234567890123456789032' : '123456789012345678901234567890123456789012345678';
    const borderLine = is58 ? 'L' + '-'.repeat(30) + 'R' : 'L' + '-'.repeat(46) + 'R';

    testWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Šířky Tiskárny</title>
          <style>
            @page { margin: 0; size: auto; }
            body { font-family: monospace; font-size: 10px; margin: 0; padding: 2px; background: #fff; color: #000; }
            .ruler-box { width: ${printWidth}; max-width: ${printWidth}; border: 1px dashed #000; padding: 4px; box-sizing: border-box; text-align: center; }
            .line { white-space: pre; font-size: 9px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="ruler-box">
            <div style="font-weight:bold; font-size:11px; margin-bottom:4px;">KALIBRACE ŠÍŘKY TISKÁRNY</div>
            <div>Typ: ${is58 ? '58 mm rola (48 mm hlava)' : '80 mm rola (72 mm hlava)'}</div>
            <div class="line" style="margin:4px 0;">${borderLine}</div>
            <div class="line">${rulerNumbers}</div>
            <div class="line" style="margin:4px 0;">${borderLine}</div>
            <div style="font-size:8px; margin-top:4px;">Pokud vidíte písmena 'L' i 'R' na okrajích, ořez okrajů tiskárny je 100% v pořádku.</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    testWindow.document.close();
  };

  return (
    <div className="full-view-container">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title" style={{ fontSize: '1.4rem' }}>
          <Store size={24} style={{ color: 'var(--accent-purple)' }} />
          <span>Nastavení Pokladny & EET 2.0 Backend</span>
        </div>

        {/* Live Backend Connection Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="status-badge" style={{
            background: backendConnected ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
            borderColor: backendConnected ? 'rgba(5, 150, 105, 0.4)' : 'rgba(225, 29, 72, 0.4)',
            color: backendConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            padding: '0.4rem 0.85rem'
          }}>
            <span className="status-dot" style={{ background: backendConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}></span>
            <span>{backendLoading ? 'Ověřování serveru...' : backendConnected ? 'Python Backend ONLINE (http://localhost:8000)' : 'Backend OFFLINE (Režim Simulace)'}</span>
          </div>

          <button
            className="nav-tab"
            onClick={loadBackendInfo}
            title="Obnovit stav připojení"
            style={{ padding: '0.4rem 0.6rem' }}
          >
            <RefreshCw size={16} className={backendLoading ? 'spin-icon' : ''} />
          </button>
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
            Spravujte všech {presets.length} položek v celoobrazovkovém katalogu.
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Store Config Form */}
        <div className="table-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Store size={18} style={{ color: 'var(--accent-blue)' }} />
            <span>Údaje o Prodejně & Registraci</span>
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
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
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
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
                  required
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Město a PSČ</label>
                <input
                  type="text"
                  value={config.city}
                  onChange={e => setConfig({ ...config, city: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
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
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
                  required
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>DIČ / EIČ (EET ID)</label>
                <input
                  type="text"
                  value={config.dic}
                  onChange={e => setConfig({ ...config, dic: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
                  required
                />
              </div>
            </div>

            {/* EET Register Parameters */}
            <div style={{ display: 'flex', gap: '0.75rem', background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Číslo Evidenční Jednotky (id_jednotky)
                </label>
                <input
                  type="text"
                  value={config.id_provozovny || '11'}
                  onChange={e => setConfig({ ...config, id_provozovny: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '700' }}
                  required
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Označení Pokladny (id_pokl)
                </label>
                <input
                  type="text"
                  value={config.id_pokl || '1'}
                  onChange={e => setConfig({ ...config, id_pokl: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '700' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Výchozí sazba DPH
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

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Cílové EET Prostředí
                </label>
                <select
                  value={config.eet_environment || 'playground'}
                  onChange={e => setConfig({ ...config, eet_environment: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--accent-purple)', fontWeight: '800' }}
                >
                  <option value="playground">Neprodukční (Playground)</option>
                  <option value="production">Produkční (Tržby EET)</option>
                </select>
              </div>
            </div>

            {/* Thermal Receipt Printer Selection (58mm vs 80mm) */}
            <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.4rem' }}>
                Typ & Šířka Papíru Pokladní Tiskárny (ESC/POS)
              </label>
              <select
                value={config.printerPaperWidth || '80'}
                onChange={e => setConfig({ ...config, printerPaperWidth: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '800' }}
              >
                <option value="80" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  🖨️ 80 mm rola (72 mm tisková oblast - max 48 znaků/řádek)
                </option>
                <option value="58" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  🧾 58 mm rola (48 mm tisková oblast - max 32 znaků/řádek)
                </option>
              </select>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Nastavení automaticky přizpůsobí rozvržení účtenky na 48 mm / 72 mm pro 100% čitelné okraje.
              </div>

              {/* Printer Width Calibration Test Button */}
              <div style={{ marginTop: '0.6rem', padding: '0.65rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.3rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Printer size={14} style={{ color: 'var(--accent-blue)' }} />
                  <span>Kalibrace & Test Ořezu Šířky</span>
                </div>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={handlePrintWidthRulerTest}
                  style={{ width: '100%', padding: '0.45rem', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700' }}
                >
                  <Printer size={14} />
                  <span>Vytisknout Testovací Pravítko Šířky ({config.printerPaperWidth === '58' ? '48 mm' : '72 mm'})</span>
                </button>
              </div>
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
              <span>{saveSuccess ? 'Uloženo!' : 'Uložit Nastavení Prodejny'}</span>
            </button>
          </form>
        </div>

        {/* EET 2.0 Certificate Management & Live Testing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Certificate Status Card */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} style={{ color: certInfo?.loaded ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
              <span>Certifikát Pokladny EET 2.0</span>
            </h3>

            {certInfo?.loaded ? (
              <div style={{ background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-emerald)', fontWeight: '800', marginBottom: '0.5rem' }}>
                  <CheckCircle size={18} />
                  <span>Certifikát je Aktivní a Načten</span>
                </div>
                <div><strong>Subjekt:</strong> {certInfo.subject}</div>
                <div><strong>Vydavatel:</strong> {certInfo.issuer}</div>
                <div><strong>Sériové číslo:</strong> <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{certInfo.serial_number}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                  <Calendar size={14} />
                  <span>Platnost do: <strong>{new Date(certInfo.not_valid_after).toLocaleDateString('cs-CZ')}</strong></span>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-amber)', fontWeight: '700', marginBottom: '0.3rem' }}>
                  <AlertCircle size={18} />
                  <span>Certifikát není nahrán nebo chybí heslo</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Nahrajte soubor merchant certifikátu ve formátu `.p12` nebo `.pfx` pro spuštění fiskalizace na portálu Finanční správy ČR.
                </div>
              </div>
            )}

            {/* Certificate Upload Form */}
            <form onSubmit={handleCertUpload} style={{ marginTop: '1.25rem', borderTop: '1px border var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>Nahrát nový certifikát (.p12 / .pfx)</div>

              <input
                type="file"
                accept=".p12,.pfx"
                onChange={e => setSelectedFile(e.target.files[0])}
                style={{ fontSize: '0.8rem', padding: '0.4rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  placeholder="Heslo k certifikátu .p12"
                  value={certPassword}
                  onChange={e => setCertPassword(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}
                />

                <button
                  type="submit"
                  disabled={!selectedFile || uploadLoading || !backendConnected}
                  className="pay-btn pay-btn-card"
                  style={{ height: '40px', padding: '0 1rem', fontSize: '0.8rem' }}
                >
                  <Upload size={14} />
                  <span>{uploadLoading ? 'Nahrávání...' : 'Nahrát'}</span>
                </button>
              </div>

              {uploadResult && (
                <div style={{
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: uploadResult.status === 'SUCCESS' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
                  color: uploadResult.status === 'SUCCESS' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  marginTop: '0.3rem'
                }}>
                  {uploadResult.message || uploadResult.detail}
                </div>
              )}
            </form>
          </div>

          {/* Live Verification & Queue Control Card */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={18} style={{ color: 'var(--accent-purple)' }} />
              <span>Ověření Spojení a Fronta EET</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="pay-btn pay-btn-card"
                disabled={verifyLoading || !backendConnected}
                onClick={handleTestVerify}
                style={{ height: '44px', fontSize: '0.85rem' }}
              >
                <FileCheck size={16} />
                <span>{verifyLoading ? 'Odesílání ověřovací zprávy...' : 'Test Spojení s EET (Ověření overeni=true)'}</span>
              </button>

              {verifyResult && (
                <div style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: verifyResult.status === 'SUCCESS' ? 'rgba(5, 150, 105, 0.12)' : 'rgba(225, 29, 72, 0.12)',
                  border: `1px solid ${verifyResult.status === 'SUCCESS' ? 'rgba(5, 150, 105, 0.3)' : 'rgba(225, 29, 72, 0.3)'}`,
                  fontSize: '0.8rem',
                  lineHeight: '1.5'
                }}>
                  <div style={{ fontWeight: '800', color: verifyResult.status === 'SUCCESS' ? 'var(--accent-emerald)' : 'var(--accent-rose)', marginBottom: '0.2rem' }}>
                    {verifyResult.status === 'SUCCESS' ? '✓ Ověřovací zpráva byla úspěšně přijata EET serverem!' : '✕ Chyba při ověřování EET'}
                  </div>
                  <div>{verifyResult.detail}</div>
                  {verifyResult.pok && (
                    <div style={{ marginTop: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff' }}>
                      <strong>Navrácený POK:</strong> {verifyResult.pok}
                    </div>
                  )}
                  {verifyResult.bkp && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <strong>Kód BKP:</strong> {verifyResult.bkp}
                    </div>
                  )}
                </div>
              )}

              {/* Offline Queue Section */}
              <div style={{ marginTop: '0.75rem', borderTop: '1px border var(--border-color)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>Offline Fronta Tržeb</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Čeká na odeslání: <strong>{eetStatusData?.pending_offline_sales || 0}</strong> prodejů
                  </div>
                </div>

                <button
                  className="nav-tab"
                  disabled={queueLoading || !backendConnected || (eetStatusData?.pending_offline_sales || 0) === 0}
                  onClick={handleProcessQueue}
                  style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
                >
                  <Send size={14} />
                  <span>{queueLoading ? 'Odesílání...' : 'Odeslat Frontu'}</span>
                </button>
              </div>

              {queueResult && (
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '0.2rem' }}>
                  Odesláno {queueResult.processed_count || 0} neodoslaných tržeb na EET server.
                </div>
              )}
            </div>
          </div>

          {/* Backup Management */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem' }}>Záloha a Správa Dat</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="nav-tab" style={{ flex: 1, minWidth: '160px', padding: '0.6rem' }} onClick={handleExportJSON}>
                <Download size={16} />
                <span>Stáhnout Zálohu (JSON)</span>
              </button>

              <label className="nav-tab" style={{ flex: 1, minWidth: '160px', padding: '0.6rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Upload size={16} />
                <span>Obnovit ze Zálohy (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  style={{ display: 'none' }}
                />
              </label>

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
