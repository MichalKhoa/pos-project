import React from 'react';
import { RotateCcw, Sparkles, Coins, Banknote, Delete } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { soundFx } from '../../utils/audio.js';
import PaymentFinishBar from './PaymentFinishBar.jsx';

const CZECH_BANKNOTES = [
  { val: 100, label: '100 Kč', colorClass: 'banknote-100' },
  { val: 200, label: '200 Kč', colorClass: 'banknote-200' },
  { val: 500, label: '500 Kč', colorClass: 'banknote-500' },
  { val: 1000, label: '1 000 Kč', colorClass: 'banknote-1000' },
  { val: 2000, label: '2 000 Kč', colorClass: 'banknote-2000' },
  { val: 5000, label: '5 000 Kč', colorClass: 'banknote-5000' }
];

const QUICK_COINS = [5, 10, 20, 50];

export default function CashPaymentPanel({
  tenderedStr,
  tenderedVal,
  effectiveCashTotal,
  totalAmount,
  changeDue,
  onCashAdd,
  onCashSet,
  onNumpadKey,
  onComplete
}) {
  const { t } = useTranslation();

  const handleBanknoteClick = (noteVal) => {
    soundFx.playScanChime();
    // If nothing tendered yet (or equals exact total), direct set to this note
    if (tenderedVal === 0 || tenderedVal === effectiveCashTotal) {
      if (onCashSet) {
        onCashSet(noteVal);
      } else {
        onCashAdd(noteVal);
      }
    } else {
      // Already entered cash, accumulate
      onCashAdd(noteVal);
    }
  };

  return (
    <div className="payment-panel-stack">
      <div className="cash-payment-container">
      {/* COLUMN 1: Fast Cash Denominations & Quick Tender Chips */}
      <div className="cash-col-left">
        {/* Top Shortcuts: Exact Amount & Reset */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            className="cash-shortcut-btn"
            style={{
              height: '46px',
              background: 'rgba(5, 150, 105, 0.22)',
              color: 'var(--accent-emerald)',
              border: '1.5px solid var(--accent-emerald)',
              borderRadius: 'var(--radius-md)',
              fontWeight: '900',
              fontSize: '0.96rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.12)',
              whiteSpace: 'nowrap'
            }}
            onClick={() => {
              soundFx.playSuccessChime();
              onCashAdd('exact');
            }}
          >
            <Sparkles size={17} />
            <span>{t('payment.exact') || 'Přesně'} ({effectiveCashTotal.toFixed(0)} Kč)</span>
          </button>

          <button
            type="button"
            className="cash-shortcut-btn"
            style={{
              height: '46px',
              background: 'rgba(244, 63, 94, 0.08)',
              color: 'var(--accent-rose)',
              border: '1.5px dashed var(--accent-rose)',
              borderRadius: 'var(--radius-md)',
              fontWeight: '800',
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
            onClick={() => {
              soundFx.playDeleteTone();
              onCashAdd('clear');
            }}
            title={t('payment.reset') || 'Vynulovat'}
          >
            <RotateCcw size={16} />
            <span>{t('payment.reset') || 'Vynulovat'}</span>
          </button>
        </div>

        {/* 💵 Authentic Color-Coded Czech Banknotes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Banknote size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>{t('payment.banknotes') || 'České Bankovky'}</span>
          </div>

          <div className="czech-banknotes-rack">
            {CZECH_BANKNOTES.map(note => {
              const isExactMatch = tenderedVal === note.val;
              return (
                <button
                  key={note.val}
                  type="button"
                  className={`czech-banknote-card ${note.colorClass} ${isExactMatch ? 'active-tender' : ''}`}
                  onClick={() => handleBanknoteClick(note.val)}
                >
                  <div className="banknote-val">{note.label}</div>
                  <div className="banknote-watermark">
                    <Banknote size={24} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 🪙 Streamlined Quick Coins Bar (4 Coins) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Coins size={13} style={{ color: 'var(--accent-amber)' }} />
            <span>{t('payment.coins') || 'Mince'}</span>
          </div>
          <div className="czech-coins-bar">
            {QUICK_COINS.map(coin => (
              <button
                key={coin}
                type="button"
                className={`czech-coin-chip coin-${coin}`}
                onClick={() => {
                  soundFx.playKeypadClick();
                  onCashAdd(coin);
                }}
              >
                <span className={`coin-disc coin-disc-${coin}`} aria-hidden="true">{coin}</span>
                <span>+{coin} Kč</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* COLUMN 2: Tendered Input, 3x4 Touch Numpad & Huge Hero Change Display */}
      <div className="cash-col-right">
        {/* Tendered Input Display */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('payment.received_from_customer') || 'Přijato od zákazníka'}
            </span>
            <button
              type="button"
              onClick={() => {
                soundFx.playDeleteTone();
                onCashAdd('clear');
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <RotateCcw size={12} /> {t('payment.reset') || 'Vynulovat'}
            </button>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.9rem',
            fontWeight: '900',
            color: tenderedVal >= totalAmount ? 'var(--accent-emerald)' : 'var(--text-primary)',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.4rem 0.85rem',
            textAlign: 'right',
            transition: 'all 0.15s ease'
          }}>
            {tenderedVal === 0 ? (
              <span data-testid="tendered-exact" style={{ color: 'var(--text-muted)' }}>
                {effectiveCashTotal.toFixed(0)} Kč
                <small style={{ marginLeft: '0.5rem', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  {t('payment.exact') || 'Přesně'}
                </small>
              </span>
            ) : `${tenderedStr} Kč`}
          </div>
        </div>

        {/* 3x4 Touch Numpad Grid */}
        <div className="side-numpad-grid">
          {['7', '8', '9'].map(n => (
            <button key={n} type="button" className="side-num-btn" onClick={() => { soundFx.playKeypadClick(); onNumpadKey(n); }}>{n}</button>
          ))}
          {['4', '5', '6'].map(n => (
            <button key={n} type="button" className="side-num-btn" onClick={() => { soundFx.playKeypadClick(); onNumpadKey(n); }}>{n}</button>
          ))}
          {['1', '2', '3'].map(n => (
            <button key={n} type="button" className="side-num-btn" onClick={() => { soundFx.playKeypadClick(); onNumpadKey(n); }}>{n}</button>
          ))}
          <button type="button" className="side-num-btn key-action" onClick={() => { soundFx.playDeleteTone(); onNumpadKey('CLEAR'); }} title={t('payment.reset') || 'Vynulovat'}>
            C
          </button>
          <button type="button" className="side-num-btn" onClick={() => { soundFx.playKeypadClick(); onNumpadKey('0'); }}>
            0
          </button>
          <button type="button" className="side-num-btn key-action" onClick={() => { soundFx.playKeypadClick(); onNumpadKey('BACK'); }} title="Backspace">
            <Delete size={20} />
          </button>
        </div>
        </div>
      </div>

      {/* 🌟 FULL-WIDTH HERO CHANGE DUE DISPLAY BANNER */}
      <div
        className="payment-change-hero-banner"
        style={{
          background: (tenderedVal > 0 && changeDue < 0)
            ? 'rgba(244, 63, 94, 0.08)'
            : (tenderedVal === 0 || changeDue === 0)
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(5, 150, 105, 0.28)',
          border: `2.5px solid ${(tenderedVal > 0 && changeDue < 0)
            ? 'var(--accent-rose)'
            : 'var(--accent-emerald)'}`,
          boxShadow: (changeDue > 0) ? '0 4px 18px rgba(16, 185, 129, 0.22)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
          <span
            className="payment-change-hero-label"
            style={{
              color: (tenderedVal > 0 && changeDue < 0) ? 'var(--accent-rose)' : 'var(--accent-emerald)'
            }}
          >
            {tenderedVal === 0
              ? `${t('payment.change_due') || 'Vrátit'}:`
              : (changeDue < 0
                ? `${t('payment.missing') || 'Chybí doplatit'}:`
                : `${t('payment.change_due') || 'Vrátit zákazníkovi'}:`)}
          </span>
          <span
            className="payment-change-hero-value"
            style={{
              color: (tenderedVal > 0 && changeDue < 0) ? 'var(--accent-rose)' : 'var(--accent-emerald)',
              textShadow: (changeDue > 0) ? '0 2px 10px rgba(16, 185, 129, 0.28)' : 'none'
            }}
          >
            {tenderedVal === 0 ? '0 Kč' : `${Math.abs(changeDue).toFixed(0)} Kč`}
          </span>
        </div>
      </div>

      {/* Full-Width Dual Completion Action Bar */}
      <PaymentFinishBar
        primaryClassName="pay-btn-cash"
        disabled={tenderedVal > 0 && changeDue < 0}
        onBeforeComplete={() => soundFx.playSuccessChime()}
        onComplete={onComplete}
      />
    </div>
  );
}
