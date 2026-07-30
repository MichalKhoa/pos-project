import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, QrCode, CheckCircle2, Split, Coins, Delete, RotateCcw, Sparkles, RefreshCw, AlertCircle, Wifi } from 'lucide-react';
import { fetchTerminalConfig, payWithTerminal } from '../api/posApi';
import { useTranslation } from '../i18n/LanguageContext.jsx';

const COINS = [1, 2, 5, 10, 20, 50];
const BANKNOTES = [100, 200, 500, 1000, 2000, 5000];

export default function PaymentModal({
  method,
  totalAmount,
  onClose,
  onCompleteSale
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

  // Split payment state
  const [splitCashStr, setSplitCashStr] = useState('0');

  useEffect(() => {
    setTenderedStr('0');
    setSplitCashStr('0');
  }, [totalAmount]);

  const tenderedVal = parseFloat(tenderedStr) || 0;
  const changeDue = tenderedVal - totalAmount;

  // Split payment amounts
  const splitCashVal = parseFloat(splitCashStr) || 0;
  const splitCardVal = Math.max(0, totalAmount - splitCashVal);

  const handleCashAdd = (val) => {
    if (val === 'exact') {
      setTenderedStr(totalAmount.toString());
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
  }, [activeMethod, tenderedStr, splitCashStr, changeDue, totalAmount]);

  const handleComplete = () => {
    if (activeMethod === 'cash' && changeDue < 0) return;

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
              <span className="sidebar-total-label">Celkem k úhradě</span>
              <span className="sidebar-total-amount">{totalAmount.toFixed(0)} Kč</span>
            </div>
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
                      <span>{t('payment.exact')} ({totalAmount.toFixed(0)} Kč)</span>
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
                    <span>{t('payment.complete_sale')} ({totalAmount.toFixed(0)} Kč)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Kombinovaná (Split Payment): Side-by-Side 2-Column Widescreen Layout with Touch Numpad */}
            {activeMethod === 'split' && (
              <div className="cash-payment-container">
                {/* COLUMN 1: Cash Portion Inputs, Calculation & Shortcuts */}
                <div className="cash-col-left" style={{ gap: '1rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Split size={18} />
                    <span>Rozdělení částky (Hotovost + Karta)</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      Částka hrazená HOTOVĚ (Kč)
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
                      Zbývá uhradit KARTOU:
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
                      {splitCardVal.toFixed(0)} Kč
                    </span>
                  </div>

                  {/* Quick Ratio & Cash Shortcut Buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button type="button" className="vat-btn" style={{ padding: '0.65rem', fontWeight: '800' }} onClick={() => setSplitCashStr((totalAmount / 2).toFixed(0))}>50% / 50%</button>
                    <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('100')}>100 Kč</button>
                    <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('200')}>200 Kč</button>
                    <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('500')}>500 Kč</button>
                    <button type="button" className="vat-btn" style={{ padding: '0.65rem', color: 'var(--accent-rose)' }} onClick={() => setSplitCashStr('0')}>C (Vynulovat)</button>
                  </div>
                </div>

                {/* COLUMN 2: Touch Numpad for Split Cash & Finish Button */}
                <div className="cash-col-right">
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Klávesnice pro částku hotovosti:
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
                    <button type="button" className="side-num-btn key-action" onClick={() => handleSplitNumpadKey('CLEAR')} title="Vynulovat">
                      C
                    </button>

                    {['1', '2', '3'].map(n => (
                      <button key={n} type="button" className="side-num-btn" onClick={() => handleSplitNumpadKey(n)}>{n}</button>
                    ))}
                    <button type="button" className="side-num-btn" onClick={() => handleSplitNumpadKey('.')}>,</button>

                    <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleSplitNumpadKey('0')}>0</button>
                    <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleSplitNumpadKey('00')}>00</button>
                  </div>

                  {/* Big Glowing Split Complete Button */}
                  <button
                    className="pay-btn pay-btn-cash"
                    style={{ width: '100%', height: '64px', marginTop: 'auto', fontSize: '1.15rem', fontWeight: '800' }}
                    onClick={handleComplete}
                  >
                    <CheckCircle2 size={24} />
                    <span>Dokončit Kombinovaný Prodej ({totalAmount.toFixed(0)} Kč)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Card Payment Layout with CSOB Terminal Preparation Status */}
            {activeMethod === 'card' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', padding: '2.5rem 2rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <CreditCard size={64} style={{ color: 'var(--accent-blue)', marginBottom: '0.8rem' }} />
                  <div style={{ fontWeight: '800', fontSize: '1.4rem', marginBottom: '0.4rem' }}>Přiložte nebo vložte kartu</div>
                  <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Částka k úhradě: <strong>{totalAmount.toFixed(0)} Kč</strong></div>

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
                          ? `ČSOB IP Terminál (${termConfig.ip}:${termConfig.port})`
                          : 'Ruční Režim Terminálu (Samostatný terminál)'
                        }
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {(termConfig?.enabled && termConfig?.ip)
                        ? `Připraven k automatickému TCP spojení. Stiskněte tlačítko pro odeslání ${totalAmount.toFixed(0)} Kč na displej terminálu.`
                        : `Zadejte částku ${totalAmount.toFixed(0)} Kč ručně na displeji vášho klávesnicového terminálu a po schválení stiskněte potvrdit.`
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
                      {termResult.success ? '✓ Transakce na terminálu schválena!' : `✕ ${termResult.message}`}
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
                      <span>{termLoading ? 'Odesílám na ČSOB terminál...' : 'Odeslat na Terminál ČSOB'}</span>
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
                    <span>{(termConfig?.enabled && termConfig?.ip) ? 'Ruční Schválení Karty' : `Potvrdit Přijatou Platbu Kartou (${totalAmount.toFixed(0)} Kč)`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* QR Payment Layout */}
            {activeMethod === 'qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <QrCode size={72} style={{ color: 'var(--accent-purple)', marginBottom: '1rem' }} />
                  <div style={{ fontWeight: '800', fontSize: '1.4rem', marginBottom: '0.4rem' }}>Naskenujte QR kód platby</div>
                  <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Platba přes okamžitý bankovní převod (SPD kód)</div>
                </div>
                <button
                  className="pay-btn pay-btn-card"
                  style={{ width: '100%', height: '62px', background: 'var(--accent-purple)', fontSize: '1.15rem', fontWeight: '800' }}
                  onClick={handleComplete}
                >
                  <CheckCircle2 size={24} />
                  <span>Potvrdit QR Platbu ({totalAmount.toFixed(0)} Kč)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
