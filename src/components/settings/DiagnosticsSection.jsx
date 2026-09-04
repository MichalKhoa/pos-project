import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  CheckCircle2,
  Clock,
  HardDrive,
  CreditCard,
  Tv,
  ShieldCheck,
  RefreshCw,
  Coins,
  Receipt
} from 'lucide-react';
import { generateQrDataUrl } from '../../utils/qrCode.js';
import { soundFx } from '../../utils/audio.js';
import {
  openCashDrawerBackend,
  printReceiptBackend,
  printDailySummaryBackend,
  fetchShiftStats,
  fetchBackendRoot
} from '../../api/posApi.js';
import { useTauri } from '../../hooks/useTauri.js';

export default function DiagnosticsSection({
  config = {}
}) {
  // Diagnostics state
  const [latency, setLatency] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [restartingBackend, setRestartingBackend] = useState(false);
  const { isTauri, restartBackend } = useTauri();

  const handleRestartBackend = async () => {
    setRestartingBackend(true);
    setActionMessage(null);
    soundFx.playKeypadClick?.();
    try {
      const res = await restartBackend();
      if (res.success) {
        soundFx.playSuccessChime?.();
        setActionMessage({ type: 'success', text: 'Backend server byl restartován.' });
        setTimeout(() => checkHealth(), 1500);
      } else {
        soundFx.playErrorChime?.();
        setActionMessage({ type: 'error', text: res.error || 'Restart selhal.' });
      }
    } catch (err) {
      soundFx.playErrorChime?.();
      setActionMessage({ type: 'error', text: 'Chyba restartu: ' + err.message });
    } finally {
      setRestartingBackend(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const cleanIban = (config.bankAccountIban || 'CZ6508000000001234567890').replace(/\s/g, '').toUpperCase();
  const formattedIban = cleanIban.match(/.{1,4}/g)?.join(' ') || cleanIban;
  const qrSpdPayload = `SPD*1.0*ACC:${cleanIban}*AM:153.70*CC:CZK*X-VS:99001*MSG:Test Himmel POS`;
  const qrDataUrl = useMemo(() => generateQrDataUrl(qrSpdPayload, 180), [qrSpdPayload]);

  const checkHealth = async () => {
    setCheckingBackend(true);
    const start = performance.now();
    try {
      const res = await fetchBackendRoot();
      const end = performance.now();
      setBackendOnline(res.online);
      setLatency(Math.max(1, Math.round(end - start)));
    } catch {
      setBackendOnline(false);
      setLatency(null);
    }
    setCheckingBackend(false);

    try {
      const stats = await fetchShiftStats();
      if (stats) setShiftData(stats);
    } catch {
      // ignore in offline fallback
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleTestPrint = async () => {
    setPrintLoading(true);
    setActionMessage(null);
    soundFx.playKeypadClick();

    const sampleSale = {
      id: `TEST-${Date.now().toString().slice(-4)}`,
      receipt_number: `TST-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString(),
      payment_method: 'cash',
      total_amount: 153.70,
      tendered_amount: 200,
      change_amount: 46.30,
      items: [
        { name: 'Mléko plnotučné 1L (Test)', quantity: 1, unit_price: 28.90, total_price: 28.90, vat_rate: 12 },
        { name: 'Rohlík tukový (Test)', quantity: 2, unit_price: 2.90, total_price: 5.80, vat_rate: 12 },
        { name: 'Káva zrnková 250g (Test)', quantity: 1, unit_price: 119.00, total_price: 119.00, vat_rate: 21 }
      ],
      vat_breakdown: [
        { rate: 12, base: 30.98, vat: 3.72, total: 34.70 },
        { rate: 21, base: 98.35, vat: 20.65, total: 119.00 }
      ]
    };

    try {
      const res = await printReceiptBackend(sampleSale, config);
      soundFx.playSuccessChime();
      setActionMessage({ type: 'success', text: res.message || 'Zkušební účtenka vytištěna.' });
    } catch (err) {
      soundFx.playErrorChime?.();
      setActionMessage({ type: 'error', text: 'Tisk selhal: ' + (err.message || 'Neznámá chyba') });
    } finally {
      setPrintLoading(false);
      setTimeout(() => setActionMessage(null), 4500);
    }
  };

  const handleTestDrawer = async () => {
    setDrawerLoading(true);
    setActionMessage(null);
    try {
      const res = await openCashDrawerBackend();
      soundFx.playCashChime();
      setActionMessage({ type: 'success', text: res.message || 'Zásuvka byla otevřena.' });
    } catch (err) {
      soundFx.playErrorChime?.();
      setActionMessage({ type: 'error', text: 'Zásuvku se nepodařilo otevřít: ' + (err.message || 'Chyba spojení') });
    } finally {
      setDrawerLoading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handlePrintDailyReport = async () => {
    setSummaryLoading(true);
    setActionMessage(null);
    soundFx.playKeypadClick();
    try {
      const summaryPayload = shiftData || {
        date: new Date().toLocaleDateString('cs-CZ'),
        totalGross: 0,
        totalSales: 0,
        cashTotal: 0,
        cardTotal: 0,
        qrTotal: 0
      };
      const res = await printDailySummaryBackend(summaryPayload, config, false);
      soundFx.playSuccessChime();
      setActionMessage({ type: 'success', text: res.message || 'Denní uzávěrka vytištěna.' });
    } catch (err) {
      soundFx.playErrorChime?.();
      setActionMessage({ type: 'error', text: 'Tisk uzávěrky selhal: ' + err.message });
    } finally {
      setSummaryLoading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  return (
    <div className="settings-grid-layout">
      {/* 🧾 COLUMN 1: LIVE THERMAL RECEIPT PREVIEW */}
      <div className="settings-grid-col">
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Receipt size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>Živý náhled účtenky</span>
              </h3>
              <p className="settings-section-desc">
                Reálná vizualizace hlavičky, DPH a patičky podle aktuální konfigurace.
              </p>
            </div>
          </div>

          <div className="thermal-receipt-container">
            <div className="thermal-receipt-paper">
              {/* Receipt Header */}
              <div className="thermal-receipt-header">
                <div className="thermal-receipt-store-name">
                  {config.storeName || 'HIMMEL POS PRODEJNA'}
                </div>
                <div style={{ marginTop: '3px' }}>
                  {config.street || 'Hlavní 123'}
                </div>
                <div>
                  {config.city || '110 00 Praha 1'}
                </div>
                <div style={{ marginTop: '3px' }}>
                  IČO: {config.ico || '12345678'} • DIČ: {config.dic || 'CZ12345678'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: '4px' }}>
                  {new Date().toLocaleDateString('cs-CZ')} {new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })} • Pokl: {config.registerNo || '01'}
                </div>
              </div>

              <div style={{ textAlign: 'center', fontWeight: '800', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                BĚŽNÝ DAŇOVÝ DOKLAD #2026-TEST01
              </div>

              <div className="thermal-receipt-divider" />

              {/* Sample Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div className="thermal-receipt-row">
                  <span>1× Mléko plnotučné 1L</span>
                  <span>28,90 Kč</span>
                </div>
                <div className="thermal-receipt-row">
                  <span>2× Rohlík tukový</span>
                  <span>5,80 Kč</span>
                </div>
                <div className="thermal-receipt-row">
                  <span>1× Káva zrnková 250g</span>
                  <span>119,00 Kč</span>
                </div>
              </div>

              <div className="thermal-receipt-double-divider" />

              {/* Total & Payment */}
              <div className="thermal-receipt-row thermal-receipt-total">
                <span>CELKEM</span>
                <span>153,70 Kč</span>
              </div>
              <div className="thermal-receipt-row" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                <span>Platba: HOTOVOST</span>
                <span>Přijato: 200,00 Kč</span>
              </div>
              <div className="thermal-receipt-row" style={{ fontSize: '0.75rem' }}>
                <span>Vráceno:</span>
                <span>46,30 Kč</span>
              </div>

              <div className="thermal-receipt-divider" />

              {/* VAT Breakdown */}
              <div style={{ fontSize: '0.72rem', color: '#4b5563' }}>
                <div className="thermal-receipt-row">
                  <span>Sazba DPH</span>
                  <span>Základ</span>
                  <span>DPH</span>
                </div>
                <div className="thermal-receipt-row">
                  <span>12%</span>
                  <span>30,98 Kč</span>
                  <span>3,72 Kč</span>
                </div>
                <div className="thermal-receipt-row">
                  <span>21%</span>
                  <span>98,35 Kč</span>
                  <span>20,65 Kč</span>
                </div>
              </div>

              {/* QR Platba SPD */}
              {config.bankAccountIban && (
                <div className="thermal-receipt-qr-wrap">
                  <div className="thermal-receipt-divider" style={{ width: '100%' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: '800' }}>QR PLATBA PRO PŘEVOD</span>
                  <img
                    src={qrDataUrl}
                    alt="QR Platba SPD"
                    style={{ width: '110px', height: '110px', display: 'block' }}
                  />
                  <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>
                    {formattedIban}
                  </span>
                </div>
              )}

              {/* Receipt Footer */}
              <div className="thermal-receipt-footer">
                {config.receiptFooter || 'Děkujeme za váš nákup!'}
              </div>
            </div>

            {/* Test Triggers */}
            <div style={{ display: 'flex', gap: '0.65rem', width: '100%', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="settings-action-btn primary"
                style={{ flex: 1, minHeight: '44px', gap: '0.5rem' }}
                onClick={handleTestPrint}
                disabled={printLoading}
              >
                <Printer size={17} />
                <span>{printLoading ? 'Tisknu...' : 'Vytisknout test'}</span>
              </button>

              <button
                type="button"
                className="settings-action-btn secondary"
                style={{ flex: 1, minHeight: '44px', gap: '0.5rem' }}
                onClick={handleTestDrawer}
                disabled={drawerLoading}
              >
                <Coins size={17} />
                <span>{drawerLoading ? 'Otevírám...' : 'Test zásuvky'}</span>
              </button>
            </div>

            {actionMessage && (
              <div
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  textAlign: 'center',
                  background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: actionMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-red)',
                  border: `1px solid ${actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
                }}
              >
                {actionMessage.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🩺 COLUMN 2: HARDWARE & SYSTEM HEALTH */}
      <div className="settings-grid-col">
        {/* Subsystem Checklist */}
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <CheckCircle2 size={19} style={{ color: 'var(--accent-emerald)' }} />
                <span>Stav periferií & Diagnostika</span>
              </h3>
              <p className="settings-section-desc">
                Přehled všech připojených pokladních modulů a komunikačních kanálů.
              </p>
            </div>

            <button
              type="button"
              className="settings-action-btn secondary"
              style={{ minHeight: '38px', padding: '0 0.75rem', gap: '0.35rem', fontSize: '0.8rem' }}
              onClick={checkHealth}
              disabled={checkingBackend}
            >
              <RefreshCw size={14} className={checkingBackend ? 'spin-icon' : ''} />
              <span>Ověřit stav</span>
            </button>
          </div>

          <div className="diag-checklist">
            {/* 1. Backend REST API */}
            <div className="diag-item">
              <div className="diag-item-left">
                <div className="diag-item-icon">
                  <HardDrive size={18} style={{ color: backendOnline ? 'var(--accent-emerald)' : 'var(--accent-red)' }} />
                </div>
                <div className="diag-item-text">
                  <span className="diag-item-label">Python REST Backend</span>
                  <span className="diag-item-detail">
                    {backendOnline ? `FastAPI 3.10+ • port 8000 (${latency !== null ? `${latency} ms` : '< 1 ms'})` : 'Server nedostupný (simulace)'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isTauri && (
                  <button
                    type="button"
                    className="settings-action-btn"
                    style={{ padding: '3px 8px', fontSize: '0.75rem', minHeight: '28px', gap: '4px', whiteSpace: 'nowrap' }}
                    onClick={handleRestartBackend}
                    disabled={restartingBackend}
                    title="Restartovat backend proces"
                  >
                    <RefreshCw size={12} className={restartingBackend ? 'animate-spin' : ''} />
                    <span>{restartingBackend ? 'Restart...' : 'Restart'}</span>
                  </button>
                )}
                <span className={`diag-pill ${backendOnline ? 'diag-pill-success' : 'diag-pill-warning'}`}>
                  {backendOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* 2. ESC/POS Printer */}
            <div className="diag-item">
              <div className="diag-item-left">
                <div className="diag-item-icon">
                  <Printer size={18} style={{ color: 'var(--accent-blue)' }} />
                </div>
                <div className="diag-item-text">
                  <span className="diag-item-label">Pokladní tiskárna</span>
                  <span className="diag-item-detail">
                    {config.printerAddress || '/dev/usb/lp0'} • šířka {config.printerPaperWidth || '80'} mm ({config.printerInterface || 'USB'})
                  </span>
                </div>
              </div>
              <span className="diag-pill diag-pill-success">
                PŘIPOJENO
              </span>
            </div>

            {/* 3. Cash Drawer */}
            <div className="diag-item">
              <div className="diag-item-left">
                <div className="diag-item-icon">
                  <Coins size={18} style={{ color: 'var(--accent-amber)' }} />
                </div>
                <div className="diag-item-text">
                  <span className="diag-item-label">Pokladní zásuvka (RJ11)</span>
                  <span className="diag-item-detail">
                    Impuls 24V přes tiskárnu ESC/POS (pin 2/5)
                  </span>
                </div>
              </div>
              <span className="diag-pill diag-pill-success">
                PŘIPRAVENO
              </span>
            </div>

            {/* 4. Payment Terminal */}
            <div className="diag-item">
              <div className="diag-item-left">
                <div className="diag-item-icon">
                  <CreditCard size={18} style={{ color: 'var(--accent-purple)' }} />
                </div>
                <div className="diag-item-text">
                  <span className="diag-item-label">Platební terminál</span>
                  <span className="diag-item-detail">
                    {config.csobTerminalEnabled
                      ? `ČSOB / Ingenico (${config.csobTerminalIp || '192.168.1.X'}:${config.csobTerminalPort || '8888'})`
                      : 'Ruční zadávání částky (Doporučeno)'}
                  </span>
                </div>
              </div>
              <span className={`diag-pill ${config.csobTerminalEnabled ? 'diag-pill-success' : 'diag-pill-neutral'}`}>
                {config.csobTerminalEnabled ? 'ČSOB TCP' : 'RUČNÍ'}
              </span>
            </div>

            {/* 5. Customer Display */}
            <div className="diag-item">
              <div className="diag-item-left">
                <div className="diag-item-icon">
                  <Tv size={18} style={{ color: 'var(--accent-emerald)' }} />
                </div>
                <div className="diag-item-text">
                  <span className="diag-item-label">Zákaznický LCD displej</span>
                  <span className="diag-item-detail">
                    WebSocket kanál (/api/v1/ws/customer-display)
                  </span>
                </div>
              </div>
              <span className="diag-pill diag-pill-success">
                AKTIVNÍ
              </span>
            </div>

            {/* 6. EET 2.0 */}
            <div className="diag-item">
              <div className="diag-item-left">
                <div className="diag-item-icon">
                  <ShieldCheck size={18} style={{ color: config.eetEnabled ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
                </div>
                <div className="diag-item-text">
                  <span className="diag-item-label">Fiskální modul EET 2.0</span>
                  <span className="diag-item-detail">
                    {config.eetEnabled ? `Provozní režim: ${config.eetEnvironment || 'playground'}` : 'Vypnuto (dobrovolná fiskalizace)'}
                  </span>
                </div>
              </div>
              <span className={`diag-pill ${config.eetEnabled ? 'diag-pill-success' : 'diag-pill-neutral'}`}>
                {config.eetEnabled ? 'ZAPNUTO' : 'VYPNUTO'}
              </span>
            </div>
          </div>
        </div>

        {/* 📊 Mini-Card: Dnešní směna & Rychlá uzávěrka */}
        <div className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Clock size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>Denní přehled směny</span>
              </h3>
              <p className="settings-section-desc">
                Souhrn dnešních plateb a možnost vytisknout denní uzávěrku na tiskárnu.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                textAlign: 'center'
              }}
            >
              <div style={{ background: 'var(--bg-card)', padding: '0.85rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dnešní tržba</span>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {shiftData?.totalGross !== undefined ? `${shiftData.totalGross.toFixed(0)} Kč` : '0 Kč'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '0.85rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hotovost</span>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--accent-emerald)', marginTop: '2px' }}>
                  {shiftData?.cashTotal !== undefined ? `${shiftData.cashTotal.toFixed(0)} Kč` : '0 Kč'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '0.85rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Karta / QR</span>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--accent-purple)', marginTop: '2px' }}>
                  {shiftData ? `${((shiftData.cardTotal || 0) + (shiftData.qrTotal || 0)).toFixed(0)} Kč` : '0 Kč'}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="settings-action-btn primary"
              style={{ width: '100%', minHeight: '44px', gap: '0.5rem' }}
              onClick={handlePrintDailyReport}
              disabled={summaryLoading}
            >
              <Printer size={17} />
              <span>{summaryLoading ? 'Tisknu uzávěrku...' : 'Vytisknout denní uzávěrku'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
