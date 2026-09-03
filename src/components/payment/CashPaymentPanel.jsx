import React, { useMemo } from 'react';
import { RotateCcw, Sparkles, Coins, Banknote, Delete, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { getCzechCashBreakdown } from '../../utils/currencyBreakdown.js';

const COINS = [1, 2, 5, 10, 20, 50];
const BANKNOTES = [100, 200, 500, 1000, 2000, 5000];
const DIRECT_TENDER_NOTES = [100, 200, 500, 1000, 2000];

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

  // Calculate greedy coin/banknote recommendation when returning change
  const cashBreakdown = useMemo(() => {
    return changeDue > 0 ? getCzechCashBreakdown(changeDue) : [];
  }, [changeDue]);

  return (
    <div className="cash-payment-container">
      {/* COLUMN 1: Fast Cash Denominations & Quick Tender Chips */}
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
          <span>{t('payment.exact') || 'Přesná částka'} ({effectiveCashTotal.toFixed(0)} Kč)</span>
        </button>

        {/* ⚡ DIRECT TENDER (Přímá bankovka) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Banknote size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>{t('payment.direct_tender') || 'Zákazník platí bankovkou'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
            {DIRECT_TENDER_NOTES.map(note => (
              <button
                key={note}
                type="button"
                className="banknote-btn-lg"
                style={{
                  height: '46px',
                  fontSize: '0.95rem',
                  fontWeight: '900',
                  border: tenderedVal === note ? '2px solid var(--accent-emerald)' : '1px solid rgba(16, 185, 129, 0.35)',
                  backgroundColor: tenderedVal === note ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-card)'
                }}
                onClick={() => onCashSet ? onCashSet(note) : onCashAdd(note)}
              >
                {note} Kč
              </button>
            ))}
            <button
              type="button"
              className="banknote-btn-lg"
              style={{
                height: '46px',
                fontSize: '0.95rem',
                fontWeight: '900',
                border: '1px dashed var(--accent-rose)',
                color: 'var(--accent-rose)',
                backgroundColor: 'rgba(244, 63, 94, 0.08)'
              }}
              onClick={() => onCashAdd('clear')}
            >
              {t('payment.reset') || 'Reset'}
            </button>
          </div>
        </div>

        {/* 💵 ACCUMULATE BANKNOTES (+100, +200...) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>{t('payment.add_banknotes') || 'Přidat bankovku (+)'}</span>
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
            <span>{t('payment.coins') || 'Mince'}</span>
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

      {/* COLUMN 2: Tendered Input, 3x4 Touch Numpad & Huge Hero Change Display */}
      <div className="cash-col-right">
        {/* Tendered Input Display */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('payment.received_from_customer') || 'Přijato od zákazníka'}
            </span>
            <button
              type="button"
              onClick={() => onCashAdd('clear')}
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
          <button type="button" className="side-num-btn key-action" onClick={() => onNumpadKey('CLEAR')} title={t('payment.reset') || 'Vynulovat'}>
            C
          </button>
          <button type="button" className="side-num-btn" onClick={() => onNumpadKey('0')}>
            0
          </button>
          <button type="button" className="side-num-btn key-action" onClick={() => onNumpadKey('BACK')} title="Backspace">
            <Delete size={20} />
          </button>
        </div>

        {/* 🌟 GIANT HERO CHANGE DUE DISPLAY BANNER */}
        <div
          style={{
            background: (tenderedVal > 0 && changeDue < 0)
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(225, 29, 72, 0.22) 100%)'
              : (tenderedVal === 0 || changeDue === 0)
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.12) 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)',
            border: `2px solid ${(tenderedVal > 0 && changeDue < 0)
              ? 'var(--accent-rose, #f43f5e)'
              : 'var(--accent-emerald, #10b981)'}`,
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            marginTop: 'auto',
            boxShadow: (changeDue > 0) ? '0 4px 16px rgba(16, 185, 129, 0.25)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: '900',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: (tenderedVal > 0 && changeDue < 0) ? 'var(--accent-rose, #f43f5e)' : 'var(--accent-emerald, #10b981)'
              }}
            >
              {tenderedVal === 0
                ? `${t('payment.change_due') || 'Vrátit'}:`
                : (changeDue < 0
                  ? `${t('payment.missing') || 'Chybí doplatit'}:`
                  : `${t('payment.change_due') || 'Vrátit zákazníkovi'}:`)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '2.5rem',
                lineHeight: '1',
                fontWeight: '900',
                color: (tenderedVal > 0 && changeDue < 0) ? 'var(--accent-rose, #f43f5e)' : 'var(--accent-emerald, #10b981)',
                textShadow: (changeDue > 0) ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none'
              }}
            >
              {tenderedVal === 0 ? '0 Kč' : `${Math.abs(changeDue).toFixed(0)} Kč`}
            </span>
          </div>

          {/* Czech Cash Breakdown Recommendations for Cashier */}
          {changeDue > 0 && cashBreakdown.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.35rem',
                alignItems: 'center',
                paddingTop: '0.45rem',
                borderTop: '1px solid rgba(16, 185, 129, 0.25)'
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted, #94a3b8)', marginRight: '0.1rem' }}>
                {t('payment.breakdown_coins') || 'Doporučené bankovky a mince'}:
              </span>
              {cashBreakdown.map((item, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    fontFamily: 'var(--font-mono)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '0.375rem',
                    backgroundColor: item.isNote ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                    border: item.isNote ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(245, 158, 11, 0.5)',
                    color: item.isNote ? 'var(--accent-emerald, #10b981)' : 'var(--accent-amber, #f59e0b)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.count}× {item.label}
                </span>
              ))}
            </div>
          )}
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
              ? `${t('payment.complete_sale') || 'Dokončit prodej'} — ${t('payment.exact') || 'Přesně'} (${effectiveCashTotal.toFixed(0)} Kč)`
              : (changeDue >= 0
                ? `${t('payment.complete_sale') || 'Dokončit prodej'} (${t('payment.change_due') || 'Vrátit'} ${changeDue.toFixed(0)} Kč)`
                : (t('payment.complete_sale') || 'Dokončit prodej'))}
          </span>
        </button>
      </div>
    </div>
  );
}
