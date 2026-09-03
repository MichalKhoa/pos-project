import React, { useMemo } from 'react';
import { Calendar, CalendarDays, BarChart2, TrendingUp, Receipt } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import {
  aggregateDailyStats,
  aggregateWeeklyStats,
  aggregateMonthlyStats
} from '../../utils/periodAggregator';

/**
 * MultiPeriodComparison
 * Side-by-side comparative dashboard displaying:
 * 1. Last 30 Days
 * 2. Last 12 Weeks
 * 3. Last 12 Months
 */
export default function MultiPeriodComparison({ salesHistory = [] }) {
  const { t, language } = useTranslation();
  const now = useMemo(() => new Date(), []);

  const dailyStats = useMemo(() => {
    return aggregateDailyStats(salesHistory, 30, now, language);
  }, [salesHistory, now, language]);

  const weeklyStats = useMemo(() => {
    return aggregateWeeklyStats(salesHistory, 12, now, language);
  }, [salesHistory, now, language]);

  const monthlyStats = useMemo(() => {
    return aggregateMonthlyStats(salesHistory, 12, now, language);
  }, [salesHistory, now, language]);

  return (
    <div className="table-card multi-period-container">
      {/* Section Header */}
      <div className="multi-period-header">
        <div className="multi-period-title">
          <TrendingUp size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('analytics.comparison_title') || 'Časové srovnání & trendy tržeb'}</span>
        </div>
        <div className="multi-period-badge">
          <span>30 dní · 12 týdnů · 12 měsíců</span>
        </div>
      </div>

      {/* 3-Column Side-by-Side Grid */}
      <div className="multi-period-grid">
        {/* Column 1: Last 30 Days */}
        <div className="period-stat-card">
          <div className="period-stat-card-header">
            <div className="period-card-title-group">
              <Calendar size={16} style={{ color: 'var(--accent-emerald)' }} />
              <h4>{t('analytics.last_30_days') || 'Posledních 30 dní'}</h4>
            </div>
            <div className="period-card-total">
              <strong>{dailyStats.totalRevenue.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč</strong>
              <span className="period-avg-tag">
                ~{dailyStats.avgRevenue.toFixed(0)} Kč / {t('analytics.avg_per_day') || 'den'}
              </span>
            </div>
          </div>

          <div className="period-stat-list custom-scrollbar">
            {dailyStats.items.map(item => (
              <div
                key={item.dateKey}
                className={`period-stat-row ${item.isCurrent ? 'is-current' : ''}`}
                title={`${item.label} (${item.dateKey}): ${item.revenue.toLocaleString('cs-CZ')} Kč · ${item.count} ${t('analytics.receipts_count') || 'účtenek'}`}
              >
                <div className="period-row-meta">
                  <span className={`period-row-label ${item.isCurrent ? 'highlight' : ''}`}>
                    {item.label}
                  </span>
                  <div className="period-row-numbers">
                    <span className="period-row-amount">
                      {item.revenue > 0 ? `${item.revenue.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč` : '0 Kč'}
                    </span>
                    {item.count > 0 && (
                      <span className="period-row-count-badge">
                        <Receipt size={10} />
                        {item.count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Relative Volume Progress Bar */}
                <div className="period-bar-track">
                  <div
                    className="period-bar-fill bar-emerald"
                    style={{ width: `${item.relativePercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Last 12 Weeks */}
        <div className="period-stat-card">
          <div className="period-stat-card-header">
            <div className="period-card-title-group">
              <CalendarDays size={16} style={{ color: 'var(--accent-blue)' }} />
              <h4>{t('analytics.last_12_weeks') || 'Posledních 12 týdnů'}</h4>
            </div>
            <div className="period-card-total">
              <strong>{weeklyStats.totalRevenue.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč</strong>
              <span className="period-avg-tag">
                ~{weeklyStats.avgRevenue.toFixed(0)} Kč / {t('analytics.avg_per_week') || 'týden'}
              </span>
            </div>
          </div>

          <div className="period-stat-list custom-scrollbar">
            {weeklyStats.items.map(item => (
              <div
                key={item.index}
                className={`period-stat-row ${item.isCurrent ? 'is-current' : ''}`}
                title={`${item.label}: ${item.revenue.toLocaleString('cs-CZ')} Kč · ${item.count} ${t('analytics.receipts_count') || 'účtenek'}`}
              >
                <div className="period-row-meta">
                  <span className={`period-row-label ${item.isCurrent ? 'highlight' : ''}`}>
                    {item.label}
                  </span>
                  <div className="period-row-numbers">
                    <span className="period-row-amount">
                      {item.revenue > 0 ? `${item.revenue.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč` : '0 Kč'}
                    </span>
                    {item.count > 0 && (
                      <span className="period-row-count-badge">
                        <Receipt size={10} />
                        {item.count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Relative Volume Progress Bar */}
                <div className="period-bar-track">
                  <div
                    className="period-bar-fill bar-blue"
                    style={{ width: `${item.relativePercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Last 12 Months */}
        <div className="period-stat-card">
          <div className="period-stat-card-header">
            <div className="period-card-title-group">
              <BarChart2 size={16} style={{ color: 'var(--accent-indigo)' }} />
              <h4>{t('analytics.last_12_months') || 'Posledních 12 měsíců'}</h4>
            </div>
            <div className="period-card-total">
              <strong>{monthlyStats.totalRevenue.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč</strong>
              <span className="period-avg-tag">
                ~{monthlyStats.avgRevenue.toFixed(0)} Kč / {t('analytics.avg_per_month') || 'měsíc'}
              </span>
            </div>
          </div>

          <div className="period-stat-list custom-scrollbar">
            {monthlyStats.items.map(item => (
              <div
                key={`${item.year}-${item.month}`}
                className={`period-stat-row ${item.isCurrent ? 'is-current' : ''}`}
                title={`${item.label}: ${item.revenue.toLocaleString('cs-CZ')} Kč · ${item.count} ${t('analytics.receipts_count') || 'účtenek'}`}
              >
                <div className="period-row-meta">
                  <span className={`period-row-label ${item.isCurrent ? 'highlight' : ''}`}>
                    {item.label}
                  </span>
                  <div className="period-row-numbers">
                    <span className="period-row-amount">
                      {item.revenue > 0 ? `${item.revenue.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč` : '0 Kč'}
                    </span>
                    {item.count > 0 && (
                      <span className="period-row-count-badge">
                        <Receipt size={10} />
                        {item.count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Relative Volume Progress Bar */}
                <div className="period-bar-track">
                  <div
                    className="period-bar-fill bar-indigo"
                    style={{ width: `${item.relativePercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
