import React, { useMemo, useState } from 'react';
import { BarChart3, Banknote, CreditCard, Printer, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { formatLocalDate } from '../../utils/dateUtils';
import { roundCZK } from '../../utils/tax.js';

function ShiftStatsWidget({
  salesHistory = [],
  onPrintDailySummary,
  onOpenZReport,
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
      revenue = roundCZK(revenue + total);

      if (s.cash_amount !== undefined || s.card_amount !== undefined) {
        cash = roundCZK(cash + parseFloat(s.cash_amount || 0));
        card = roundCZK(card + parseFloat(s.card_amount || 0));
      } else if (s.payment_method === 'cash') {
        cash = roundCZK(cash + total);
      } else if (s.payment_method === 'card') {
        card = roundCZK(card + total);
      }
    }

    return {
      todaySalesCount: todaySales.length,
      todayRevenue: revenue,
      todayCash: cash,
      todayCard: card
    };
  }, [salesHistory, todayStr]);

  // Default collapsed for slim variant under presets to give maximum height to grid,
  // default expanded for card variant docked in side columns.
  const [isExpanded, setIsExpanded] = useState(variant !== 'slim');

  // ── SLIM COLLAPSIBLE DRAWER VARIANT (Under Presets) ──
  if (variant === 'slim') {
    return (
      <div
        className="shift-stats-slim"
        style={{
          padding: isExpanded ? '0.65rem 0.85rem' : '0.45rem 0.85rem'
        }}
      >
        {/* Clickable Header Bar */}
        <div
          onClick={() => setIsExpanded(prev => !prev)}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(prev => !prev);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
            gap: '0.65rem',
            minHeight: '36px'
          }}
          title={isExpanded ? 'Sbalit přehled směny' : 'Rozbalit přehled směny'}
        >
          {/* Left: Title & Receipts Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)',
              flexShrink: 0
            }}>
              <BarChart3 size={15} />
            </div>

            <span style={{
              fontSize: '0.86rem',
              fontWeight: '800',
              color: 'var(--text-primary)',
              letterSpacing: '0.01em'
            }}>
              {t('shift_stats.title') || 'Směna dnes'}
            </span>

            <span style={{
              fontSize: '0.78rem',
              fontWeight: '800',
              color: 'var(--accent-blue)',
              background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
              padding: '2px 7px',
              borderRadius: '999px',
              whiteSpace: 'nowrap'
            }}>
              {todaySalesCount} {t('shift_stats.receipts') || 'účtenek'}
            </span>
          </div>

          {/* Right Group: Revenue Preview & Cash/Card Split & Chevron */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('shift_stats.revenue_short') || 'Tržba:'}
              </span>
              <span style={{
                fontSize: '1.08rem',
                fontWeight: '900',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-emerald)'
              }}>
                {todayRevenue.toLocaleString('cs-CZ')} Kč
              </span>
            </div>

            <div className="shift-stats-split-preview" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.80rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: '700',
                color: 'var(--accent-amber)',
                background: 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)'
              }}>
                <Banknote size={12} />
                <span>{todayCash.toLocaleString('cs-CZ')} Kč</span>
              </span>

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.80rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: '700',
                color: 'var(--accent-blue)',
                background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)'
              }}>
                <CreditCard size={12} />
                <span>{todayCard.toLocaleString('cs-CZ')} Kč</span>
              </span>
            </div>

            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
          </div>
        </div>

        {/* Expanded Drawer Details */}
        {isExpanded && (
          <div style={{
            marginTop: '0.65rem',
            paddingTop: '0.65rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}>
            {/* 3 KPI Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.5rem'
            }}>
              {/* Total Revenue */}
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem'
              }}>
                <div style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('shift_stats.today_revenue') || 'Dnešní tržba'}
                </div>
                <div style={{
                  fontSize: '1.24rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-emerald)',
                  marginTop: '0.15rem'
                }}>
                  {todayRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                </div>
              </div>

              {/* Cash */}
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem'
              }}>
                <div style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Banknote size={13} />
                  <span>{t('shift_stats.cash') || 'Hotovost'}</span>
                </div>
                <div style={{
                  fontSize: '1.10rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  marginTop: '0.15rem'
                }}>
                  {todayCash.toLocaleString('cs-CZ')} Kč
                </div>
              </div>

              {/* Card */}
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem'
              }}>
                <div style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CreditCard size={13} />
                  <span>{t('shift_stats.card') || 'Kartou'}</span>
                </div>
                <div style={{
                  fontSize: '1.10rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  marginTop: '0.15rem'
                }}>
                  {todayCard.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
            </div>

            {/* 1-Click Action Buttons */}
            {(onOpenZReport || onPrintDailySummary) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: onOpenZReport && onPrintDailySummary ? '1fr 1fr' : '1fr',
                gap: '0.5rem'
              }}>
                {onOpenZReport && (
                  <button
                    type="button"
                    onClick={onOpenZReport}
                    className="key-btn"
                    style={{
                      height: '42px',
                      minHeight: '42px',
                      padding: '0 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'color-mix(in srgb, var(--accent-emerald) 12%, var(--bg-card))',
                      border: '1px solid color-mix(in srgb, var(--accent-emerald) 35%, transparent)',
                      color: 'var(--accent-emerald)',
                      fontSize: '0.88rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-key)'
                    }}
                    title={t('z_report.button') || 'Provést denní Z-Uzávěrku pokladny'}
                  >
                    <FileSpreadsheet size={16} />
                    <span>{t('z_report.button') || 'Z-Uzávěrka'}</span>
                  </button>
                )}

                {onPrintDailySummary && (
                  <button
                    type="button"
                    onClick={onPrintDailySummary}
                    className="key-btn"
                    style={{
                      height: '42px',
                      minHeight: '42px',
                      padding: '0 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))',
                      border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
                      color: 'var(--accent-blue)',
                      fontSize: '0.88rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-key)'
                    }}
                    title={t('shift_stats.print_summary_tooltip') || 'Vytisknout denní uzávěrku'}
                  >
                    <Printer size={16} />
                    <span>{t('shift_stats.print_daily_summary') || 'Denní uzávěrka'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── CARD VARIANT (Docked in Keypad or Under Cart) ──
  return (
    <div
      className="keypad-stats-box shift-stats-card"
      style={{
        padding: isExpanded ? '0.75rem 0.85rem' : '0.55rem 0.85rem',
        gap: isExpanded ? '0.55rem' : '0'
      }}
    >
      {/* Header - Clickable Collapse / Expand Toggle */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(prev => !prev);
          }
        }}
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
          <BarChart3 size={15} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('shift_stats.title') || 'Dnešní směna'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {!isExpanded && (
            <span style={{
              fontSize: '0.92rem',
              fontWeight: '900',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-emerald)',
              marginRight: '2px'
            }}>
              {todayRevenue.toLocaleString('cs-CZ')} Kč
            </span>
          )}

          <span style={{
            fontSize: '0.78rem',
            fontWeight: '800',
            color: 'var(--accent-blue)',
            background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
            padding: '2px 7px',
            borderRadius: '999px',
            whiteSpace: 'nowrap'
          }}>
            {todaySalesCount} {t('shift_stats.receipts') || 'účtenek'}
          </span>

          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* KPI Grid (Revenue Hero + Cash & Card) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.45rem'
          }}>
            {/* Total Revenue */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.55rem 0.75rem',
              gridColumn: 'span 2'
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.65rem'
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '3px' }}>
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
                {todayCash.toLocaleString('cs-CZ')} Kč
              </div>
            </div>

            {/* Card */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.65rem'
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '3px' }}>
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
                {todayCard.toLocaleString('cs-CZ')} Kč
              </div>
            </div>
          </div>

          {/* 1-Click Action Buttons (Z-Report & Daily Summary) */}
          {(onOpenZReport || onPrintDailySummary) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: onOpenZReport && onPrintDailySummary ? '1fr 1fr' : '1fr',
              gap: '0.45rem',
              marginTop: '0.15rem'
            }}>
              {onOpenZReport && (
                <button
                  type="button"
                  onClick={onOpenZReport}
                  className="key-btn"
                  style={{
                    minHeight: '42px',
                    borderRadius: 'var(--radius-md)',
                    background: 'color-mix(in srgb, var(--accent-emerald) 12%, var(--bg-card))',
                    border: '1px solid color-mix(in srgb, var(--accent-emerald) 35%, transparent)',
                    padding: '0.4rem 0.5rem',
                    fontSize: '0.84rem',
                    fontWeight: '800',
                    color: 'var(--accent-emerald)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-key)'
                  }}
                  title={t('z_report.button') || 'Provést Z-Uzávěrku pokladny a vyrovnat směnu'}
                >
                  <FileSpreadsheet size={15} />
                  <span>{t('z_report.button') || 'Z-Uzávěrka'}</span>
                </button>
              )}

              {onPrintDailySummary && (
                <button
                  type="button"
                  onClick={onPrintDailySummary}
                  className="key-btn"
                  style={{
                    minHeight: '42px',
                    borderRadius: 'var(--radius-md)',
                    background: 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))',
                    border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
                    padding: '0.4rem 0.5rem',
                    fontSize: '0.84rem',
                    fontWeight: '800',
                    color: 'var(--accent-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-key)'
                  }}
                  title={t('shift_stats.print_summary_tooltip') || 'Vytisknout souhrn dnešních tržeb na pokladní tiskárnu a otevřít zásuvku'}
                >
                  <Printer size={15} />
                  <span>{t('shift_stats.print_daily_summary') || 'Vytisknout tržbu'}</span>
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default React.memo(ShiftStatsWidget);

