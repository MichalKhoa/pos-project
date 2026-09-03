import React, { useMemo } from 'react';
import { RotateCcw, Sparkles, Coins, Banknote, Delete, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { getCzechCashBreakdown } from '../../utils/currencyBreakdown.js';
import { soundFx } from '../../utils/audio.js';

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

  // Calculate greedy coin/banknote recommendation when returning change
  const cashBreakdown = useMemo(() => {
    return changeDue > 0 ? getCzechCashBreakdown(changeDue) : [];
  }, [changeDue]);

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
    <div className="cash-payment-container">
      {/* COLUMN 1: Fast Cash Denominations & Quick Tender Chips */}
      <div className="cash-col-left">
        {/* Exact Amount Hero Button */}
        <button
          type="button"
          className="cash-shortcut-btn"
          style={{
            height: '48px',
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
          onClick={() => {
            soundFx.playSuccessChime();
            onCashAdd('exact');
          }}
        >
          <Sparkles size={18} />
          <span>{t('payment.exact') || 'Přesná částka'} ({effectiveCashTotal.toFixed(0)} Kč)</span>
        </button>

        {/* 💵 Authentic Color-Coded Czech Banknotes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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

        {/* 🪙 Streamlined Quick Coins + Reset Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Coins size={13} style={{ color: 'var(--accent-amber)' }} />
            <span>{t('payment.coins') || 'Mince'}</span>
          </div>
          <div className="czech-coins-bar">
            {QUICK_COINS.map(coin => (
              <button
                key={coin}
                type="button"
                className="czech-coin-chip"
                onClick={() => {
                  soundFx.playKeypadClick();
                  onCashAdd(coin);
                }}
              >
                +{coin}
              </button>
            ))}
            <button
              type="button"
              className="czech-reset-chip"
              onClick={() => {
                soundFx.playDeleteTone();
                onCashAdd('clear');
              }}
              title={t('payment.reset') || 'Vynulovat'}
            >
              <RotateCcw size={14} />
              <span>{t('payment.reset') || 'Reset'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* COLUMN 2: Tendered Input, 3x4 Touch Numpad & Huge Hero Change Display */}
      <div className="cash-col-right">
        {/* Tendered Input Display */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('payment.received_from_customer') || 'Přijato od zákazníka'}
            </span>
            <button
              type="button"
              onClick={() => {
                soundFx.playDeleteTone();
                onCashAdd('clear');
              }}
              style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <RotateCcw size={12} /> {t('payment.reset') || 'Vynulovat'}
            </button>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.9rem',
            fontWeight: '900',
            color: tenderedVal >= totalAmount ? '#10b981' : '#ffffff',
            background: '#090d16',
            border: '1.5px solid #1e293b',
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

        {/* 🌟 GIANT HERO CHANGE DUE DISPLAY BANNER */}
        <div
          style={{
            background: (tenderedVal > 0 && changeDue < 0)
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(225, 29, 72, 0.28) 100%), #1f0f15'
              : (tenderedVal === 0 || changeDue === 0)
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.18) 100%), #0d1a18'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.35) 100%), #0d1a18',
            border: `2px solid ${(tenderedVal > 0 && changeDue < 0)
              ? '#f43f5e'
              : '#10b981'}`,
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            marginTop: 'auto',
            boxShadow: (changeDue > 0) ? '0 4px 20px rgba(16, 185, 129, 0.35)' : 'none',
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
                color: (tenderedVal > 0 && changeDue < 0) ? '#f43f5e' : '#10b981'
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
                color: (tenderedVal > 0 && changeDue < 0) ? '#f43f5e' : '#ffffff',
                textShadow: (changeDue > 0) ? '0 2px 10px rgba(16, 185, 129, 0.5)' : 'none'
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
          onClick={() => {
            soundFx.playSuccessChime();
            onComplete();
          }}
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
