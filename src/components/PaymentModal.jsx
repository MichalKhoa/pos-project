import React, { useState, useEffect, useRef } from 'react';
import { Banknote, CreditCard, QrCode, Split, Building2, Search } from 'lucide-react';
import CashDrawerIcon from './CashDrawerIcon';
import { fetchTerminalConfig, payWithTerminal, broadcastCustomerDisplay, lookupAres } from '../api/posApi';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { soundFx } from '../utils/audio.js';
import { createBurstTracker } from '../utils/scanBurst.js';
import CashPaymentPanel from './payment/CashPaymentPanel.jsx';
import CardPaymentPanel from './payment/CardPaymentPanel.jsx';
import QrPaymentPanel from './payment/QrPaymentPanel.jsx';
import SplitPaymentPanel from './payment/SplitPaymentPanel.jsx';

// Largest amount the numpad or banknote buttons can build (6 digits). A scanned barcode must never become money.
const MAX_TENDERED = 999999;

export default function PaymentModal({
  method,
  initialMethod,
  totalAmount,
  storeConfig,
  onClose,
  onCompleteSale,
  onOpenCashDrawer = null
}) {
  const { t } = useTranslation();
  const [tenderedStr, setTenderedStr] = useState('0');
  const [activeMethod, setActiveMethod] = useState(initialMethod || method || 'cash');

  // B2B Invoicing state (§ 28 ZDPH > 10 000 CZK)
  const [isB2B, setIsB2B] = useState(false);
  const [customerIco, setCustomerIco] = useState('');
  const [customerDic, setCustomerDic] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isAresLoading, setIsAresLoading] = useState(false);
  const [aresStatus, setAresStatus] = useState(null);

  const handleAresLookup = async () => {
    const cleanIco = customerIco.trim();
    if (!cleanIco) {
      setAresStatus({ type: 'error', text: 'Zadejte IČO pro vyhledání v ARES.' });
      return;
    }
    setIsAresLoading(true);
    setAresStatus(null);
    try {
      const data = await lookupAres(cleanIco);
      if (data) {
        if (data.obchodni_jmeno) setCustomerName(data.obchodni_jmeno);
        if (data.dic) setCustomerDic(data.dic);
        if (data.full_address) setCustomerAddress(data.full_address);
        setAresStatus({
          type: 'success',
          text: `Ověřeno v ARES: ${data.obchodni_jmeno}${data.platce_dph ? ' (Plátce DPH)' : ''}`
        });
      }
    } catch (err) {
      setAresStatus({
        type: 'error',
        text: `ARES: ${err.message || 'Subjekt nenalezen. Zadejte údaje ručně.'}`
      });
    } finally {
      setIsAresLoading(false);
    }
  };

  // Terminal state
  const [termConfig, setTermConfig] = useState(null);
  const [termLoading, setTermLoading] = useState(false);
  const [termResult, setTermResult] = useState(null);

  // F-005: while a charge runs or the sale is being handed over, the modal must not close or change method
  const [completing, setCompleting] = useState(false);
  const isBusy = termLoading || completing;

  // F-022: a card sale without terminal approval needs the cashier to confirm the terminal approved it
  const [confirmOptions, setConfirmOptions] = useState(null);

  // F-002: keys that arrive like a barcode scanner never reach the amount fields
  const [scanWarning, setScanWarning] = useState(false);
  const burstRef = useRef(null);
  if (!burstRef.current) burstRef.current = createBurstTracker();
  const snapshotRef = useRef(null);
  const completeRef = useRef(null);

  useEffect(() => {
    if (!scanWarning) return undefined;
    soundFx.playErrorChime();
    const timer = setTimeout(() => setScanWarning(false), 4000);
    return () => clearTimeout(timer);
  }, [scanWarning]);

  useEffect(() => {
    fetchTerminalConfig().then(cfg => {
      if (cfg) setTermConfig(cfg);
    });
  }, []);

  // Broadcast PAYMENT_PENDING on mount and method change
  useEffect(() => {
    broadcastCustomerDisplay({
      type: 'PAYMENT_PENDING',
      totalAmount
    });
  }, [totalAmount]);

  useEffect(() => {
    if (activeMethod === 'qr') {
      const vs = `${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;
      const rawIban = (storeConfig?.bankAccountIban || storeConfig?.bank_account_iban || storeConfig?.merchant_iban || '').replace(/\s/g, '').toUpperCase();
      const iban = (rawIban && rawIban !== 'CZ6508000000001234567890') ? rawIban : '';
      broadcastCustomerDisplay({
        type: 'PAYMENT_PENDING',
        totalAmount,
        payment: {
          method: 'QR_CODE',
          vs,
          iban
        }
      });
    }
  }, [activeMethod, totalAmount, storeConfig]);

  // Split payment state
  const [splitCashStr, setSplitCashStr] = useState('0');
  const [splitStep, setSplitStep] = useState(1);

  const isRefund = totalAmount < 0;
  const absTotal = Math.abs(totalAmount);
  const effectiveCashTotal = Math.round(absTotal);

  useEffect(() => {
    setTenderedStr(isRefund ? Math.round(Math.abs(totalAmount)).toString() : '0');
    setSplitCashStr('0');
    setSplitStep(1);
  }, [totalAmount, isRefund]);

  const tenderedVal = parseFloat(tenderedStr) || 0;
  const changeDue = isRefund ? 0 : (activeMethod === 'cash' ? (tenderedVal - effectiveCashTotal) : (tenderedVal - totalAmount));

  const splitCashVal = parseFloat(splitCashStr) || 0;
  const splitCardVal = Math.max(0, absTotal - splitCashVal);

  const handleCashAdd = (val) => {
    if (val === 'exact') {
      setTenderedStr(effectiveCashTotal.toString());
      return;
    }
    if (val === 'clear') {
      setTenderedStr('0');
      return;
    }

    const current = parseFloat(tenderedStr) || 0;
    const next = current === 0 ? val : current + val;
    setTenderedStr(Math.min(next, MAX_TENDERED).toString());
  };

  const handleCashSet = (val) => {
    setTenderedStr(val.toString());
  };

  const handleNumpadKey = (digit) => {
    if (digit === 'CLEAR') {
      setTenderedStr('0');
      return;
    }
    if (digit === 'BACK') {
      setTenderedStr(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      return;
    }
    if (digit === '.' || digit === ',') {
      if (tenderedStr.includes('.')) return;
      setTenderedStr(prev => prev + '.');
      return;
    }

    setTenderedStr(prev => {
      if (prev === '0') return digit;
      return prev.replace('.', '').length >= 6 ? prev : prev + digit;
    });
  };

  const handleSplitNumpadKey = (digit) => {
    if (digit === 'CLEAR') {
      setSplitCashStr('0');
      return;
    }
    if (digit === 'BACK') {
      setSplitCashStr(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      return;
    }
    if (digit === '.' || digit === ',') {
      if (splitCashStr.includes('.')) return;
      setSplitCashStr(prev => prev + '.');
      return;
    }

    setSplitCashStr(prev => {
      if (prev === '0' || prev === '') return digit;
      return prev.replace('.', '').length >= 6 ? prev : prev + digit;
    });
  };

  // Keyboard listener for physical numpad
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (burstRef.current.onEnter()) {
          setScanWarning(true);
          return;
        }
        if (isBusy || confirmOptions) return;
        // Enter finishes cash only with an explicit amount; card, QR and split never finish on Enter
        if (activeMethod === 'cash' && tenderedVal > 0 && changeDue >= 0) handleComplete();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmOptions) setConfirmOptions(null);
        else if (!isBusy) onClose();
        return;
      }

      const isChar = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;
      if (isChar && burstRef.current.onChar()) {
        // Second key of a burst: this is a scanner. Undo the first key it already typed.
        if (snapshotRef.current) {
          setTenderedStr(snapshotRef.current.tendered);
          setSplitCashStr(snapshotRef.current.split);
          snapshotRef.current = null;
        }
        setScanWarning(true);
        return;
      }
      if (isBusy || confirmOptions) return;
      if (isChar) snapshotRef.current = { tendered: tenderedStr, split: splitCashStr };

      if (activeMethod === 'cash') {
        if (/^[0-9]$/.test(e.key)) handleNumpadKey(e.key);
        else if (e.key === 'Backspace') handleNumpadKey('BACK');
        else if (e.key.toLowerCase() === 'c') handleNumpadKey('CLEAR');
      } else if (activeMethod === 'split') {
        if (/^[0-9]$/.test(e.key)) handleSplitNumpadKey(e.key);
        else if (e.key === 'Backspace') handleSplitNumpadKey('BACK');
        else if (e.key.toLowerCase() === 'c') handleSplitNumpadKey('CLEAR');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMethod, tenderedStr, tenderedVal, splitCashStr, changeDue, totalAmount, effectiveCashTotal, isBusy, confirmOptions, onClose]);

  const getB2bPayload = () => {
    if (!isB2B) return { isInvoice: false, is_invoice: false };
    return {
      isInvoice: true,
      is_invoice: true,
      customerIco: customerIco.trim() || null,
      customer_ico: customerIco.trim() || null,
      customerDic: customerDic.trim() || null,
      customer_dic: customerDic.trim() || null,
      customerName: customerName.trim() || null,
      customer_name: customerName.trim() || null,
      customerAddress: customerAddress.trim() || null,
      customer_address: customerAddress.trim() || null
    };
  };

  const handleComplete = (options = {}, term = termResult) => {
    const printReceipt = typeof options === 'boolean' ? options : (options?.printReceipt !== false);
    const b2bData = getB2bPayload();

    if (activeMethod === 'cash') {
      if (tenderedVal > 0 && changeDue < 0) return;
      const finalTendered = tenderedVal === 0 ? effectiveCashTotal : tenderedVal;
      const finalChange = tenderedVal === 0 ? 0 : (changeDue > 0 ? changeDue : 0);
      onCompleteSale({
        method: 'cash',
        paymentMethod: 'cash',
        tendered: finalTendered,
        tenderedAmount: finalTendered,
        change: finalChange,
        changeDue: finalChange,
        printReceipt,
        ...b2bData
      });
      return;
    }

    let payDetails = {
      method: activeMethod,
      paymentMethod: activeMethod,
      tendered: totalAmount,
      tenderedAmount: totalAmount,
      change: 0,
      changeDue: 0,
      printReceipt,
      ...b2bData
    };

    if (activeMethod === 'split') {
      payDetails.splitDetails = {
        cash: splitCashVal,
        card: splitCardVal
      };
    }

    if (term && term.success) {
      payDetails.cardAuthCode = term.auth_code;
      payDetails.cardMask = term.card_mask;
    }

    onCompleteSale(payDetails);
  };
  completeRef.current = handleComplete;

  const needsManualCardConfirm =
    (activeMethod === 'card' || (activeMethod === 'split' && splitCardVal > 0)) && !termResult?.success;

  // Every panel finishes through here
  const requestComplete = (options = {}) => {
    if (isBusy) return;
    if (needsManualCardConfirm) {
      setConfirmOptions(options);
      return;
    }
    handleComplete(options);
  };

  const handleTerminalPay = async () => {
    setTermLoading(true);
    setTermResult(null);

    const chargeAmount = activeMethod === 'split' ? splitCardVal : totalAmount;
    const res = await payWithTerminal(chargeAmount);
    setTermResult(res);
    if (res?.success) {
      // Stay locked until the sale is handed over; the register closes this modal
      setCompleting(true);
      try {
        completeRef.current({ printReceipt: true }, res);
      } catch (err) {
        // The handoff failed: unlock so the cashier is not stuck, and say so
        setCompleting(false);
        setTermResult({ ...res, success: false, message: err?.message || 'Error' });
      }
    }
    setTermLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={() => { if (!isBusy) onClose(); }}>
      <div
        className="modal-card modal-widescreen"
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '0.85rem 1.25rem' }}>
          <div className="modal-title" style={{ fontSize: '1.2rem', fontWeight: '800' }}>
            {isRefund ? t('payment.refund_title') : t('payment.title')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {onOpenCashDrawer && (
              <button
                type="button"
                className="payment-modal-drawer-btn"
                onClick={() => {
                  soundFx.playCashChime();
                  onOpenCashDrawer();
                }}
                title={t('cart.open_drawer') || 'Otevřít zásuvku'}
              >
                <CashDrawerIcon size={16} />
                <span>{t('cart.open_drawer') || 'Otevřít zásuvku'}</span>
              </button>
            )}
            <button type="button" className="close-modal-btn" disabled={isBusy} onClick={onClose}>✕</button>
          </div>
        </div>

        {scanWarning && (
          <div
            role="alert"
            style={{
              padding: '0.55rem 1.25rem',
              background: 'rgba(225, 29, 72, 0.14)',
              borderBottom: '1px solid rgba(225, 29, 72, 0.4)',
              color: 'var(--accent-rose)',
              fontWeight: 800,
              fontSize: '0.9rem'
            }}
          >
            {t('payment.scan_blocked')}
          </div>
        )}

        {/* Top Horizontal Segmented Tender Bar */}
        <div className="payment-top-bar">
          <div className="payment-method-nav">
            <button
              type="button"
              className={`payment-nav-tab ${activeMethod === 'cash' ? 'active-cash' : ''}`}
              disabled={isBusy}
              onClick={() => setActiveMethod('cash')}
            >
              <Banknote size={18} />
              <span>{t('payment.cash')}</span>
            </button>

            <button
              type="button"
              className={`payment-nav-tab ${activeMethod === 'card' ? 'active-card' : ''}`}
              disabled={isBusy}
              onClick={() => setActiveMethod('card')}
            >
              <CreditCard size={18} />
              <span>{t('payment.card')}</span>
            </button>

            <button
              type="button"
              className={`payment-nav-tab ${activeMethod === 'qr' ? 'active-qr' : ''}`}
              disabled={isBusy}
              onClick={() => setActiveMethod('qr')}
            >
              <QrCode size={18} />
              <span>{t('payment.qr')}</span>
            </button>

            <button
              type="button"
              className={`payment-nav-tab ${activeMethod === 'split' ? 'active-split' : ''}`}
              disabled={isBusy}
              onClick={() => setActiveMethod('split')}
            >
              <Split size={18} />
              <span>{t('payment.split')}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="payment-hero-label">{t('payment.total_due')}:</span>
            <span className="payment-hero-amount" style={{ color: activeMethod === 'cash' ? 'var(--accent-emerald)' : 'var(--accent-blue)' }}>
              {totalAmount.toFixed(2)} Kč
            </span>
          </div>
        </div>

        {/* B2B Invoicing Banner & Drawer (§ 28 ZDPH) */}
        <div style={{
          padding: '0.6rem 1.25rem',
          background: isB2B ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setIsB2B(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isB2B ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                  background: isB2B ? 'var(--accent-blue)' : 'var(--bg-card)',
                  color: isB2B ? '#fff' : 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  minHeight: '40px'
                }}
              >
                <Building2 size={16} />
                <span>{isB2B ? '✓ Firemní faktura (B2B)' : '+ Firemní faktura (B2B)'}</span>
              </button>

              {totalAmount > 10000 && !isB2B && (
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-amber)', fontWeight: 600 }}>
                  ⚠️ Nad 10 000 Kč (§ 28 ZDPH doporučuje daňový doklad s IČO)
                </span>
              )}
            </div>

            {isB2B && customerName && (
              <span style={{ fontSize: '0.82rem', color: 'var(--accent-blue)', fontWeight: 700 }}>
                {customerName} {customerIco ? `(IČO: ${customerIco})` : ''}
              </span>
            )}
          </div>

          {/* Expandable B2B Details Form */}
          {isB2B && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.6rem',
              background: 'var(--bg-card)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              {/* ICO + ARES */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>
                  IČO Odběratele
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={customerIco}
                    maxLength={10}
                    onChange={e => setCustomerIco(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAresLookup();
                      }
                    }}
                    placeholder="12345678"
                    style={{
                      flex: 1,
                      height: '40px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.65rem',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAresLookup}
                    disabled={isAresLoading || !customerIco.trim()}
                    style={{
                      height: '40px',
                      padding: '0 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-blue)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: (isAresLoading || !customerIco.trim()) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Search size={14} />
                    <span>{isAresLoading ? '...' : 'ARES'}</span>
                  </button>
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Název firmy / Jméno
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Firma s.r.o."
                  style={{
                    width: '100%',
                    height: '40px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 0.65rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* DIC */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>
                  DIČ (volitelné)
                </label>
                <input
                  type="text"
                  value={customerDic}
                  onChange={e => setCustomerDic(e.target.value)}
                  placeholder="CZ12345678"
                  style={{
                    width: '100%',
                    height: '40px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 0.65rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Address */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Sídlo / Adresa odběratele
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  placeholder="Ulice 1, 110 00 Praha"
                  style={{
                    width: '100%',
                    height: '40px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 0.65rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {aresStatus && (
                <div style={{
                  gridColumn: '1 / -1',
                  fontSize: '0.78rem',
                  color: aresStatus.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  fontWeight: 600
                }}>
                  {aresStatus.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Main Content Area */}
        <div className="modal-body payment-widescreen-body">
          <div className="payment-main-content">
            {activeMethod === 'cash' && (
              <CashPaymentPanel
                tenderedStr={tenderedStr}
                tenderedVal={tenderedVal}
                effectiveCashTotal={effectiveCashTotal}
                totalAmount={totalAmount}
                changeDue={changeDue}
                onCashAdd={handleCashAdd}
                onCashSet={handleCashSet}
                onNumpadKey={handleNumpadKey}
                onComplete={requestComplete}
              />
            )}

            {activeMethod === 'split' && (
              <SplitPaymentPanel
                splitStep={splitStep}
                setSplitStep={setSplitStep}
                splitCashStr={splitCashStr}
                setSplitCashStr={setSplitCashStr}
                splitCashVal={splitCashVal}
                splitCardVal={splitCardVal}
                totalAmount={totalAmount}
                termConfig={termConfig}
                termLoading={termLoading}
                termResult={termResult}
                onSplitNumpadKey={handleSplitNumpadKey}
                onTerminalPay={handleTerminalPay}
                onComplete={requestComplete}
              />
            )}

            {activeMethod === 'card' && (
              <CardPaymentPanel
                totalAmount={totalAmount}
                termConfig={termConfig}
                termLoading={termLoading}
                termResult={termResult}
                onTerminalPay={handleTerminalPay}
                onComplete={requestComplete}
              />
            )}

            {activeMethod === 'qr' && (
              <QrPaymentPanel
                totalAmount={totalAmount}
                storeConfig={storeConfig}
                onComplete={requestComplete}
              />
            )}
          </div>
        </div>

        {confirmOptions && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.6)'
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="manual-card-confirm-text"
              style={{
                width: 'min(92%, 460px)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                border: '2px solid var(--accent-blue)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.1rem',
                textAlign: 'center'
              }}
            >
              <div id="manual-card-confirm-text" style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {t('payment.manual_card_confirm', {
                  amount: Math.abs(activeMethod === 'split' ? splitCardVal : totalAmount).toFixed(2)
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="pay-btn"
                  style={{ flex: 1, height: '64px', fontSize: '1.05rem', fontWeight: 800, background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                  onClick={() => setConfirmOptions(null)}
                >
                  {t('payment.manual_card_no')}
                </button>
                <button
                  type="button"
                  className="pay-btn pay-btn-card"
                  style={{ flex: 2, height: '64px', fontSize: '1.15rem', fontWeight: 900 }}
                  onClick={() => {
                    const options = confirmOptions;
                    setConfirmOptions(null);
                    handleComplete(options);
                  }}
                >
                  {t('payment.manual_card_yes')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
