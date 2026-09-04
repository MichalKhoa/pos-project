import {
  Receipt,
  FileText,
  AlignLeft,
  QrCode,
  Printer,
  CheckCircle,
  Scissors,
  Upload,
  Trash2,
  Image
} from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import ReceiptPreviewPaper from '../receipt/ReceiptPreviewPaper.jsx';
import { printReceiptBackend } from '../../api/posApi.js';
import { soundFx } from '../../utils/audio.js';

export default function ReceiptSection({
  config,
  setConfig,
  saveConfigBatch
}) {
  const { t } = useTranslation();
  const [testPrinting, setTestPrinting] = useState(false);
  const [testMessage, setTestMessage] = useState(null);

  // 🎛️ Interactive Preview Scenario State
  const [previewMode, setPreviewMode] = useState('sale'); // 'sale' | 'refund'
  const [previewPayment, setPreviewPayment] = useState('cash'); // 'cash' | 'card' | 'split' | 'qr'
  const [previewEet, setPreviewEet] = useState(true);
  const [previewCopy, setPreviewCopy] = useState(1); // 1 | 2
  const [previewQrDemo, setPreviewQrDemo] = useState(false);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 512;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressedBase64 = canvas.toDataURL('image/png');
        handleUpdate({
          receiptShowLogo: true,
          receiptLogoBase64: compressedBase64
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUpdate = (updates) => {
    if (saveConfigBatch) {
      saveConfigBatch(updates);
    } else {
      const updated = { ...config, ...updates };
      setConfig(updated);
    }
  };

  const sampleItems = [
    { id: '1', name: 'Čerstvý chléb Šumava', price: 42.00, quantity: 1, vat: 12, barcode: '859400123' },
    { id: '2', name: 'Mléko polotučné 1.5% 1L', price: 23.00, quantity: 1, vat: 12, barcode: '859400456' },
    { id: '3', name: 'Káva Espresso Zrnková 250g', price: 120.00, quantity: 1, vat: 21, barcode: '859400789', discountPercent: 10 }
  ];

  const currentSampleSale = useMemo(() => {
    const isRefund = previewMode === 'refund';
    const sale = {
      id: 'DEMO-SALE',
      receiptNumber: isRefund ? '2026-S005' : '2026-0042',
      timestamp: new Date().toISOString(),
      isRefund,
      is_refund: isRefund,
      originalReceiptNumber: isRefund ? '2026-0038' : undefined,
      refundReason: isRefund ? 'Vrácení zboží v zákonné lhůtě' : undefined,
      totalAmount: 185.00,
      cashier: 'Tereza N.',
      taxSummary: {
        '12': { rate: 12, net: 58.04, tax: 6.96, gross: 65.00 },
        '21': { rate: 21, net: 99.17, tax: 20.83, gross: 120.00 }
      }
    };

    if (previewPayment === 'cash') {
      sale.paymentMethod = 'cash';
      sale.tenderedAmount = 200.00;
      sale.changeDue = 15.00;
    } else if (previewPayment === 'card') {
      sale.paymentMethod = 'card';
    } else if (previewPayment === 'split') {
      sale.paymentMethod = 'split';
      sale.splitDetails = { cash: 100.00, card: 85.00 };
    } else if (previewPayment === 'qr') {
      sale.paymentMethod = 'qr';
    }

    if (previewEet && config.eetEnabled) {
      sale.fik = 'e5b7a120-192a-4318-9710-d5a23f4b8219-03';
      sale.bkp = 'A4C7-B2E8-89F1-D36A-1109';
      sale.pkp = 'MIIEPgIBAAKCAQEA7b6X3G8V9q12simulated';
    }

    return sale;
  }, [previewMode, previewPayment, previewEet, config.eetEnabled]);

  const handlePrintTest = async () => {
    setTestPrinting(true);
    setTestMessage(null);
    soundFx.playKeypadClick();
    try {
      const res = await printReceiptBackend({
        ...currentSampleSale,
        items: sampleItems
      }, config);

      soundFx.playSuccessChime();
      setTestMessage({
        type: 'success',
        text: res?.status === 'PRINTED'
          ? (t('settings.receipt_test_printed') || 'Zkušební účtenka byla odeslána na tiskárnu.')
          : (t('settings.receipt_test_simulated') || 'Tisk simulován (tiskárna offline).')
      });
    } catch (err) {
      soundFx.playErrorChime?.();
      setTestMessage({
        type: 'error',
        text: t('settings.receipt_test_failed') || `Chyba tisku: ${err.message}`
      });
    } finally {
      setTestPrinting(false);
      setTimeout(() => setTestMessage(null), 4000);
    }
  };

  const is58mm = (config.printerPaperWidth || '80') === '58';

  return (
    <div className="settings-grid-layout">
      {/* 🎛️ LEFT COLUMN: Visual & Layout Settings */}
      <div className="settings-grid-col">
        {/* ✂️ Card 1: Oddělovače a Písmo */}
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Scissors size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.receipt_style_title') || 'Oddělovače & Styl Písma'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.receipt_style_desc') || 'Přizpůsobte vodorovné linky, styl titulku a zvýraznění textu.'}
              </p>
            </div>
          </div>

          {/* Separator Style */}
          <div className="settings-field">
            <label className="settings-label">
              {t('settings.receipt_separator_style') || 'Styl oddělovací linky'}
            </label>
            <div className="settings-segmented-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'dashed', label: t('settings.receipt_sep_dashed') || 'Čárkovaný (- - -)' },
                { id: 'double', label: t('settings.receipt_sep_double') || 'Dvojitý (===)' },
                { id: 'dotted', label: t('settings.receipt_sep_dotted') || 'Tečkovaný (....)' },
                { id: 'solid', label: t('settings.receipt_sep_solid') || 'Plná čára (───)' },
                { id: 'stars', label: t('settings.receipt_sep_stars') || 'Hvězdičky (★ ★)' },
                { id: 'wavy', label: t('settings.receipt_sep_wavy') || 'Vlnky (~ ~ ~)' }
              ].map(sep => (
                <button
                  key={sep.id}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptSeparatorStyle || 'dashed') === sep.id ? 'active' : ''}`}
                  onClick={() => handleUpdate({ receiptSeparatorStyle: sep.id })}
                  style={{ minHeight: '38px', fontSize: '0.78rem' }}
                >
                  {sep.label}
                </button>
              ))}
            </div>
          </div>

          {/* Separator Spacing */}
          <div className="settings-field" style={{ marginTop: '0.85rem' }}>
            <label className="settings-label">
              {t('settings.receipt_separator_spacing') || 'Rozestupy oddělovačů'}
            </label>
            <div className="settings-segmented-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'compact', label: t('settings.receipt_spacing_compact') || 'Kompaktní (4px)' },
                { id: 'standard', label: t('settings.receipt_spacing_standard') || 'Standardní (7px)' },
                { id: 'spacious', label: t('settings.receipt_spacing_spacious') || 'Vzdušný (12px)' }
              ].map(sp => (
                <button
                  key={sp.id}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptSeparatorSpacing || 'standard') === sp.id ? 'active' : ''}`}
                  onClick={() => handleUpdate({ receiptSeparatorSpacing: sp.id })}
                  style={{ minHeight: '38px', fontSize: '0.78rem' }}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title Style */}
          <div className="settings-field" style={{ marginTop: '0.85rem' }}>

            <label className="settings-label">
              {t('settings.receipt_title_style') || 'Vzhled záhlaví dokladu'}
            </label>
            <div className="settings-segmented-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'banner', label: t('settings.receipt_title_banner') || '══ Proužek ══' },
                { id: 'framed', label: t('settings.receipt_title_framed') || '[ Rámeček ]' },
                { id: 'classic', label: t('settings.receipt_title_classic') || 'Klasický s linkou' },
                { id: 'minimal', label: t('settings.receipt_title_minimal') || 'Jednoduchý bez rámu' }
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptTitleStyle || 'banner') === st.id ? 'active' : ''}`}
                  onClick={() => handleUpdate({ receiptTitleStyle: st.id })}
                  style={{ minHeight: '38px', fontSize: '0.78rem' }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bold font options */}
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-primary)', display: 'block', marginBottom: '0.6rem' }}>
              {t('settings.receipt_bold_options') || 'Zvýraznění textu (Tučné písmo)'}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {[
                { key: 'receiptBoldStoreName', label: t('settings.receipt_bold_store') || 'Tučný název prodejny', def: true },
                { key: 'receiptBoldItemNames', label: t('settings.receipt_bold_items') || 'Tučné názvy prodaných položek', def: true },
                { key: 'receiptBoldPrices', label: t('settings.receipt_bold_prices') || 'Tučné částky a ceny položek', def: true },
                { key: 'receiptBoldTotal', label: t('settings.receipt_bold_total') || 'Extra zvýrazněná celková částka k úhradě', def: true },
                { key: 'receiptBoldFooter', label: t('settings.receipt_bold_footer') || 'Tučné písmo v patičce účtenky', def: false }
              ].map(opt => (
                <div key={opt.key} className="settings-toggle-row" style={{ padding: '0.25rem 0' }}>
                  <span className="settings-toggle-title" style={{ fontSize: '0.85rem' }}>{opt.label}</span>
                  <label className="settings-switch-toggle">
                    <input
                      type="checkbox"
                      checked={config[opt.key] !== undefined ? Boolean(config[opt.key]) : opt.def}
                      onChange={e => handleUpdate({ [opt.key]: e.target.checked })}
                    />
                    <span className="settings-switch-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* 🏢 Card 2: Hlavička a Údaje Prodejny */}
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <AlignLeft size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.receipt_header_title') || 'Údaje v Hlavičce Účtenky'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.receipt_header_desc') || 'Kontakty na účtence a daňový status prodejce.'}
              </p>
            </div>
          </div>

          {/* Store Logo Upload & Toggle */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '0.85rem' }}>
            <div className="settings-toggle-row" style={{ padding: '0.25rem 0' }}>
              <div className="settings-toggle-label-wrap">
                <span className="settings-toggle-title">{t('settings.receipt_show_logo') || 'Grafické logo v záhlaví účtenky'}</span>
                <span className="settings-toggle-subtitle">{t('settings.receipt_show_logo_desc') || 'Tisk monochromatického loga na termotiskárně a v náhledu'}</span>
              </div>
              <label className="settings-switch-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(config.receiptShowLogo)}
                  onChange={e => handleUpdate({ receiptShowLogo: e.target.checked })}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>

            {config.receiptShowLogo && (
              <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {config.receiptLogoBase64 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.5rem 0.75rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <img
                      src={config.receiptLogoBase64}
                      alt="Logo preview"
                      style={{ height: '44px', maxWidth: '120px', objectFit: 'contain', filter: 'grayscale(100%)' }}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <label className="settings-segmented-btn" style={{ cursor: 'pointer', padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center' }}>
                        <Upload size={14} style={{ marginRight: '4px' }} />
                        <span>{t('settings.receipt_logo_change') || 'Změnit'}</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          style={{ display: 'none' }}
                          onChange={handleLogoUpload}
                        />
                      </label>
                      <button
                        type="button"
                        className="settings-segmented-btn"
                        style={{ color: 'var(--accent-rose)', padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center' }}
                        onClick={() => handleUpdate({ receiptLogoBase64: '' })}
                      >
                        <Trash2 size={14} style={{ marginRight: '4px' }} />
                        <span>{t('settings.receipt_logo_remove') || 'Odebrat'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 1rem',
                      background: 'var(--bg-main)',
                      border: '1.5px dashed var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <Image size={18} style={{ color: 'var(--accent-blue)' }} />
                    <span>{t('settings.receipt_logo_upload') || 'Nahrát obrázek loga (PNG/JPG, max 512px)'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      style={{ display: 'none' }}
                      onChange={handleLogoUpload}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">{t('settings.receipt_vat_payer_status') || 'Daňový status prodejce na dokladu'}</span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_vat_payer_status_desc') || 'Zobrazí označení plátce nebo neplátce DPH vedle IČO/DIČ'}</span>
            </div>
            <div className="settings-segmented-group">
              {[
                { id: 'payer', label: t('settings.receipt_status_payer') || 'Plátce DPH' },
                { id: 'non_payer', label: t('settings.receipt_status_non_payer') || 'Neplátce DPH' }
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptVatPayerStatus || 'payer') === s.id ? 'active' : ''}`}
                  onClick={() => handleUpdate({ receiptVatPayerStatus: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">{t('settings.receipt_show_contacts') || 'Zobrazit kontaktní údaje na účtence'}</span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_show_contacts_desc') || 'Vytiskne telefonní číslo a email prodejny'}</span>
            </div>
            <label className="settings-switch-toggle">
              <input
                type="checkbox"
                checked={config.receiptShowStoreContact !== false}
                onChange={e => handleUpdate({ receiptShowStoreContact: e.target.checked })}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>

          {config.receiptShowStoreContact !== false && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div className="settings-field">
                <label className="settings-label">{t('settings.receipt_phone_label') || 'Telefon na účtenku'}</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="+420 123 456 789"
                  value={config.receiptStorePhone || ''}
                  onChange={e => setConfig({ ...config, receiptStorePhone: e.target.value })}
                  onBlur={e => handleUpdate({ receiptStorePhone: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label className="settings-label">{t('settings.receipt_email_label') || 'Email na účtenku'}</label>
                <input
                  type="email"
                  className="settings-input"
                  placeholder="info@prodejna.cz"
                  value={config.receiptStoreEmail || ''}
                  onChange={e => setConfig({ ...config, receiptStoreEmail: e.target.value })}
                  onBlur={e => handleUpdate({ receiptStoreEmail: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="settings-toggle-row" style={{ paddingTop: '0.75rem' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">{t('settings.receipt_show_cashier') || 'Zobrazit jméno obsluhy / pokladního'}</span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_show_cashier_desc') || 'Vytiskne údaj o přihlášené obsluze'}</span>
            </div>
            <label className="settings-switch-toggle">
              <input
                type="checkbox"
                checked={config.receiptShowCashier !== false}
                onChange={e => handleUpdate({ receiptShowCashier: e.target.checked })}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>


          {/* Custom Header Announcement */}
          <div className="settings-field" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.5rem' }}>
            <label className="settings-label">
              {t('settings.receipt_custom_header') || 'Vlastní text v záhlaví dokladu'}
            </label>
            <input
              type="text"
              className="settings-input"
              placeholder={t('settings.receipt_custom_header_placeholder') || 'Např. Vítejte v naší prodejně! / Wi-Fi: host'}
              value={config.receiptCustomHeader || ''}
              onChange={e => setConfig({ ...config, receiptCustomHeader: e.target.value })}
              onBlur={e => handleUpdate({ receiptCustomHeader: e.target.value })}
            />
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
              {t('settings.receipt_custom_header_desc') || 'Zobrazí uvítání, oznámení nebo heslo na Wi-Fi pod údaji provozovny.'}
            </span>
          </div>
        </div>


        {/* 📦 Card 3: Položky Nákupu a DPH */}
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <FileText size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.receipt_items_title') || 'Položky Nákupu & Rekapitulace DPH'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.receipt_items_desc') || 'Hustota tisku položek a formát daňové rekapitulace.'}
              </p>
            </div>
          </div>

          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">{t('settings.receipt_item_density') || 'Hustota tisku položek'}</span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_item_density_desc') || 'Kompaktní režim šetří délku termopapíru'}</span>
            </div>
            <div className="settings-segmented-group">
              {[
                { id: 'standard', label: t('settings.receipt_density_standard') || 'Standardní' },
                { id: 'compact', label: t('settings.receipt_density_compact') || 'Kompaktní (Úsporný)' }
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptItemDensity || 'standard') === d.id ? 'active' : ''}`}
                  onClick={() => handleUpdate({ receiptItemDensity: d.id })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">{t('settings.receipt_show_item_sku') || 'Zobrazit čárový kód / SKU pod položkou'}</span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_show_item_sku_desc') || 'Vytiskne EAN nebo interní kód zboží'}</span>
            </div>
            <label className="settings-switch-toggle">
              <input
                type="checkbox"
                checked={Boolean(config.receiptShowItemSku)}
                onChange={e => handleUpdate({ receiptShowItemSku: e.target.checked })}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>

          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">
                {t('settings.receipt_show_item_vat') || 'Zobrazit sazbu DPH u každé položky'}
              </span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_show_item_vat_desc') || 'Vytiskne např. „DPH 12%“ pod názvem zboží'}</span>
            </div>
            <label className="settings-switch-toggle">
              <input
                type="checkbox"
                checked={config.receiptShowItemVat !== false}
                onChange={e => handleUpdate({ receiptShowItemVat: e.target.checked })}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>

          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">
                {t('settings.receipt_show_item_discount') || 'Zobrazit procentuální slevu u položky'}
              </span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_show_item_discount_desc') || 'Vytiskne např. „(-10%)“ u zlevněného zboží'}</span>
            </div>
            <label className="settings-switch-toggle">
              <input
                type="checkbox"
                checked={config.receiptShowItemDiscount !== false}
                onChange={e => handleUpdate({ receiptShowItemDiscount: e.target.checked })}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>

          <div className="settings-field" style={{ marginTop: '0.85rem' }}>

            <label className="settings-label">
              {t('settings.receipt_tax_matrix_format') || 'Formát rekapitulace DPH'}
            </label>
            <div className="settings-segmented-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'detailed', label: t('settings.receipt_tax_detailed') || 'Podrobný (s brutto)' },
                { id: 'compact', label: t('settings.receipt_tax_compact') || 'Kompaktní (3 sloupce)' },
                { id: 'none', label: t('settings.receipt_tax_none') || 'Skrýt tabulku DPH' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptTaxMatrixStyle || 'detailed') === m.id ? 'active' : ''}`}
                  onClick={() => handleUpdate({ receiptTaxMatrixStyle: m.id })}
                  style={{ minHeight: '38px', fontSize: '0.78rem' }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 🖨️ Card 4: Okraje Papíru a Mechanika Tisku */}
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Printer size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.receipt_print_title') || 'Okraje Papíru & Kódování'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.receipt_print_desc') || 'Nastavení horního/dolního okraje, automatického tisku a české znakové sady.'}
              </p>
            </div>
          </div>

          {/* Margins */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
            <div className="settings-field">
              <label className="settings-label">{t('settings.receipt_top_margin') || 'Horní okraj (prázdné řádky)'}</label>
              <select
                className="settings-input"
                value={config.receiptTopMargin !== undefined ? config.receiptTopMargin : 1}
                onChange={e => handleUpdate({ receiptTopMargin: parseInt(e.target.value, 10) })}
              >
                {[0, 1, 2, 3, 4].map(n => {
                  let label = `${n} řádek`;
                  if (n === 0) label = t('settings.receipt_margin_0') || '0 řádků (Bez okraje)';
                  else if (n === 1) label = t('settings.receipt_margin_1') || '1 řádek';
                  else if (n < 5) label = t('settings.receipt_margin_few', { count: n }) || `${n} řádky`;
                  else label = t('settings.receipt_margin_many', { count: n }) || `${n} řádků`;
                  return <option key={n} value={n}>{label}</option>;
                })}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label">{t('settings.receipt_bottom_margin') || 'Dolní okraj před ořezem'}</label>
              <select
                className="settings-input"
                value={config.receiptBottomMargin !== undefined ? config.receiptBottomMargin : 3}
                onChange={e => handleUpdate({ receiptBottomMargin: parseInt(e.target.value, 10) })}
              >
                {[1, 2, 3, 4, 5, 6].map(n => {
                  let label = `${n} řádek před nožem`;
                  if (n === 1) label = t('settings.receipt_margin_cut_1') || '1 řádek před nožem';
                  else if (n < 5) label = t('settings.receipt_margin_cut_few', { count: n }) || `${n} řádky před nožem`;
                  else label = t('settings.receipt_margin_cut_many', { count: n }) || `${n} řádků před nožem`;
                  return <option key={n} value={n}>{label}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Copies */}
          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">{t('settings.receipt_copies_label') || 'Počet kopií účtenky'}</span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_copies_desc') || 'Možnost tisknout druhou kopii s označením pro obchodníka'}</span>
            </div>
            <div className="settings-segmented-group">
              {[
                { val: 1, label: t('settings.receipt_copies_1x') || '1x (Pro zákazníka)' },
                { val: 2, label: t('settings.receipt_copies_2x') || '2x (+ Kopie pro prodejce)' }
              ].map(c => (
                <button
                  key={c.val}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptCopies || 1) === c.val ? 'active' : ''}`}
                  onClick={() => handleUpdate({ receiptCopies: c.val })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto Print */}
          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">{t('settings.receipt_auto_print') || 'Okamžitý automatický tisk po zaplacení'}</span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_auto_print_desc') || 'Při dokončení platby ihned vytiskne účtenku bez dalších dotazů'}</span>
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

          {/* Czech Encoding & Diacritics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.85rem' }}>
            <div className="settings-field">
              <label className="settings-label">{t('settings.receipt_encoding_label') || 'Kódování češtiny (ESC/POS)'}</label>
              <select
                className="settings-input"
                value={config.receiptEncoding || 'CP852'}
                onChange={e => handleUpdate({ receiptEncoding: e.target.value })}
              >
                <option value="CP852">CP852 (Latin-2 Slavic)</option>
                <option value="CP1250">Windows-1250 (Střední Evropa)</option>
                <option value="UTF-8">UTF-8</option>
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label">{t('settings.receipt_strip_diacritics') || 'Odstranit diakritiku (Transliterace)'}</label>
              <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
                <label className="settings-switch-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(config.stripDiacritics)}
                    onChange={e => handleUpdate({ stripDiacritics: e.target.checked })}
                  />
                  <span className="settings-switch-slider" />
                </label>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginLeft: '0.65rem' }}>
                  {t('settings.receipt_strip_diacritics_desc') || 'Pro tiskárny bez české znakové sady'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 📱 Card 5: QR Kód a Patička Účtenky */}
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <QrCode size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.receipt_qr_footer_title') || 'QR Kód & Text Patičky'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.receipt_qr_footer_desc') || 'QR Platba pro bankovní převody a reklamační podmínky v patičce.'}
              </p>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">{t('settings.receipt_qr_type') || 'Tisk QR kódu na účtenku'}</label>
            <div className="settings-segmented-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'spayd', label: t('settings.receipt_qr_spayd') || 'QR Platba (Převod na účet)' },
                { id: 'url', label: t('settings.receipt_qr_url') || 'Webová URL / Odkaz' },
                { id: 'none', label: t('settings.receipt_qr_none') || 'Bez QR kódu' }
              ].map(q => (
                <button
                  key={q.id}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptQrCodeType || 'none') === q.id ? 'active' : ''}`}
                  onClick={() => handleUpdate({ receiptQrCodeType: q.id })}
                  style={{ minHeight: '38px', fontSize: '0.78rem' }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {config.receiptQrCodeType === 'url' && (
            <div className="settings-field" style={{ marginTop: '0.75rem' }}>
              <label className="settings-label">{t('settings.receipt_qr_url_label') || 'Cílová URL adresa pro QR kód'}</label>
              <input
                type="url"
                className="settings-input"
                placeholder="https://vasedomena.cz/recenze"
                value={config.receiptQrCodeUrl || ''}
                onChange={e => setConfig({ ...config, receiptQrCodeUrl: e.target.value })}
                onBlur={e => handleUpdate({ receiptQrCodeUrl: e.target.value })}
              />
            </div>
          )}

          {/* Multi-line Footer Lines */}
          <div className="settings-field" style={{ marginTop: '0.85rem' }}>
            <label className="settings-label">
              {t('settings.receipt_footer_lines_label') || 'Víceřádkový text v patičce účtenky'}
            </label>
            <textarea
              className="settings-input"
              rows={3}
              style={{ height: 'auto', padding: '0.6rem 0.8rem', resize: 'vertical', lineHeight: '1.4' }}
              value={config.receiptFooterLines !== undefined ? config.receiptFooterLines : (config.receiptFooter || 'Děkujeme za váš nákup!\nReklamace možná do 14 dnů s účtenkou.')}
              placeholder={t('settings.receipt_footer_placeholder') || 'Děkujeme za nákup!\nReklamace do 14 dnů s účtenkou.'}
              onChange={e => setConfig({ ...config, receiptFooterLines: e.target.value })}
              onBlur={e => handleUpdate({ receiptFooterLines: e.target.value })}
            />
          </div>

          <div className="settings-toggle-row" style={{ paddingTop: '0.75rem' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">{t('settings.receipt_show_branding') || 'Zobrazit označení pokladního systému v zápatí'}</span>
              <span className="settings-toggle-subtitle">{t('settings.receipt_branding_desc') || '"Vystaveno v pokladním systému VoltFlow POS"'}</span>
            </div>
            <label className="settings-switch-toggle">
              <input
                type="checkbox"
                checked={config.receiptShowBranding !== false}
                onChange={e => handleUpdate({ receiptShowBranding: e.target.checked })}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* 🧾 RIGHT COLUMN: Real-Time Live Thermal Preview & Print Test */}
      <div className="settings-grid-col">
        <div
          className="settings-section-card"
          style={{
            position: 'sticky',
            top: '1rem',
            maxHeight: 'calc(100dvh - 2rem)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Receipt size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.receipt_preview_title') || 'Živý Náhled Účtenky'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.receipt_preview_desc') || 'Přesná vizualizace s aktuálními oddělovači a písmeny.'}
              </p>
            </div>

            {/* Paper Width Quick Selector */}
            <div className="settings-segmented-group compact">
              {[
                { val: '80', label: '80 mm' },
                { val: '58', label: '58 mm' }
              ].map(w => (
                <button
                  key={w.val}
                  type="button"
                  className={`settings-segmented-btn compact ${(config.printerPaperWidth || '80') === w.val ? 'active' : ''}`}
                  onClick={() => handleUpdate({ printerPaperWidth: w.val })}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Test Print Action Button */}
          <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              className="pay-btn"
              onClick={handlePrintTest}
              disabled={testPrinting}
              style={{
                width: '100%',
                height: '44px',
                fontSize: '0.88rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, var(--accent-blue) 0%, #2563eb 100%)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Printer size={17} className={testPrinting ? 'spin-icon' : ''} />
              <span>{testPrinting ? (t('settings.receipt_print_sending') || 'Odesílám na tiskárnu...') : (t('settings.receipt_print_test_btn') || 'Vytisknout zkušební účtenku')}</span>
            </button>

            {testMessage && (
              <div style={{
                padding: '0.55rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: testMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: testMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                border: `1px solid ${testMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                <CheckCircle size={15} />
                <span>{testMessage.text}</span>
              </div>
            )}
          </div>

          {/* 🎛️ Interactive Preview Scenario Toolbar */}
          <div className="receipt-preview-toolbar">
            <div className="receipt-preview-row">
              <span className="receipt-preview-label">{t('settings.receipt_preview_mode') || 'Typ dokladu'}:</span>
              <div className="receipt-preview-chips">
                <button
                  type="button"
                  className={`receipt-preview-chip ${previewMode === 'sale' ? 'active' : ''}`}
                  onClick={() => setPreviewMode('sale')}
                >
                  {t('settings.receipt_preview_mode_normal') || 'Prodej (Běžný)'}
                </button>
                <button
                  type="button"
                  className={`receipt-preview-chip ${previewMode === 'refund' ? 'active-danger' : ''}`}
                  onClick={() => setPreviewMode('refund')}
                >
                  {t('settings.receipt_preview_mode_refund') || '↩️ Storno (Dobropis)'}
                </button>
              </div>
            </div>

            <div className="receipt-preview-row">
              <span className="receipt-preview-label">{t('settings.receipt_preview_payment') || 'Platba'}:</span>
              <div className="receipt-preview-chips">
                {[
                  { id: 'cash', label: t('settings.receipt_preview_pay_cash') || '💵 Hotovost' },
                  { id: 'card', label: t('settings.receipt_preview_pay_card') || '💳 Karta' },
                  { id: 'split', label: t('settings.receipt_preview_pay_split') || '🔀 Kombinovaná' },
                  { id: 'qr', label: t('settings.receipt_preview_pay_qr') || '📱 QR Platba' }
                ].map(pm => (
                  <button
                    key={pm.id}
                    type="button"
                    className={`receipt-preview-chip ${previewPayment === pm.id ? 'active' : ''}`}
                    onClick={() => setPreviewPayment(pm.id)}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="receipt-preview-row">
              <span className="receipt-preview-label">{t('settings.receipt_preview_sim_label') || 'Simulace:'}</span>
              <div className="receipt-preview-chips">
                <button
                  type="button"
                  className={`receipt-preview-chip ${previewEet ? 'active' : ''}`}
                  onClick={() => setPreviewEet(prev => !prev)}
                  title={t('settings.receipt_preview_eet_title') || 'Simulovat tisk EET kódů (FIK a BKP)'}
                >
                  {t('settings.receipt_preview_eet') || '🏛️ EET kód'}
                </button>
                <button
                  type="button"
                  className={`receipt-preview-chip ${previewQrDemo ? 'active' : ''}`}
                  onClick={() => setPreviewQrDemo(prev => !prev)}
                  title={t('settings.receipt_preview_qr_title') || 'Ukázat vzorový QR kód i bez vyplněného bankovního IBAN'}
                >
                  {t('settings.receipt_preview_qr_demo') || '🔲 Demo QR'}
                </button>
                {config.receiptCopies == 2 && (
                  <>
                    <button
                      type="button"
                      className={`receipt-preview-chip ${previewCopy === 1 ? 'active' : ''}`}
                      onClick={() => setPreviewCopy(1)}
                    >
                      {t('settings.receipt_preview_copy_1') || '👤 Kopie 1/2'}
                    </button>
                    <button
                      type="button"
                      className={`receipt-preview-chip ${previewCopy === 2 ? 'active' : ''}`}
                      onClick={() => setPreviewCopy(2)}
                    >
                      {t('settings.receipt_preview_copy_2') || '🏢 Kopie 2/2'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Thermal Paper Container: adapts dynamically to full receipt length */}
          <div style={{
            background: 'var(--bg-main, #f1f5f9)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem 1rem 2rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid var(--border-color)',
            minHeight: '440px',
            flex: 1
          }}>
            <ReceiptPreviewPaper
              saleData={currentSampleSale}
              storeConfig={config}
              resolvedItems={sampleItems}
              is58mm={is58mm}
              copyIndex={previewCopy}
              forceQrDemo={previewQrDemo}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
