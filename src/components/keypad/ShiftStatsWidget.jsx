import React, { useMemo } from 'react';
import { BarChart3, Banknote, CreditCard, Receipt, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { formatLocalDate } from '../../utils/dateUtils';

export default function ShiftStatsWidget({
  salesHistory = [],
  onNavigateToHistory
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

  return (
    <div
      className="shift-stats-card pos-standalone-card"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.85rem 1rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{
          fontSize: '0.72rem',
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

        <span style={{
          fontSize: '0.72rem',
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

      {/* KPI Grid (2x2) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.45rem'
      }}>
        {/* Total Revenue */}
        <div style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '0.5rem 0.65rem',
          gridColumn: 'span 2'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('shift_stats.today_revenue') || 'Dnešní tržba celkem'}
          </div>
          <div style={{
            fontSize: '1.25rem',
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
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '0.45rem 0.65rem'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Banknote size={12} />
            <span>{t('shift_stats.cash') || 'Hotovost'}</span>
          </div>
          <div style={{
            fontSize: '0.92rem',
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
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '0.45rem 0.65rem'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <CreditCard size={12} />
            <span>{t('shift_stats.card') || 'Kartou'}</span>
          </div>
          <div style={{
            fontSize: '0.92rem',
            fontWeight: '900',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            marginTop: '2px'
          }}>
            {todayCard.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč
          </div>
        </div>
      </div>

      {/* Quick History Navigation Link */}
      {onNavigateToHistory && (
        <button
          type="button"
          onClick={() => onNavigateToHistory(todayStr)}
          style={{
            background: 'transparent',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 0.65rem',
            fontSize: '0.75rem',
            fontWeight: '700',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-blue)';
            e.currentTarget.style.color = 'var(--accent-blue)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          title="Otevřít historii prodejů dnešního dne"
        >
          <Receipt size={13} />
          <span>{t('shift_stats.view_history') || 'Zobrazit dnešní účtenky'}</span>
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
