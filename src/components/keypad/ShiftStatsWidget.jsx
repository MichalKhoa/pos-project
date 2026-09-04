import React, { useMemo, useState } from 'react';
import { BarChart3, Banknote, CreditCard, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { formatLocalDate } from '../../utils/dateUtils';

function ShiftStatsWidget({
  salesHistory = [],
  onPrintDailySummary,
  variant = 'card'
}) {
  const { t } = useTranslation();
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  const {
    todaySalesCount,
    todayRevenue,
    todayCash,
    todayCard
  } = useMemo(() => {
    if (!Array.isArray(salesHistory) || salesHistory.length === 0) {
      return { todaySalesCount: 0, todayRevenue: 0, todayCash: 0, todayCard: 0 };
    }

    const todaySales = salesHistory.filter(sale => {
      const saleDate = sale.created_at || sale.timestamp || sale.date;
      return saleDate && formatLocalDate(saleDate) === todayStr;
    });

    let revenue = 0;
    let cash = 0;
    let card = 0;

    for (const s of todaySales) {
      const total = parseFloat(s.total_amount !== undefined ? s.total_amount : s.total) || 0;
      revenue += total;

      if (s.cash_amount !== undefined || s.card_amount !== undefined) {
        cash += parseFloat(s.cash_amount || 0);
        card += parseFloat(s.card_amount || 0);
      } else if (s.payment_method === 'cash') {
        cash += total;
      } else if (s.payment_method === 'card') {
        card += total;
      }
    }

    return {
      todaySalesCount: todaySales.length,
      todayRevenue: revenue,
      todayCash: cash,
      todayCard: card
    };
  }, [salesHistory, todayStr]);

  const [isExpanded, setIsExpanded] = useState(true);

  // ── SLIM LONG HORIZONTAL BAR VARIANT ──
  if (variant === 'slim') {
    return (
      <div
        className="pos-card-box shift-stats-slim"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.85rem',
          minHeight: '48px',
          gap: '0.65rem',
          flexShrink: 0,
          boxSizing: 'border-box',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}
      >
        {/* Left: Title & Receipts Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          <div style={{
            fontSize: '0.88rem',
            fontWeight: '900',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}>
            <BarChart3 size={15} style={{ color: 'var(--accent-blue)' }} />
            <span>{t('shift_stats.title') || 'Směna dnes'}</span>
          </div>

          <span style={{
            fontSize: '0.82rem',
            fontWeight: '800',
            color: 'var(--accent-blue)',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            padding: '2px 7px',
            borderRadius: '999px'
          }}>
            {todaySalesCount} {t('shift_stats.receipts') || 'účtenek'}
          </span>
        </div>

        {/* Center: Total Revenue & Cash / Card Split */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.80rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('shift_stats.revenue_short') || 'Tržba:'}
            </span>
            <span style={{
              fontSize: '1.16rem',
              fontWeight: '900',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-emerald)'
            }}>
              {todayRevenue.toLocaleString('cs-CZ')} Kč
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.86rem', fontFamily: 'var(--font-mono)' }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: 'var(--accent-emerald)',
              fontWeight: '800'
            }}>
              <Banknote size={13} />
              <span>{todayCash.toLocaleString('cs-CZ')} Kč</span>
            </span>

            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: 'var(--accent-blue)',
              fontWeight: '800'
            }}>
              <CreditCard size={13} />
              <span>{todayCard.toLocaleString('cs-CZ')} Kč</span>
            </span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        {onPrintDailySummary && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onPrintDailySummary}
              className="key-btn"
              style={{
                padding: '0 0.55rem',
                height: '32px',
                minHeight: '32px',
                aspectRatio: 'auto',
                fontSize: '0.84rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                borderRadius: 'var(--radius-md)',
                background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
                color: 'var(--accent-blue)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title={t('shift_stats.print_summary_tooltip') || 'Vytisknout denní uzávěrku'}
            >
              <Printer size={13} />
              <span>{t('shift_stats.print_daily_summary') || 'Denní uzávěrka'}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="pos-card-box keypad-stats-box shift-stats-card"
      style={{
        padding: isExpanded ? '0.75rem 0.85rem' : '0.55rem 0.85rem',
        gap: isExpanded ? '0.5rem' : '0',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Header - Clickable Collapse / Expand Toggle */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'manipulation'
        }}
        title={isExpanded ? 'Sbalit přehled směny' : 'Rozbalit přehled směny'}
      >
        <div style={{
          fontSize: '0.82rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <BarChart3 size={14} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('shift_stats.title') || 'Dnešní směna (Přehled)'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {!isExpanded && (
            <span style={{
              fontSize: '0.90rem',
              fontWeight: '900',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-emerald)',
              marginRight: '2px'
            }}>
              {todayRevenue.toLocaleString('cs-CZ')} Kč
            </span>
          )}

          <span style={{
            fontSize: '0.82rem',
            fontWeight: '800',
            color: 'var(--accent-blue)',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            padding: '2px 7px',
            borderRadius: '999px',
            whiteSpace: 'nowrap'
          }}>
            {todaySalesCount} {t('shift_stats.receipts') || 'účtenek'}
          </span>

          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {isExpanded && (
        <>

      {/* KPI Grid (2x2) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.45rem'
      }}>
        {/* Total Revenue */}
        <div style={{
          background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
          border: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
          borderRadius: '10px',
          padding: '0.5rem 0.65rem',
          gridColumn: 'span 2'
        }}>
          <div style={{ fontSize: '0.80rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('shift_stats.today_revenue') || 'Dnešní tržba celkem'}
          </div>
          <div style={{
            fontSize: '1.38rem',
            fontWeight: '900',
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-emerald)',
            marginTop: '2px'
          }}>
            {todayRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
          </div>
        </div>

        {/* Cash */}
        <div style={{
          background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
          border: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
          borderRadius: '10px',
          padding: '0.45rem 0.65rem'
        }}>
          <div style={{ fontSize: '0.80rem', fontWeight: '800', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Banknote size={12} />
            <span>{t('shift_stats.cash') || 'Hotovost'}</span>
          </div>
          <div style={{
            fontSize: '1.02rem',
            fontWeight: '900',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            marginTop: '2px'
          }}>
            {todayCash.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
          border: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
          borderRadius: '10px',
          padding: '0.45rem 0.65rem'
        }}>
          <div style={{ fontSize: '0.80rem', fontWeight: '800', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <CreditCard size={12} />
            <span>{t('shift_stats.card') || 'Kartou'}</span>
          </div>
          <div style={{
            fontSize: '1.02rem',
            fontWeight: '900',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            marginTop: '2px'
          }}>
            {todayCard.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč
          </div>
        </div>
      </div>

      {/* 1-Click Thermal Daily Summary Slip */}
      {onPrintDailySummary && (
        <button
          type="button"
          onClick={onPrintDailySummary}
          style={{
            background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.35rem 0.55rem',
            fontSize: '0.84rem',
            fontWeight: '800',
            color: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginTop: '0.1rem',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.12)'
          }}
          title={t('shift_stats.print_summary_tooltip') || 'Vytisknout souhrn dnešních tržeb na pokladní tiskárnu a otevřít zásuvku'}
        >
          <Printer size={13} />
          <span>{t('shift_stats.print_daily_summary') || 'Vytisknout denní tržbu'}</span>
        </button>
      )}
        </>
      )}
    </div>
  );
}

export default React.memo(ShiftStatsWidget);
