import React, { useState } from 'react';
import { BarChart3, Banknote, CreditCard, Printer, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

function ShiftStatsWidget({
  shift = null,
  unsent = null,
  onPrintDailySummary,
  onOpenZReport,
  variant = 'card'
}) {
  const { t, language } = useTranslation();

  // One source of truth (audit F-015): the totals come from the server's current shift, the same
  // numbers the Z-report prints. Nothing is summed from sales held in the browser.
  const hasShift = Boolean(shift) && typeof shift === 'object';
  const todaySalesCount = hasShift ? Number(shift.receipts_count) || 0 : null;
  const todayRevenue = hasShift ? Number(shift.total_revenue) || 0 : null;
  const todayCash = hasShift ? Number(shift.total_cash_sales) || 0 : null;
  const todayCard = hasShift ? Number(shift.card_sales) || 0 : null;

  const money = (value, options) =>
    value === null ? '\u2014' : `${value.toLocaleString('cs-CZ', options)} Kč`;

  const receiptsLabel = (() => {
    if (todaySalesCount === null) return '\u2014';
    const category = new Intl.PluralRules(language).select(todaySalesCount);
    const word = t(`shift_stats.receipts_${category}`);
    const fallback = t('shift_stats.receipts_other');
    return `${todaySalesCount} ${word.startsWith('shift_stats.') ? fallback : word}`;
  })();

  // Sales the server does not have yet: shown apart, never added to the totals above
  const unsentLine = unsent && unsent.count > 0 ? (
    <div
      role="status"
      style={{
        fontSize: '0.82rem',
        fontWeight: '700',
        color: 'var(--accent-amber)',
        background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-amber) 35%, transparent)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.3rem 0.55rem'
      }}
    >
      {t('shift_stats.unsent', {
        n: unsent.count,
        amount: unsent.amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      })}
    </div>
  ) : null;

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
              fontWeight: '700',
              color: 'var(--text-primary)',
              letterSpacing: '0.01em'
            }}>
              {t('shift_stats.title') || 'Směna dnes'}
            </span>

            <span style={{
              fontSize: '0.8rem',
              fontWeight: '700',
              color: 'var(--accent-blue)',
              background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
              padding: '2px 7px',
              borderRadius: '999px',
              whiteSpace: 'nowrap'
            }}>
              {receiptsLabel}
            </span>
          </div>

          {/* Right Group: Revenue Preview & Cash/Card Split & Chevron */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('shift_stats.revenue_short') || 'Tržba:'}
              </span>
              <span style={{
                fontSize: '1.08rem',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-emerald)'
              }}>
                {money(todayRevenue)}
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
                <span>{money(todayCash)}</span>
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
                <span>{money(todayCard)}</span>
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

        {unsentLine}

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
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('shift_stats.today_revenue') || 'Dnešní tržba'}
                </div>
                <div style={{
                  fontSize: '1.24rem',
                  fontWeight: '700',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-emerald)',
                  marginTop: '0.15rem'
                }}>
                  {money(todayRevenue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Cash */}
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Banknote size={13} />
                  <span>{t('shift_stats.cash') || 'Hotovost'}</span>
                </div>
                <div style={{
                  fontSize: '1.10rem',
                  fontWeight: '700',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  marginTop: '0.15rem'
                }}>
                  {money(todayCash)}
                </div>
              </div>

              {/* Card */}
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CreditCard size={13} />
                  <span>{t('shift_stats.card') || 'Kartou'}</span>
                </div>
                <div style={{
                  fontSize: '1.10rem',
                  fontWeight: '700',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  marginTop: '0.15rem'
                }}>
                  {money(todayCard)}
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
                      fontWeight: '700',
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
                      fontWeight: '700',
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
          fontWeight: '700',
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
              fontWeight: '700',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-emerald)',
              marginRight: '2px'
            }}>
              {money(todayRevenue)}
            </span>
          )}

          <span style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            color: 'var(--accent-blue)',
            background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
            padding: '2px 7px',
            borderRadius: '999px',
            whiteSpace: 'nowrap'
          }}>
            {receiptsLabel}
          </span>

          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </div>
      </div>

      {unsentLine}

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
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('shift_stats.today_revenue') || 'Dnešní tržba celkem'}
              </div>
              <div style={{
                fontSize: '1.38rem',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-emerald)',
                marginTop: '2px'
              }}>
                {money(todayRevenue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Cash */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.65rem'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Banknote size={12} />
                <span>{t('shift_stats.cash') || 'Hotovost'}</span>
              </div>
              <div style={{
                fontSize: '1.02rem',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                marginTop: '2px'
              }}>
                {money(todayCash)}
              </div>
            </div>

            {/* Card */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.65rem'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <CreditCard size={12} />
                <span>{t('shift_stats.card') || 'Kartou'}</span>
              </div>
              <div style={{
                fontSize: '1.02rem',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                marginTop: '2px'
              }}>
                {money(todayCard)}
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
                    fontWeight: '700',
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
                    fontWeight: '700',
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

