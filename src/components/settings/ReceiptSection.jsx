import React, { useState } from 'react';
import {
  Receipt,
  FileText,
  AlignLeft,
  QrCode,
  Printer,
  CheckCircle,
  Scissors
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

  const handleUpdate = (updates) => {
    if (saveConfigBatch) {
      saveConfigBatch(updates);
    } else {
      const updated = { ...config, ...updates };
      setConfig(updated);
    }
  };

  const sampleSale = {
    id: 'DEMO-SALE',
    receiptNumber: '2026-0042',
    timestamp: new Date().toISOString(),
    paymentMethod: 'cash',
    totalAmount: 185.00,
    tenderedAmount: 200.00,
    changeDue: 15.00,
    cashier: 'Tereza N.',
    taxSummary: {
      '12': { rate: 12, net: 58.04, tax: 6.96, gross: 65.00 },
      '21': { rate: 21, net: 99.17, tax: 20.83, gross: 120.00 }
    }
  };

  const sampleItems = [
    { id: '1', name: 'Čerstvý chléb Šumava', price: 42.00, quantity: 1, vat: 12, barcode: '859400123' },
    { id: '2', name: 'Mléko polotučné 1.5% 1L', price: 23.00, quantity: 1, vat: 12, barcode: '859400456' },
    { id: '3', name: 'Káva Espresso Zrnková 250g', price: 120.00, quantity: 1, vat: 21, barcode: '859400789', discountPercent: 10 }
  ];

  const handlePrintTest = async () => {
    setTestPrinting(true);
    setTestMessage(null);
    soundFx.playKeypadClick();
    try {
      const res = await printReceiptBackend({
        ...sampleSale,
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
                { id: 'dashed', label: 'Čárkovaný (- - -)' },
                { id: 'double', label: 'Dvojitý (===)' },
                { id: 'dotted', label: 'Tečkovaný (....)' },
                { id: 'solid', label: 'Plná čára (───)' },
                { id: 'stars', label: 'Hvězdičky (★ ★)' },
                { id: 'wavy', label: 'Vlnky (~ ~ ~)' }
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

          {/* Title Style */}
          <div className="settings-field" style={{ marginTop: '0.85rem' }}>
            <label className="settings-label">
              {t('settings.receipt_title_style') || 'Vzhled záhlaví dokladu'}
            </label>
            <div className="settings-segmented-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'banner', label: '══ Proužek ══' },
                { id: 'framed', label: '[ Rámeček ]' },
                { id: 'classic', label: 'Klasický s linkou' },
                { id: 'minimal', label: 'Jednoduchý bez rámu' }
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
                { key: 'receiptBoldStoreName', label: 'Tučný název prodejny', def: true },
                { key: 'receiptBoldItemNames', label: 'Tučné názvy prodaných položek', def: true },
                { key: 'receiptBoldPrices', label: 'Tučné částky a ceny položek', def: true },
                { key: 'receiptBoldTotal', label: 'Extra zvýrazněná celková částka k úhradě', def: true },
                { key: 'receiptBoldFooter', label: 'Tučné písmo v patičce účtenky', def: false }
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

          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">Daňový status prodejce na dokladu</span>
              <span className="settings-toggle-subtitle">Zobrazí označení plátce nebo neplátce DPH vedle IČO/DIČ</span>
            </div>
            <div className="settings-segmented-group">
              {[
                { id: 'payer', label: 'Plátce DPH' },
                { id: 'non_payer', label: 'Neplátce DPH' }
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
              <span className="settings-toggle-title">Zobrazit kontaktní údaje na účtence</span>
              <span className="settings-toggle-subtitle">Vytiskne telefonní číslo a email prodejny</span>
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
                <label className="settings-label">Telefon na účtenku</label>
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
                <label className="settings-label">Email na účtenku</label>
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
              <span className="settings-toggle-title">Zobrazit jméno obsluhy / pokladního</span>
              <span className="settings-toggle-subtitle">Vytiskne údaj o přihlášené obsluze</span>
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
              <span className="settings-toggle-title">Hustota tisku položek</span>
              <span className="settings-toggle-subtitle">Kompaktní režim šetří délku termopapíru</span>
            </div>
            <div className="settings-segmented-group">
              {[
                { id: 'standard', label: 'Standardní' },
                { id: 'compact', label: 'Kompaktní (Úsporný)' }
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
              <span className="settings-toggle-title">Zobrazit čárový kód / SKU pod položkou</span>
              <span className="settings-toggle-subtitle">Vytiskne EAN nebo interní kód zboží</span>
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

          <div className="settings-field" style={{ marginTop: '0.85rem' }}>
            <label className="settings-label">
              Formát rekapitulace DPH
            </label>
            <div className="settings-segmented-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'detailed', label: 'Podrobný (s brutto)' },
                { id: 'compact', label: 'Kompaktní (3 sloupce)' },
                { id: 'none', label: 'Skrýt tabulku DPH' }
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
              <label className="settings-label">Horní okraj (prázdné řádky)</label>
              <select
                className="settings-input"
                value={config.receiptTopMargin !== undefined ? config.receiptTopMargin : 1}
                onChange={e => handleUpdate({ receiptTopMargin: parseInt(e.target.value, 10) })}
              >
                {[0, 1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{n === 0 ? '0 řádků (Bez okraje)' : `${n} ${n === 1 ? 'řádek' : 'řádky'}`}</option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label">Dolní okraj před ořezem</label>
              <select
                className="settings-input"
                value={config.receiptBottomMargin !== undefined ? config.receiptBottomMargin : 3}
                onChange={e => handleUpdate({ receiptBottomMargin: parseInt(e.target.value, 10) })}
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{`${n} ${n === 1 ? 'řádek' : 'řádky'} před nožem`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Copies */}
          <div className="settings-toggle-row" style={{ borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">Počet kopií účtenky</span>
              <span className="settings-toggle-subtitle">Možnost tisknout druhou kopii s označením pro obchodníka</span>
            </div>
            <div className="settings-segmented-group">
              {[
                { val: 1, label: '1x (Pro zákazníka)' },
                { val: 2, label: '2x (+ Kopie pro prodejce)' }
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
              <span className="settings-toggle-title">Okamžitý automatický tisk po zaplacení</span>
              <span className="settings-toggle-subtitle">Při dokončení platby ihned vytiskne účtenku bez dalších dotazů</span>
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
              <label className="settings-label">Kódování češtiny (ESC/POS)</label>
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
              <label className="settings-label">Odstranit diakritiku (Transliterace)</label>
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
                  Pro tiskárny bez české znakové sady
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
            <label className="settings-label">Tisk QR kódu na účtenku</label>
            <div className="settings-segmented-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'spayd', label: 'QR Platba (Převod na účet)' },
                { id: 'url', label: 'Webová URL / Odkaz' },
                { id: 'none', label: 'Bez QR kódu' }
              ].map(q => (
                <button
                  key={q.id}
                  type="button"
                  className={`settings-segmented-btn ${(config.receiptQrCodeType || 'spayd') === q.id ? 'active' : ''}`}
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
              <label className="settings-label">Cílová URL adresa pro QR kód</label>
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
              Víceřádkový text v patičce účtenky
            </label>
            <textarea
              className="settings-input"
              rows={3}
              style={{ height: 'auto', padding: '0.6rem 0.8rem', resize: 'vertical', lineHeight: '1.4' }}
              value={config.receiptFooterLines !== undefined ? config.receiptFooterLines : (config.receiptFooter || 'Děkujeme za váš nákup!\nReklamace možná do 14 dnů s účtenkou.')}
              placeholder="Děkujeme za nákup!&#10;Reklamace do 14 dnů s účtenkou."
              onChange={e => setConfig({ ...config, receiptFooterLines: e.target.value })}
              onBlur={e => handleUpdate({ receiptFooterLines: e.target.value })}
            />
          </div>

          <div className="settings-toggle-row" style={{ paddingTop: '0.75rem' }}>
            <div className="settings-toggle-label-wrap">
              <span className="settings-toggle-title">Zobrazit označení pokladního systému v zápatí</span>
              <span className="settings-toggle-subtitle">"Vystaveno v pokladním systému VoltFlow POS"</span>
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
            <div className="settings-segmented-group" style={{ height: '34px' }}>
              {[
                { val: '80', label: '80 mm' },
                { val: '58', label: '58 mm' }
              ].map(w => (
                <button
                  key={w.val}
                  type="button"
                  className={`settings-segmented-btn ${(config.printerPaperWidth || '80') === w.val ? 'active' : ''}`}
                  onClick={() => handleUpdate({ printerPaperWidth: w.val })}
                  style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.78rem' }}
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
              <span>{testPrinting ? 'Odesílám na tiskárnu...' : 'Vytisknout zkušební účtenku'}</span>
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
              saleData={sampleSale}
              storeConfig={config}
              resolvedItems={sampleItems}
              is58mm={is58mm}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
