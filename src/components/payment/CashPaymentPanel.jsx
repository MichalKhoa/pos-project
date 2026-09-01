import React from 'react';
import { RotateCcw, Sparkles, Coins, Banknote, Delete, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

const COINS = [1, 2, 5, 10, 20, 50];
const BANKNOTES = [100, 200, 500, 1000, 2000, 5000];

export default function CashPaymentPanel({
  tenderedStr,
  tenderedVal,
  effectiveCashTotal,
  totalAmount,
  changeDue,
  onCashAdd,
  onNumpadKey,
  onComplete
}) {
  const { t } = useTranslation();

  return (
    <div className="cash-payment-container">
      {/* COLUMN 1: Fast Cash Denominations (Banknotes & Coins) */}
      <div className="cash-col-left">
        {/* Exact Amount Hero Button */}
        <button
          type="button"
          className="cash-shortcut-btn"
          style={{
            height: '52px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.22) 100%)',
            color: 'var(--accent-emerald)',
            border: '1.5px solid var(--accent-emerald)',
            borderRadius: 'var(--radius-md)',
            fontWeight: '900',
            fontSize: '1.05rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
          }}
          onClick={() => onCashAdd('exact')}
        >
          <Sparkles size={18} />
          <span>{t('payment.exact')} ({effectiveCashTotal.toFixed(0)} Kč)</span>
        </button>

        {/* 💵 BANKNOTES (Bankovky 3x2 Grid) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Banknote size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>{t('payment.banknotes')}</span>
          </div>
          <div className="banknotes-grid-lg">
            {BANKNOTES.map(note => (
              <button
                key={note}
                type="button"
                className="banknote-btn-lg"
                onClick={() => onCashAdd(note)}
              >
                +{note} Kč
              </button>
            ))}
          </div>
        </div>

        {/* 🪙 COINS (Mince 3x2 Grid) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Coins size={14} style={{ color: 'var(--accent-amber)' }} />
            <span>{t('payment.coins')}</span>
          </div>
          <div className="coins-grid-lg">
            {COINS.map(coin => (
              <button
                key={coin}
                type="button"
                className="coin-btn-lg"
                onClick={() => onCashAdd(coin)}
              >
                +{coin} Kč
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* COLUMN 2: Tendered Input, 3x4 Touch Numpad & Change Due */}
      <div className="cash-col-right">
        {/* Tendered Input Display */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('payment.received_from_customer')}
            </span>
            <button
              type="button"
              onClick={() => onCashAdd('clear')}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <RotateCcw size={12} /> {t('payment.reset')}
            </button>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.9rem',
            fontWeight: '900',
            color: tenderedVal >= totalAmount ? 'var(--accent-emerald)' : 'var(--text-primary)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.4rem 0.85rem',
            textAlign: 'right',
            transition: 'all 0.15s ease'
          }}>
            {tenderedStr} Kč
          </div>
        </div>

        {/* 3x4 Touch Numpad Grid */}
        <div className="side-numpad-grid">
          {['7', '8', '9'].map(n => (
            <button key={n} type="button" className="side-num-btn" onClick={() => onNumpadKey(n)}>{n}</button>
          ))}
          {['4', '5', '6'].map(n => (
            <button key={n} type="button" className="side-num-btn" onClick={() => onNumpadKey(n)}>{n}</button>
          ))}
          {['1', '2', '3'].map(n => (
            <button key={n} type="button" className="side-num-btn" onClick={() => onNumpadKey(n)}>{n}</button>
          ))}
          <button type="button" className="side-num-btn key-action" onClick={() => onNumpadKey('CLEAR')} title={t('payment.reset')}>
            C
          </button>
          <button type="button" className="side-num-btn" onClick={() => onNumpadKey('0')}>
            0
          </button>
          <button type="button" className="side-num-btn key-action" onClick={() => onNumpadKey('BACK')} title="Backspace">
            <Delete size={20} />
          </button>
        </div>

        {/* Change Due Display Box */}
        <div style={{
          background: (tenderedVal > 0 && changeDue < 0)
            ? 'rgba(225, 29, 72, 0.08)'
            : 'rgba(5, 150, 105, 0.08)',
          border: `1px solid ${(tenderedVal > 0 && changeDue < 0)
            ? 'rgba(225, 29, 72, 0.3)'
            : 'rgba(5, 150, 105, 0.3)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto'
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: (tenderedVal > 0 && changeDue < 0) ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
            {tenderedVal === 0
              ? `${t('payment.change_due')}:`
              : (changeDue < 0 ? `${t('payment.missing')}:` : `${t('payment.change_due')}:`)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.65rem', fontWeight: '900', color: (tenderedVal > 0 && changeDue < 0) ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
            {tenderedVal === 0 ? '0 Kč' : `${Math.abs(changeDue).toFixed(0)} Kč`}
          </span>
        </div>

        {/* Complete Sale Button */}
        <button
          type="button"
          className="pay-btn pay-btn-cash"
          style={{ width: '100%', height: '54px', fontSize: '1.05rem', fontWeight: '800' }}
          disabled={tenderedVal > 0 && changeDue < 0}
          onClick={onComplete}
        >
          <CheckCircle2 size={22} />
          <span>
            {tenderedVal === 0
              ? `${t('payment.complete_sale')} — ${t('payment.exact')} (${effectiveCashTotal.toFixed(0)} Kč)`
              : (changeDue >= 0
                ? `${t('payment.complete_sale')} (${t('payment.change_due')} ${changeDue.toFixed(0)} Kč)`
                : t('payment.complete_sale'))}
          </span>
        </button>
      </div>
    </div>
  );
}
