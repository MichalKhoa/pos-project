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
      {/* COLUMN 1: Cash Received, Coins, Banknotes & Change Box */}
      <div className="cash-col-left">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Přijato od zákazníka
            </span>
            <button
              type="button"
              onClick={() => onCashAdd('clear')}
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
            onClick={() => onCashAdd('exact')}
          >
            <Sparkles size={15} />
            <span>{t('payment.exact')} ({effectiveCashTotal.toFixed(0)} Kč)</span>
          </button>
          <button
            type="button"
            className="cash-shortcut-btn"
            style={{ flex: 1, padding: '0.65rem', fontSize: '0.85rem' }}
            onClick={() => onCashAdd('clear')}
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
                onClick={() => onCashAdd(coin)}
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
                onClick={() => onCashAdd(note)}
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
            <button key={n} type="button" className="side-num-btn" onClick={() => onNumpadKey(n)}>{n}</button>
          ))}
          <button type="button" className="side-num-btn key-action" onClick={() => onNumpadKey('BACK')} title="Backspace">
            <Delete size={22} />
          </button>

          {['4', '5', '6'].map(n => (
            <button key={n} type="button" className="side-num-btn" onClick={() => onNumpadKey(n)}>{n}</button>
          ))}
          <button type="button" className="side-num-btn key-action" onClick={() => onNumpadKey('CLEAR')} title={t('payment.reset')}>
            C
          </button>

          {['1', '2', '3'].map(n => (
            <button key={n} type="button" className="side-num-btn" onClick={() => onNumpadKey(n)}>{n}</button>
          ))}
          <button type="button" className="side-num-btn" onClick={() => onNumpadKey('.')}>,</button>

          <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => onNumpadKey('0')}>0</button>
          <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => onNumpadKey('00')}>00</button>
        </div>

        {/* Complete Sale Button */}
        <button
          className="pay-btn pay-btn-cash"
          style={{ width: '100%', height: '64px', marginTop: 'auto', fontSize: '1.15rem', fontWeight: '800' }}
          disabled={changeDue < 0}
          onClick={onComplete}
        >
          <CheckCircle2 size={24} />
          <span>{t('payment.complete_sale')} ({effectiveCashTotal.toFixed(0)} Kč)</span>
        </button>
      </div>
    </div>
  );
}
