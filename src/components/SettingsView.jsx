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
  Send,
  Calendar,
  FileCheck,
  Printer,
  CreditCard,
  Wifi,
  Globe
} from 'lucide-react';
import {
  fetchBackendRoot,
  fetchEetStatus,
  verifyEetConnection,
  uploadEetCert,
  processEetQueue,
  fetchUpdateStatus,
  applySystemUpdate,
  fetchTerminalConfig,
  saveTerminalConfig,
  pingTerminal,
  reconcileTerminal,
  fetchPrinterDevices,
  fetchLitestreamStatus
} from '../api/posApi';
import { useTranslation } from '../i18n/LanguageContext.jsx';

function formatIban(val) {
  if (!val) return '';
  const clean = val.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

export default function SettingsView({
  storeConfig,
  onSaveStoreConfig,
  presets,
  onResetData,
  onNavigateToPresets
}) {
  const { t, language, setLanguage, languages } = useTranslation();
  const [config, setConfig] = useState({
    id_provozovny: '11',
    id_pokl: '1',
    eet_environment: 'playground',
    printerInterface: 'USB',
    printerAddress: '/dev/usb/lp0',
    ...storeConfig
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Printer Hardware Scan State
  const [printerDevices, setPrinterDevices] = useState([]);
  const [scanningPrinters, setScanningPrinters] = useState(false);

  useEffect(() => {
    handleScanPrinters();
  }, []);

  const handleScanPrinters = async () => {
    setScanningPrinters(true);
    const devs = await fetchPrinterDevices();
    setPrinterDevices(devs);
    setScanningPrinters(false);
  };

  // Backend Connection & EET State
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendLoading, setBackendLoading] = useState(true);
  const [eetStatusData, setEetStatusData] = useState(null);
  const [litestreamData, setLitestreamData] = useState(null);

  // System Update State
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateData, setUpdateData] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);

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

  // ČSOB Terminal Ingenico Move 3500 State
  const [termEnabled, setTermEnabled] = useState(false);
  const [termIp, setTermIp] = useState('');
  const [termPort, setTermPort] = useState('8888');
  const [termId, setTermId] = useState('');
  const [termSaveSuccess, setTermSaveSuccess] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  // Check update status
  const handleCheckUpdate = async () => {
    setUpdateLoading(true);
    const res = await fetchUpdateStatus();
    if (res) {
      setUpdateData(res);
    }
    setUpdateLoading(false);
  };

  const handleTriggerApplyUpdate = async () => {
    setApplyLoading(true);
    const res = await applySystemUpdate();
    if (res) {
      setUpdateResult(res);
    } else {
      setUpdateResult({ status: 'ERROR', message: 'Nepodařilo se navázat spojení s aktualizační službou.' });
    }
    setApplyLoading(false);
    setShowUpdateModal(false);
  };

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

      const termConfig = await fetchTerminalConfig();
      if (termConfig) {
        setTermEnabled(termConfig.enabled || false);
        setTermIp(termConfig.ip || '');
        setTermPort(termConfig.port ? termConfig.port.toString() : '8888');
        setTermId(termConfig.terminalId || '');
      }

      const liteStatus = await fetchLitestreamStatus();
      if (liteStatus) {
        setLitestreamData(liteStatus);
      }
    }
    setBackendLoading(false);
  };

  const handleSaveTerminal = async (e) => {
    e.preventDefault();
    const res = await saveTerminalConfig({
      enabled: termEnabled,
      ip: termIp,
      port: parseInt(termPort, 10) || 8888,
      terminalId: termId
    });
    if (res?.status === 'SUCCESS') {
      setTermSaveSuccess(true);
      setTimeout(() => setTermSaveSuccess(false), 3000);
    }
  };

  const handlePingTerminal = async () => {
    setPingLoading(true);
    setPingResult(null);
    const res = await pingTerminal(termIp, parseInt(termPort, 10) || 8888);
    setPingResult(res);
    setPingLoading(false);
  };

  const handleReconcileTerminal = async () => {
    setReconcileLoading(true);
    setReconcileResult(null);
    const res = await reconcileTerminal();
    setReconcileResult(res);
    setReconcileLoading(false);
  };

  useEffect(() => {
    loadBackendInfo();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (config.cashierPin && (config.cashierPin.length < 4 || config.cashierPin.length > 8)) {
      alert('PIN kód musí mít 4 až 8 číslic.');
      return;
    }
    onSaveStoreConfig(config);
    if (config.defaultLanguage) {
      setLanguage(config.defaultLanguage);
    }
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
      } catch {
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
          <span>{t('settings.title')}</span>
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
            <span>{backendLoading ? t('settings.backend_verifying') : backendConnected ? t('settings.backend_online') : t('settings.backend_offline')}</span>
          </div>

          <button
            className="nav-tab"
            onClick={loadBackendInfo}
            title={t('settings.ping_test')}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column Stack: Store Config + CSOB Terminal Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Store Config Form */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Store size={18} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.store_info')}</span>
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  {t('settings.store_name')}
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
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{t('settings.street')}</label>
                  <input
                    type="text"
                    value={config.street}
                    onChange={e => setConfig({ ...config, street: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
                    required
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{t('settings.city')}</label>
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
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{t('settings.ico')}</label>
                  <input
                    type="text"
                    value={config.ico}
                    onChange={e => setConfig({ ...config, ico: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
                    required
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{t('settings.dic')}</label>
                  <input
                    type="text"
                    value={config.dic}
                    onChange={e => setConfig({ ...config, dic: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  {t('settings.bank_account_iban')}
                </label>
                <input
                  type="text"
                  placeholder="CZ65 0800 0000 0012 3456 7890"
                  value={formatIban(config.bankAccountIban || '')}
                  onChange={e => setConfig({ ...config, bankAccountIban: formatIban(e.target.value) })}
                  maxLength={32}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              {/* EET Register Parameters */}
              <div style={{ display: 'flex', gap: '0.75rem', background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    {t('settings.unit_no')}
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
                    {t('settings.register_no')}
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
                    {t('settings.default_vat')}
                  </label>
                  <select
                    value={config.defaultVat !== undefined ? config.defaultVat : 21}
                    onChange={e => setConfig({ ...config, defaultVat: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700' }}
                  >
                    <option value={21}>21%</option>
                    <option value={12}>12%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {t('settings.default_language')}
                  </label>
                  <select
                    value={config.defaultLanguage || 'cs'}
                    onChange={e => setConfig({ ...config, defaultLanguage: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700' }}
                  >
                    {languages.map(l => (
                      <option key={l.code} value={l.code}>
                        {l.flag} {l.name} ({l.label})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {t('settings.environment')}
                  </label>
                  <select
                    value={config.eet_environment || 'playground'}
                    onChange={e => setConfig({ ...config, eet_environment: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--accent-purple)', fontWeight: '800' }}
                  >
                    <option value="playground">Playground</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>

              {/* Cashier Lock & Security Settings */}
              <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={16} style={{ color: 'var(--accent-amber)' }} />
                  <span>Zabezpečení a Uzamčení Pokladny</span>
                </label>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      PIN kód pokladny (4–8 číslic)
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={config.cashierPin || '1234'}
                      onChange={e => setConfig({ ...config, cashierPin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: '800', textAlign: 'center', letterSpacing: '0.2em' }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      Automatické zamknutí
                    </label>
                    <select
                      value={config.autoLockMinutes !== undefined ? config.autoLockMinutes : 15}
                      onChange={e => setConfig({ ...config, autoLockMinutes: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '700' }}
                    >
                      <option value={15}>Po 15 minutách neaktivity (Doporučeno)</option>
                      <option value={5}>Po 5 minutách neaktivity</option>
                      <option value={30}>Po 30 minutách neaktivity</option>
                      <option value={0}>Vypnuto (Pouze ruční zamknutí)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Thermal Receipt Printer Device Selector & Width Calibration */}
              <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Printer size={16} style={{ color: 'var(--accent-blue)' }} />
                    <span>Výběr Připojené Tiskárny Účtenek</span>
                  </label>
                  <button
                    type="button"
                    className="key-btn"
                    onClick={handleScanPrinters}
                    disabled={scanningPrinters}
                    style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    title="Obnovit seznam připojených tiskáren"
                  >
                    <RefreshCw size={12} className={scanningPrinters ? 'spin-icon' : ''} />
                    <span>{scanningPrinters ? 'Hledám...' : 'Obnovit'}</span>
                  </button>
                </div>

                {/* Device Selector Dropdown */}
                <div style={{ marginBottom: '0.65rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Detekované Tiskové Zařízení
                  </label>
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
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.85rem' }}
                  >
                    {printerDevices.map(dev => (
                      <option key={dev.id} value={dev.address} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        {dev.status === 'CONNECTED' ? '🟢 ' : dev.status === 'VIRTUAL' ? '🌐 ' : '⚙️ '}{dev.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Network IP or Custom Address Input (if Custom/Network selected) */}
                {config.printerInterface === 'NETWORK' && (
                  <div style={{ marginBottom: '0.65rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      IP Adresa Síťové Tiskárny (Port 9100)
                    </label>
                    <input
                      type="text"
                      placeholder="192.168.1.100"
                      value={config.printerAddress}
                      onChange={e => setConfig({ ...config, printerAddress: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '700' }}
                    />
                  </div>
                )}

                {/* Paper Roll Width Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Šířka Papírové Role (Termotisk)
                  </label>
                  <select
                    value={config.printerPaperWidth || '80'}
                    onChange={e => setConfig({ ...config, printerPaperWidth: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '800', fontSize: '0.85rem' }}
                  >
                    <option value="80" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      80 mm (72 mm tisknutelná šířka • 48 znaků)
                    </option>
                    <option value="58" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      58 mm (48 mm tisknutelná šířka • 32 znaků)
                    </option>
                    <option value="A4" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      Formát A4 (Faktura / Daňový doklad • 210 x 297 mm)
                    </option>
                  </select>
                </div>

                {/* Direct Silent Hardware Print vs Debug Preview Modal */}
                <div style={{ marginTop: '0.65rem', padding: '0.65rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      ⚡ Přímý HW Tisk (Bez popup okna)
                    </span>
                    <input
                      type="checkbox"
                      checked={config.directHardwarePrint !== false}
                      onChange={e => setConfig({ ...config, directHardwarePrint: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {config.directHardwarePrint !== false
                      ? 'Odesílá účtenku rovnou na fyzickou tiskárnu. Pop-up okno se nezobrazuje.'
                      : '🐞 Režim Náhledu / Vývoje (Debug): Zobrazí náhledové okno s možností ručního tisku.'}
                  </div>
                </div>

                {/* Printer Width Calibration Test Button */}
                <div style={{ marginTop: '0.6rem', padding: '0.65rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.3rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Printer size={14} style={{ color: 'var(--accent-blue)' }} />
                    <span>{t('settings.printer_calibration')}</span>
                  </div>
                  <button
                    type="button"
                    className="nav-tab"
                    onClick={handlePrintWidthRulerTest}
                    style={{ width: '100%', padding: '0.45rem', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700' }}
                  >
                    <Printer size={14} />
                    <span>{t('settings.print_test_ruler')} ({config.printerPaperWidth === '58' ? '48 mm' : '72 mm'})</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  {t('settings.receipt_footer')}
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
                <span>{saveSuccess ? t('common.saved') : t('settings.save_store')}</span>
              </button>
            </form>
          </div>

          {/* ČSOB Payment Terminal Ingenico Move 3500 Preparation Card */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={18} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.csob_title')}</span>
              </h3>
              <span className="status-badge" style={{
                background: termIp ? 'rgba(5, 150, 105, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: termIp ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                borderColor: termIp ? 'rgba(5, 150, 105, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem'
              }}>
                {termIp ? `IP: ${termIp}:${termPort}` : (language === 'vi' ? 'Chờ IP' : language === 'en' ? 'Awaiting IP' : 'Příprava (Čekání na IP)')}
              </span>
            </div>

            <form onSubmit={handleSaveTerminal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  {t('settings.csob_mode')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="vat-btn"
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      background: !termEnabled ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                      borderColor: !termEnabled ? 'var(--accent-blue)' : 'var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem'
                    }}
                    onClick={() => setTermEnabled(false)}
                  >
                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: !termEnabled ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                      {t('settings.csob_manual_mode')}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {t('settings.csob_manual_desc')}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="vat-btn"
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      background: termEnabled ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                      borderColor: termEnabled ? 'var(--accent-emerald)' : 'var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem'
                    }}
                    onClick={() => setTermEnabled(true)}
                  >
                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: termEnabled ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                      {t('settings.csob_auto_mode')}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {t('settings.csob_auto_desc')}
                    </span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {t('settings.csob_ip')}
                  </label>
                  <input
                    type="text"
                    placeholder="192.168.1.150"
                    value={termIp}
                    onChange={e => setTermIp(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {t('settings.csob_port')}
                  </label>
                  <input
                    type="number"
                    placeholder="8888"
                    value={termPort}
                    onChange={e => setTermPort(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  {t('settings.csob_tid')}
                </label>
                <input
                  type="text"
                  placeholder="12345678"
                  value={termId}
                  onChange={e => setTermId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: '600' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="submit" className="pay-btn pay-btn-card" style={{ flex: 1, height: '42px', fontSize: '0.85rem' }}>
                  <Save size={16} />
                  <span>{termSaveSuccess ? t('common.saved') : t('settings.save_terminal')}</span>
                </button>

                <button
                  type="button"
                  className="nav-tab"
                  disabled={pingLoading || !backendConnected}
                  onClick={handlePingTerminal}
                  style={{ padding: '0 1rem', fontSize: '0.8rem', fontWeight: '700' }}
                >
                  <Wifi size={14} className={pingLoading ? 'spin' : ''} />
                  <span>{pingLoading ? '...' : t('settings.ping_test')}</span>
                </button>
              </div>

              {pingResult && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: pingResult.success ? 'rgba(5, 150, 105, 0.12)' : 'rgba(225, 29, 72, 0.12)',
                  border: `1px solid ${pingResult.success ? 'rgba(5, 150, 105, 0.3)' : 'rgba(225, 29, 72, 0.3)'}`,
                  fontSize: '0.8rem',
                  color: pingResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}>
                  <div style={{ fontWeight: '800' }}>{pingResult.success ? '✓ OK' : '✕ Error'}</div>
                  <div>{pingResult.message}</div>
                </div>
              )}

              {/* End of day reconciliation button */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{t('settings.reconcile')}</div>
                </div>
                <button
                  type="button"
                  className="nav-tab"
                  disabled={reconcileLoading || !backendConnected || !termIp}
                  onClick={handleReconcileTerminal}
                  style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
                >
                  <span>{reconcileLoading ? '...' : t('settings.reconcile')}</span>
                </button>
              </div>

              {reconcileResult && (
                <div style={{ fontSize: '0.8rem', color: reconcileResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)', marginTop: '0.2rem' }}>
                  {reconcileResult.message}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* EET 2.0 Certificate Management & Live Testing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Certificate Status Card */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} style={{ color: certInfo?.loaded ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
              <span>{t('settings.cert_title')}</span>
            </h3>

            {certInfo?.loaded ? (
              <div style={{ background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-emerald)', fontWeight: '800', marginBottom: '0.5rem' }}>
                  <CheckCircle size={18} />
                  <span>{t('settings.cert_active')}</span>
                </div>
                <div><strong>Subject:</strong> {certInfo.subject}</div>
                <div><strong>Issuer:</strong> {certInfo.issuer}</div>
                <div><strong>S/N:</strong> <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{certInfo.serial_number}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                  <Calendar size={14} />
                  <span>Valid to: <strong>{new Date(certInfo.not_valid_after).toLocaleDateString()}</strong></span>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-amber)', fontWeight: '700', marginBottom: '0.3rem' }}>
                  <AlertCircle size={18} />
                  <span>{t('settings.cert_missing')}</span>
                </div>
              </div>
            )}

            {/* Certificate Upload Form */}
            <form onSubmit={handleCertUpload} style={{ marginTop: '1.25rem', borderTop: '1px border var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{t('settings.cert_upload_label')}</div>

              <input
                type="file"
                accept=".p12,.pfx"
                onChange={e => setSelectedFile(e.target.files[0])}
                style={{ fontSize: '0.8rem', padding: '0.4rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  placeholder={t('settings.cert_password')}
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
                  <span>{uploadLoading ? '...' : t('settings.upload_btn')}</span>
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
              <span>{t('settings.eet_queue_title')}</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="pay-btn pay-btn-card"
                disabled={verifyLoading || !backendConnected}
                onClick={handleTestVerify}
                style={{ height: '44px', fontSize: '0.85rem' }}
              >
                <FileCheck size={16} />
                <span>{verifyLoading ? '...' : t('settings.test_eet_btn')}</span>
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
                    {verifyResult.status === 'SUCCESS' ? '✓ OK' : '✕ Error'}
                  </div>
                  <div>{verifyResult.detail}</div>
                </div>
              )}

              {/* Offline Queue Section */}
              <div style={{ marginTop: '0.75rem', borderTop: '1px border var(--border-color)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>Offline Queue</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Pending: <strong>{eetStatusData?.pending_offline_sales || 0}</strong>
                  </div>
                </div>

                <button
                  className="nav-tab"
                  disabled={queueLoading || !backendConnected || (eetStatusData?.pending_offline_sales || 0) === 0}
                  onClick={handleProcessQueue}
                  style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
                >
                  <Send size={14} />
                  <span>{queueLoading ? '...' : t('settings.process_queue_btn')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* System Updates Management */}
          <div className="table-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={18} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.updates_title')}</span>
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Version: {updateData?.current_version?.hash ? `#${updateData.current_version.hash}` : 'Himmel POS 1.0.0'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="nav-tab"
                  disabled={updateLoading}
                  onClick={handleCheckUpdate}
                  style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
                >
                  <RefreshCw size={14} className={updateLoading ? 'spin' : ''} />
                  <span>Check</span>
                </button>
              </div>
            </div>
          </div>

          {/* Backup Management */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem' }}>{t('settings.backup_title')}</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="nav-tab" style={{ flex: 1, minWidth: '160px', padding: '0.6rem' }} onClick={handleExportJSON}>
                <Download size={16} />
                <span>{t('settings.export_backup')}</span>
              </button>

              <label className="nav-tab" style={{ flex: 1, minWidth: '160px', padding: '0.6rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Upload size={16} />
                <span>{t('settings.import_backup')}</span>
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

            {/* Litestream Cloud Replication Status Panel */}
            <div style={{ marginTop: '1rem', background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={14} style={{ color: litestreamData?.is_running ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
                  <span>Litestream Cloud Replikace (WAL)</span>
                </span>
                <span className="status-badge" style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.7rem',
                  background: litestreamData?.is_running ? 'rgba(5, 150, 105, 0.15)' : litestreamData?.litestream_configured ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                  color: litestreamData?.is_running ? 'var(--accent-emerald)' : litestreamData?.litestream_configured ? 'var(--accent-amber)' : 'var(--text-muted)'
                }}>
                  {litestreamData?.is_running ? '🟢 Aktivní replikace' : litestreamData?.litestream_configured ? '🟡 Konfigurace OK' : '⚪ Neaktivní'}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                {litestreamData?.message || 'Kontrola stavu replikace SQLite databáze...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for System Update */}
      {showUpdateModal && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <RefreshCw size={20} style={{ color: 'var(--accent-blue)' }} />
                <span>Potvrzení aktualizace pokladny</span>
              </div>
              <button className="close-modal-btn" onClick={() => setShowUpdateModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Opravdu chcete spustit aktualizaci pokladního systému?
              </p>

              {updateData?.latest_version && (
                <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '700', color: 'var(--accent-emerald)', marginBottom: '4px' }}>
                    Nová verze #{updateData.latest_version.hash}
                  </div>
                  <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    "{updateData.latest_version.message}"
                  </div>
                </div>
              )}

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Aplikace na malou chvíli ukončí pokladní rozhraní, stáhne nové soubory z Git repozitáře a automaticky se znovu spustí.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-color)', justifyContent: 'flex-end' }}>
              <button className="nav-tab" onClick={() => setShowUpdateModal(false)}>
                Zrušit
              </button>
              <button
                className="pay-btn pay-btn-card"
                disabled={applyLoading}
                onClick={handleTriggerApplyUpdate}
                style={{ height: '42px', padding: '0 1.25rem' }}
              >
                <span>{applyLoading ? 'Spouštění...' : 'Stáhnout a instalovat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
