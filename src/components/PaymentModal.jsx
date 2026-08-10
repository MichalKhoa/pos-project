import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, QrCode, CheckCircle2, Split, Coins, Delete, RotateCcw, Sparkles, RefreshCw, Wifi, Vault } from 'lucide-react';
import { fetchTerminalConfig, payWithTerminal, broadcastCustomerDisplay } from '../api/posApi';
import { useTranslation } from '../i18n/LanguageContext.jsx';

const COINS = [1, 2, 5, 10, 20, 50];
const BANKNOTES = [100, 200, 500, 1000, 2000, 5000];

export default function PaymentModal({
  method,
  totalAmount,
  storeConfig,
  onClose,
  onCompleteSale,
  onOpenCashDrawer = null
}) {
  const { t } = useTranslation();
  const [tenderedStr, setTenderedStr] = useState('0');
  const [activeMethod, setActiveMethod] = useState(method || 'cash');

  // Terminal state
  const [termConfig, setTermConfig] = useState(null);
  const [termLoading, setTermLoading] = useState(false);
  const [termResult, setTermResult] = useState(null);

  useEffect(() => {
    fetchTerminalConfig().then(cfg => {
      if (cfg) setTermConfig(cfg);
    });
  }, []);

  // Broadcast PAYMENT_PENDING as soon as payment modal opens (moved to payment)
  useEffect(() => {
    broadcastCustomerDisplay({
      type: 'PAYMENT_PENDING',
      totalAmount
    });
  }, [totalAmount]);

  // Broadcast display state when activeMethod changes
  useEffect(() => {
    if (activeMethod === 'qr') {
      const vs = `${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;
      const iban = storeConfig?.bankAccountIban || storeConfig?.bank_account_iban || storeConfig?.merchant_iban || 'CZ6508000000001234567890';
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

  useEffect(() => {
    setTenderedStr('0');
    setSplitCashStr('0');
    setSplitStep(1);
  }, [totalAmount]);

  const effectiveCashTotal = Math.round(totalAmount);
  const tenderedVal = parseFloat(tenderedStr) || 0;
  const changeDue = activeMethod === 'cash' ? (tenderedVal - effectiveCashTotal) : (tenderedVal - totalAmount);

  // Split payment amounts
  const splitCashVal = parseFloat(splitCashStr) || 0;
  const splitCardVal = Math.max(0, totalAmount - splitCashVal);

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
    if (current === 0) {
      setTenderedStr(val.toString());
    } else {
      setTenderedStr((current + val).toString());
    }
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

    setTenderedStr(prev => (prev === '0' ? digit : prev + digit));
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

    setSplitCashStr(prev => (prev === '0' || prev === '' ? digit : prev + digit));
  };

  // Keyboard listener for physical numpad
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeMethod === 'cash' && changeDue >= 0) handleComplete();
        if (activeMethod === 'split') handleComplete();
        return;
      }

      if (activeMethod === 'cash') {
        if (/^[0-9]$/.test(e.key)) handleNumpadKey(e.key);
        else if (e.key === 'Backspace') handleNumpadKey('BACK');
        else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') handleNumpadKey('CLEAR');
      } else if (activeMethod === 'split') {
        if (/^[0-9]$/.test(e.key)) handleSplitNumpadKey(e.key);
        else if (e.key === 'Backspace') handleSplitNumpadKey('BACK');
        else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') handleSplitNumpadKey('CLEAR');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMethod, tenderedStr, splitCashStr, changeDue, totalAmount]);

  const handleComplete = () => {
    if (activeMethod === 'cash' && changeDue < 0) return;

    // Broadcast success to customer display
    broadcastCustomerDisplay({
      type: 'PAYMENT_SUCCESS',
      totalAmount,
      payment: {
        method: activeMethod === 'qr' ? 'QR_CODE' : activeMethod,
        receiptNo: `2026-${Math.floor(100000 + Math.random() * 900000)}`
      }
    });

    if (activeMethod === 'split') {
      onCompleteSale({
        paymentMethod: 'split',
        splitDetails: {
          cash: splitCashVal,
          card: splitCardVal
        },
        tenderedAmount: totalAmount,
        changeDue: 0
      });
      return;
    }

    onCompleteSale({
      paymentMethod: activeMethod,
      tenderedAmount: activeMethod === 'cash' ? tenderedVal : totalAmount,
      changeDue: activeMethod === 'cash' ? Math.max(0, changeDue) : 0
    });
  };

  const handleTerminalPay = async () => {
    setTermLoading(true);
    setTermResult(null);
    const res = await payWithTerminal(totalAmount);
    setTermResult(res);
    setTermLoading(false);
    if (res?.success) {
      handleComplete();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card payment-widescreen-modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: (activeMethod === 'cash' || activeMethod === 'split') ? '980px' : '740px',
          width: '95%',
          transition: 'max-width 0.25s ease'
        }}
      >
        <div className="modal-header" style={{ padding: '1rem 1.25rem' }}>
          <div className="modal-title">
            {activeMethod === 'cash' ? <Banknote size={22} style={{ color: 'var(--accent-emerald)' }} /> : activeMethod === 'split' ? <Split size={22} style={{ color: 'var(--accent-purple)' }} /> : <CreditCard size={22} style={{ color: 'var(--accent-blue)' }} />}
            <span>{t('payment.title')}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        {/* Widescreen Layout: Left Vertical Sidebar + Main Content Area */}
        <div className="payment-widescreen-body">
          {/* LEFT SIDEBAR: Vertical Payment Tabs & Grand Total */}
          <div className="payment-sidebar">
            <div className="payment-vertical-tabs">
              <button
                type="button"
                className={`payment-vtab ${activeMethod === 'cash' ? 'active' : ''}`}
                onClick={() => setActiveMethod('cash')}
              >
                <div className="vtab-icon"><Banknote size={20} /></div>
                <div className="vtab-text">
                  <span className="vtab-title">{t('payment.cash')}</span>
                  <span className="vtab-sub">{t('payment.coins')} & {t('payment.banknotes')}</span>
                </div>
              </button>

              <button
                type="button"
                className={`payment-vtab ${activeMethod === 'card' ? 'active' : ''}`}
                onClick={() => setActiveMethod('card')}
              >
                <div className="vtab-icon"><CreditCard size={20} /></div>
                <div className="vtab-text">
                  <span className="vtab-title">{t('payment.card')}</span>
                  <span className="vtab-sub">Terminál / Contactless</span>
                </div>
              </button>

              <button
                type="button"
                className={`payment-vtab ${activeMethod === 'qr' ? 'active' : ''}`}
                onClick={() => setActiveMethod('qr')}
              >
                <div className="vtab-icon"><QrCode size={20} /></div>
                <div className="vtab-text">
                  <span className="vtab-title">{t('payment.qr')}</span>
                  <span className="vtab-sub">SPD Bank Transfer</span>
                </div>
              </button>

              <button
                type="button"
                className={`payment-vtab ${activeMethod === 'split' ? 'active' : ''}`}
                onClick={() => setActiveMethod('split')}
              >
                <div className="vtab-icon"><Split size={20} /></div>
                <div className="vtab-text">
                  <span className="vtab-title">{t('payment.split')}</span>
                  <span className="vtab-sub">{t('payment.cash')} + {t('payment.card')}</span>
                </div>
              </button>
            </div>

            {/* Grand Total Sidebar Card */}
            <div className="sidebar-total-card">
              <span className="sidebar-total-label">{t('payment.total_due')}</span>
              <span className="sidebar-total-amount">{totalAmount.toFixed(2)} Kč</span>
            </div>

            {/* Quick Cashier Drawer Release Button in Payment Modal */}
            {onOpenCashDrawer && (
              <button
                type="button"
                className="payment-modal-drawer-btn"
                onClick={onOpenCashDrawer}
                title={t('cart.open_drawer') || 'Otevřít zásuvku'}
              >
                <Vault size={16} style={{ flexShrink: 0 }} />
                <span>{t('cart.open_drawer') || 'Otevřít zásuvku'}</span>
              </button>
            )}
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="payment-main-content">
            {/* Hotovost (Cash Payment): Side-by-Side Widescreen Columns */}
            {activeMethod === 'cash' && (
              <div className="cash-payment-container">
                {/* COLUMN 1: Cash Received, Coins, Banknotes & Change Box */}
                <div className="cash-col-left">
                  {/* Cash Received Line */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Přijato od zákazníka
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCashAdd('clear')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <RotateCcw size={12} /> Vynulovat
                      </button>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '2.2rem',
                      fontWeight: '800',
                      color: tenderedVal >= totalAmount ? 'var(--accent-emerald)' : 'var(--text-primary)',
                      background: 'var(--bg-input)',
                      border: '1.5px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.5rem 1rem',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}>
                      {tenderedStr} Kč
                    </div>
                  </div>

                  {/* Quick Action Shortcuts: Exact Amount & Reset */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="cash-shortcut-btn"
                      style={{
                        flex: 2,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--accent-emerald)',
                        borderColor: 'rgba(16, 185, 129, 0.35)',
                        fontWeight: '800',
                        fontSize: '0.9rem',
                        padding: '0.65rem'
                      }}
                      onClick={() => handleCashAdd('exact')}
                    >
                      <Sparkles size={15} />
                      <span>{t('payment.exact')} ({effectiveCashTotal.toFixed(0)} Kč)</span>
                    </button>
                    <button
                      type="button"
                      className="cash-shortcut-btn"
                      style={{ flex: 1, padding: '0.65rem', fontSize: '0.85rem' }}
                      onClick={() => handleCashAdd('clear')}
                    >
                      <RotateCcw size={14} />
                      <span>{t('payment.reset')}</span>
                    </button>
                  </div>

                  {/* 🪙 COINS (Mince 3x2 Grid) */}
                  <div className="cash-category-box">
                    <div className="cash-category-title">
                      <Coins size={15} style={{ color: 'var(--accent-amber)' }} />
                      <span>{t('payment.coins')}</span>
                    </div>
                    <div className="coins-grid-lg">
                      {COINS.map(coin => (
                        <button
                          key={coin}
                          type="button"
                          className="coin-btn-lg"
                          onClick={() => handleCashAdd(coin)}
                        >
                          +{coin} Kč
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 💵 BANKNOTES (Bankovky 3x2 Grid) */}
                  <div className="cash-category-box">
                    <div className="cash-category-title">
                      <Banknote size={15} style={{ color: 'var(--accent-emerald)' }} />
                      <span>{t('payment.banknotes')}</span>
                    </div>
                    <div className="banknotes-grid-lg">
                      {BANKNOTES.map(note => (
                        <button
                          key={note}
                          type="button"
                          className="banknote-btn-lg"
                          onClick={() => handleCashAdd(note)}
                        >
                          {note} Kč
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Change Due Display Box */}
                  <div className="change-due-box" style={{
                    background: changeDue < 0 ? 'rgba(225, 29, 72, 0.1)' : 'rgba(5, 150, 105, 0.12)',
                    borderColor: changeDue < 0 ? 'rgba(225, 29, 72, 0.3)' : 'rgba(5, 150, 105, 0.35)',
                    padding: '0.85rem 1.1rem',
                    marginTop: 'auto'
                  }}>
                    <span className="change-label" style={{ color: changeDue < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontSize: '0.95rem' }}>
                      {changeDue < 0 ? `${t('payment.missing')}:` : `${t('payment.change_due')}:`}
                    </span>
                    <span className="change-amount" style={{ color: changeDue < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontSize: '1.75rem' }}>
                      {Math.abs(changeDue).toFixed(0)} Kč
                    </span>
                  </div>
                </div>

                {/* COLUMN 2: Touch Numpad & Big Completion Button */}
                <div className="cash-col-right">
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {t('payment.numpad_title')}:
                  </div>

                  {/* 4-Column Touch Numpad Grid */}
                  <div className="side-numpad-grid">
                    {['7', '8', '9'].map(n => (
                      <button key={n} type="button" className="side-num-btn" onClick={() => handleNumpadKey(n)}>{n}</button>
                    ))}
                    <button type="button" className="side-num-btn key-action" onClick={() => handleNumpadKey('BACK')} title="Backspace">
                      <Delete size={22} />
                    </button>

                    {['4', '5', '6'].map(n => (
                      <button key={n} type="button" className="side-num-btn" onClick={() => handleNumpadKey(n)}>{n}</button>
                    ))}
                    <button type="button" className="side-num-btn key-action" onClick={() => handleNumpadKey('CLEAR')} title={t('payment.reset')}>
                      C
                    </button>

                    {['1', '2', '3'].map(n => (
                      <button key={n} type="button" className="side-num-btn" onClick={() => handleNumpadKey(n)}>{n}</button>
                    ))}
                    <button type="button" className="side-num-btn" onClick={() => handleNumpadKey('.')}>,</button>

                    <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleNumpadKey('0')}>0</button>
                    <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleNumpadKey('00')}>00</button>
                  </div>

                  {/* Big Glowing Complete Sale Button */}
                  <button
                    className="pay-btn pay-btn-cash"
                    style={{ width: '100%', height: '64px', marginTop: 'auto', fontSize: '1.15rem', fontWeight: '800' }}
                    disabled={changeDue < 0}
                    onClick={handleComplete}
                  >
                    <CheckCircle2 size={24} />
                    <span>{t('payment.complete_sale')} ({effectiveCashTotal.toFixed(0)} Kč)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Kombinovaná (Split Payment): 2-Step Flow (Step 1: Cash input, Step 2: Card Terminal prompt) */}
            {activeMethod === 'split' && (
              splitStep === 1 ? (
                <div className="cash-payment-container">
                  {/* COLUMN 1: Cash Portion Inputs, Calculation & Shortcuts */}
                  <div className="cash-col-left" style={{ gap: '1rem' }}>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Split size={18} />
                      <span>{t('payment.split_title')}</span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        {t('payment.split_cash_portion')}
                      </label>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '2rem',
                        fontWeight: '800',
                        color: 'var(--accent-emerald)',
                        background: 'var(--bg-input)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.65rem 1rem',
                        textAlign: 'center'
                      }}>
                        {splitCashStr || '0'} Kč
                      </div>
                    </div>

                    {/* Real-time Card Remaining Calculation Box */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        {t('payment.split_card_remaining')}:
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
                        {splitCardVal.toFixed(2)} Kč
                      </span>
                    </div>

                    {/* Quick Ratio & Cash Shortcut Buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button type="button" className="vat-btn" style={{ padding: '0.65rem', fontWeight: '800' }} onClick={() => setSplitCashStr((totalAmount / 2).toFixed(2))}>50% / 50%</button>
                      <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('100')}>100 Kč</button>
                      <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('200')}>200 Kč</button>
                      <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('500')}>500 Kč</button>
                      <button type="button" className="vat-btn" style={{ padding: '0.65rem', color: 'var(--accent-rose)' }} onClick={() => setSplitCashStr('0')}>C ({t('payment.reset')})</button>
                    </div>
                  </div>

                  {/* COLUMN 2: Touch Numpad for Split Cash & Proceed/Complete Button */}
                  <div className="cash-col-right">
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t('payment.numpad_cash_portion')}:
                    </div>

                    {/* 4-Column Touch Numpad Grid */}
                    <div className="side-numpad-grid">
                      {['7', '8', '9'].map(n => (
                        <button key={n} type="button" className="side-num-btn" onClick={() => handleSplitNumpadKey(n)}>{n}</button>
                      ))}
                      <button type="button" className="side-num-btn key-action" onClick={() => handleSplitNumpadKey('BACK')} title="Backspace">
                        <Delete size={22} />
                      </button>

                      {['4', '5', '6'].map(n => (
                        <button key={n} type="button" className="side-num-btn" onClick={() => handleSplitNumpadKey(n)}>{n}</button>
                      ))}
                      <button type="button" className="side-num-btn key-action" onClick={() => handleSplitNumpadKey('CLEAR')} title={t('payment.reset')}>
                        C
                      </button>

                      {['1', '2', '3'].map(n => (
                        <button key={n} type="button" className="side-num-btn" onClick={() => handleSplitNumpadKey(n)}>{n}</button>
                      ))}
                      <button type="button" className="side-num-btn" onClick={() => handleSplitNumpadKey('.')}>,</button>

                      <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleSplitNumpadKey('0')}>0</button>
                      <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleSplitNumpadKey('00')}>00</button>
                    </div>

                    {/* Proceed to Card Step or Finish Cash Sale */}
                    {splitCardVal > 0 ? (
                      <button
                        className="pay-btn pay-btn-card"
                        style={{ width: '100%', height: '64px', marginTop: 'auto', fontSize: '1.05rem', fontWeight: '800' }}
                        onClick={() => setSplitStep(2)}
                      >
                        <CreditCard size={22} />
                        <span>{t('payment.proceed_to_card', { amount: splitCardVal.toFixed(2) })}</span>
                      </button>
                    ) : (
                      <button
                        className="pay-btn pay-btn-cash"
                        style={{ width: '100%', height: '64px', marginTop: 'auto', fontSize: '1.05rem', fontWeight: '800' }}
                        onClick={handleComplete}
                      >
                        <CheckCircle2 size={24} />
                        <span>{t('payment.complete_split')} ({totalAmount.toFixed(2)} Kč)</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Step 2: Card Terminal payment prompt for remaining splitCardVal amount */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      className="nav-tab"
                      onClick={() => setSplitStep(1)}
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', fontWeight: '700' }}
                    >
                      ← {t('payment.back_to_cash')}
                    </button>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                      {t('payment.cash')}: {splitCashVal.toFixed(2)} Kč | {t('payment.card')}: {splitCardVal.toFixed(2)} Kč
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <CreditCard size={56} style={{ color: 'var(--accent-blue)', marginBottom: '0.8rem' }} />
                    <div style={{ fontWeight: '800', fontSize: '1.3rem', marginBottom: '0.4rem' }}>{t('payment.card_instruction')}</div>
                    <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                      {t('payment.split_card_remaining')}: <strong>{splitCardVal.toFixed(2)} Kč</strong>
                    </div>

                    {/* ČSOB Terminal Status Banner for split card portion */}
                    <div style={{
                      marginTop: '1.25rem',
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: (termConfig?.enabled && termConfig?.ip) ? 'rgba(5, 150, 105, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      border: `1px solid ${(termConfig?.enabled && termConfig?.ip) ? 'rgba(5, 150, 105, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      textAlign: 'left',
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: (termConfig?.enabled && termConfig?.ip) ? 'var(--accent-emerald)' : 'var(--accent-blue)', marginBottom: '0.2rem' }}>
                        <Wifi size={16} />
                        <span>
                          {(termConfig?.enabled && termConfig?.ip)
                            ? `${t('payment.card_auto_title')} (${termConfig.ip}:${termConfig.port})`
                            : t('payment.card_manual_title')
                          }
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {(termConfig?.enabled && termConfig?.ip)
                          ? t('payment.card_auto_sub', { amount: splitCardVal.toFixed(2) })
                          : t('payment.card_manual_sub', { amount: splitCardVal.toFixed(2) })
                        }
                      </div>
                    </div>
                  </div>

                  {termResult && (
                    <div style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: termResult.success ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
                      border: `1px solid ${termResult.success ? 'rgba(5, 150, 105, 0.4)' : 'rgba(225, 29, 72, 0.4)'}`,
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ fontWeight: '800', color: termResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)', marginBottom: '0.2rem' }}>
                        {termResult.success ? `✓ ${t('payment.terminal_approved')}` : `✕ ${termResult.message}`}
                      </div>
                      {termResult.auth_code && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          Autorizační kód: {termResult.auth_code} | Karta: {termResult.card_mask}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {termConfig?.enabled && termConfig?.ip && (
                      <button
                        className="pay-btn pay-btn-card"
                        disabled={termLoading}
                        style={{ flex: 1, height: '62px', fontSize: '1.05rem', fontWeight: '800' }}
                        onClick={handleTerminalPay}
                      >
                        <RefreshCw size={20} className={termLoading ? 'spin' : ''} />
                        <span>{termLoading ? t('payment.sending_to_terminal') : t('payment.card_send_csob')}</span>
                      </button>
                    )}

                    <button
                      className="pay-btn pay-btn-card"
                      style={{
                        flex: 1,
                        height: '62px',
                        fontSize: '1.05rem',
                        fontWeight: '800',
                        background: (termConfig?.enabled && termConfig?.ip) ? 'var(--bg-card)' : 'var(--accent-blue)',
                        border: (termConfig?.enabled && termConfig?.ip) ? '1px solid var(--border-color)' : 'none'
                      }}
                      onClick={handleComplete}
                    >
                      <CheckCircle2 size={22} />
                      <span>{(termConfig?.enabled && termConfig?.ip) ? t('payment.card_manual_override') : `${t('payment.card_confirm_manual')} (${splitCardVal.toFixed(2)} Kč)`}</span>
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Card Payment Layout with CSOB Terminal Preparation Status */}
            {activeMethod === 'card' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', padding: '2.5rem 2rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <CreditCard size={64} style={{ color: 'var(--accent-blue)', marginBottom: '0.8rem' }} />
                  <div style={{ fontWeight: '800', fontSize: '1.4rem', marginBottom: '0.4rem' }}>{t('payment.card_instruction')}</div>
                  <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{t('payment.total_due')}: <strong>{totalAmount.toFixed(2)} Kč</strong></div>

                  {/* ČSOB Terminal Status Banner */}
                  <div style={{
                    marginTop: '1.25rem',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: (termConfig?.enabled && termConfig?.ip) ? 'rgba(5, 150, 105, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                    border: `1px solid ${(termConfig?.enabled && termConfig?.ip) ? 'rgba(5, 150, 105, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                    textAlign: 'left',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: (termConfig?.enabled && termConfig?.ip) ? 'var(--accent-emerald)' : 'var(--accent-blue)', marginBottom: '0.2rem' }}>
                      <Wifi size={16} />
                      <span>
                        {(termConfig?.enabled && termConfig?.ip)
                          ? `${t('payment.card_auto_title')} (${termConfig.ip}:${termConfig.port})`
                          : t('payment.card_manual_title')
                        }
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {(termConfig?.enabled && termConfig?.ip)
                        ? t('payment.card_auto_sub', { amount: totalAmount.toFixed(2) })
                        : t('payment.card_manual_sub', { amount: totalAmount.toFixed(2) })
                      }
                    </div>
                  </div>
                </div>

                {termResult && (
                  <div style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: termResult.success ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
                    border: `1px solid ${termResult.success ? 'rgba(5, 150, 105, 0.4)' : 'rgba(225, 29, 72, 0.4)'}`,
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ fontWeight: '800', color: termResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)', marginBottom: '0.2rem' }}>
                      {termResult.success ? `✓ ${t('payment.terminal_approved')}` : `✕ ${termResult.message}`}
                    </div>
                    {termResult.auth_code && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        Autorizační kód: {termResult.auth_code} | Karta: {termResult.card_mask}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {termConfig?.enabled && termConfig?.ip && (
                    <button
                      className="pay-btn pay-btn-card"
                      disabled={termLoading}
                      style={{ flex: 1, height: '62px', fontSize: '1.05rem', fontWeight: '800' }}
                      onClick={handleTerminalPay}
                    >
                      <RefreshCw size={20} className={termLoading ? 'spin' : ''} />
                      <span>{termLoading ? t('payment.sending_to_terminal') : t('payment.card_send_csob')}</span>
                    </button>
                  )}

                  <button
                    className="pay-btn pay-btn-card"
                    style={{
                      flex: 1,
                      height: '62px',
                      fontSize: '1.05rem',
                      fontWeight: '800',
                      background: (termConfig?.enabled && termConfig?.ip) ? 'var(--bg-card)' : 'var(--accent-blue)',
                      border: (termConfig?.enabled && termConfig?.ip) ? '1px solid var(--border-color)' : 'none'
                    }}
                    onClick={handleComplete}
                  >
                    <CheckCircle2 size={22} />
                    <span>{(termConfig?.enabled && termConfig?.ip) ? t('payment.card_manual_override') : `${t('payment.card_confirm_manual')} (${totalAmount.toFixed(2)} Kč)`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* QR Payment Layout */}
            {activeMethod === 'qr' && (() => {
              const rawIban = storeConfig?.bankAccountIban || "CZ6508000000001234567890";
              const merchantIban = rawIban.replace(/\s/g, '').toUpperCase();
              const varSymbol = Date.now().toString().slice(-8);
              const spdString = `SPD*1.0*ACC:${merchantIban}*AM:${totalAmount.toFixed(2)}*CC:CZK*X-VS:${varSymbol}*MSG:Platba Himmel POS`;
              const currentHost = typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : (window.location.hostname || 'localhost');
              const qrImageUrl = `http://${currentHost}:8000/api/v1/qr/generate?data=${encodeURIComponent(spdString)}`;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{
                    textAlign: 'center',
                    padding: '1.25rem 1rem',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.65rem'
                  }}>
                    <div style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }}>
                      <img src={qrImageUrl} alt="QR Platba SPD" style={{ width: '190px', height: '190px', display: 'block' }} />
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--text-primary)' }}>
                      {totalAmount.toLocaleString('cs-CZ')} Kč
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Naskenujte v mobilním bankovnictví (ČS, ČSOB, KB, AirBank, Fio...)
                    </div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                      VS: {varSymbol} • IBAN: {merchantIban.slice(0, 4)}...{merchantIban.slice(-4)}
                    </div>
                  </div>
                  <button
                    className="pay-btn pay-btn-card"
                    style={{ width: '100%', height: '62px', background: 'var(--accent-purple)', fontSize: '1.15rem', fontWeight: '800' }}
                    onClick={handleComplete}
                  >
                    <CheckCircle2 size={24} />
                    <span>Potvrdit Přijatou QR Platbu ({totalAmount.toFixed(2)} Kč)</span>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
