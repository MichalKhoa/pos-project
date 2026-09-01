import React from 'react';
import { DollarSign, Banknote, CreditCard, Receipt, BarChart3, PieChart } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function SalesAnalyticsCharts({
  periodLabel,
  totalRevenue,
  cashRevenue,
  cardRevenue,
  qrRevenue,
  transactionCount,
  avgOrderValue,
  periodTaxSummary,
  totalNetto,
  totalVat,
  sortedCategories,
  paymentMethodSummary,
  dayOfWeekSummary
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Primary KPI Metrics */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-emerald)' }}>
            <DollarSign size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('history.revenue')} ({periodLabel})</span>
            <span className="metric-value">{totalRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-blue)' }}>
            <Banknote size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('history.cash_revenue')} ({totalRevenue > 0 ? ((cashRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
            <span className="metric-value">{cashRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-purple)' }}>
            <CreditCard size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('payment.card')} ({totalRevenue > 0 ? ((cardRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
            <span className="metric-value">{cardRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-amber)' }}>
            <Receipt size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('payment.qr')} ({totalRevenue > 0 ? ((qrRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
            <span className="metric-value">{qrRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Receipt size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('history.txn_count')}</span>
            <span className="metric-value">{transactionCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({avgOrderValue.toFixed(0)} Kč)</span></span>
          </div>
        </div>
      </div>

      {/* Row 1: Tax Breakdown & Category Sales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
        {/* VAT Tax Summary Table */}
        <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} style={{ color: 'var(--accent-blue)' }} />
            <span>Rozpis DPH ({periodLabel})</span>
          </h3>

          <div style={{ flex: 1, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Sazba DPH</th>
                  <th style={{ textAlign: 'right' }}>Základ (Netto)</th>
                  <th style={{ textAlign: 'right' }}>DPH</th>
                  <th style={{ textAlign: 'right' }}>Celkem s DPH</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(periodTaxSummary).map(tItem => (
                  <tr key={tItem.rate}>
                    <td style={{ fontWeight: '700', textAlign: 'left' }}>{tItem.rate}%</td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{tItem.net.toFixed(2)} Kč</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: '700', textAlign: 'right' }}>
                      {tItem.tax.toFixed(2)} Kč
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                      {tItem.gross.toFixed(2)} Kč
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '800' }}>
                  <td style={{ textAlign: 'left' }}>CELKEM</td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{totalNetto.toFixed(2)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', textAlign: 'right' }}>{totalVat.toFixed(2)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', textAlign: 'right' }}>{totalRevenue.toFixed(2)} Kč</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Breakdown Table */}
        <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={18} style={{ color: 'var(--accent-purple)' }} />
            <span>{t('history.category_sales')}</span>
          </h3>

          <div style={{ flex: 1, overflowX: 'auto' }}>
            {sortedCategories.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Ve zvoleném období nebyly prodány žádné položky.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>{t('presets.col_category')}</th>
                    <th style={{ textAlign: 'right' }}>{t('history.items_sold')}</th>
                    <th style={{ textAlign: 'right' }}>{t('history.revenue')} (Kč)</th>
                    <th style={{ textAlign: 'right' }}>{t('history.share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCategories.map(cat => (
                    <tr key={cat.category}>
                      <td style={{ fontWeight: '700', textTransform: 'capitalize', textAlign: 'left' }}>{cat.category}</td>
                      <td style={{ textAlign: 'right' }}>{cat.quantity} ks</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                        {cat.total.toFixed(0)} Kč
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {((cat.total / (totalRevenue || 1)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Payment Methods & Weekday Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
        {/* Payment Method Breakdown Panel */}
        <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={18} style={{ color: 'var(--accent-emerald)' }} />
            <span>{t('history.payment_breakdown_title')}</span>
          </h3>

          <div style={{ flex: 1, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{t('history.col_payment_method')}</th>
                  <th style={{ textAlign: 'right' }}>{t('history.col_tx_count')}</th>
                  <th style={{ textAlign: 'right' }}>{t('history.col_aov')}</th>
                  <th style={{ textAlign: 'right' }}>{t('history.col_total_czk')}</th>
                  <th style={{ textAlign: 'right' }}>{t('history.share')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', textAlign: 'left' }}>
                    <Banknote size={15} style={{ color: 'var(--accent-blue)' }} /> {t('payment.cash')}
                  </td>
                  <td style={{ textAlign: 'right' }}>{paymentMethodSummary.cash.count} ks</td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paymentMethodSummary.cash.aov.toFixed(0)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                    {paymentMethodSummary.cash.total.toFixed(0)} Kč
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {totalRevenue > 0 ? ((paymentMethodSummary.cash.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', textAlign: 'left' }}>
                    <CreditCard size={15} style={{ color: 'var(--accent-purple)' }} /> {t('payment.card')}
                  </td>
                  <td style={{ textAlign: 'right' }}>{paymentMethodSummary.card.count} ks</td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paymentMethodSummary.card.aov.toFixed(0)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                    {paymentMethodSummary.card.total.toFixed(0)} Kč
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {totalRevenue > 0 ? ((paymentMethodSummary.card.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', textAlign: 'left' }}>
                    <Receipt size={15} style={{ color: 'var(--accent-amber)' }} /> {t('payment.qr')}
                  </td>
                  <td style={{ textAlign: 'right' }}>{paymentMethodSummary.qr.count} ks</td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paymentMethodSummary.qr.aov.toFixed(0)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                    {paymentMethodSummary.qr.total.toFixed(0)} Kč
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {totalRevenue > 0 ? ((paymentMethodSummary.qr.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                {paymentMethodSummary.other?.count > 0 && (
                  <tr>
                    <td style={{ fontWeight: '700', textAlign: 'left' }}>{t('history.payment_other')}</td>
                    <td style={{ textAlign: 'right' }}>{paymentMethodSummary.other.count} ks</td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paymentMethodSummary.other.aov.toFixed(0)} Kč</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                      {paymentMethodSummary.other.total.toFixed(0)} Kč
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {totalRevenue > 0 ? ((paymentMethodSummary.other.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekday Breakdown Panel */}
        {dayOfWeekSummary && (
          <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={18} style={{ color: 'var(--accent-indigo, #6366f1)' }} />
              <span>Tržby podle Dní v Týdnu</span>
            </h3>

            <div style={{ flex: 1, overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Den</th>
                    <th style={{ textAlign: 'right' }}>Počet prodejů</th>
                    <th style={{ textAlign: 'right' }}>Tržba (Kč)</th>
                  </tr>
                </thead>
                <tbody>
                  {dayOfWeekSummary.map(d => (
                    <tr key={d.day}>
                      <td style={{ fontWeight: '700', textAlign: 'left' }}>{d.name}</td>
                      <td style={{ textAlign: 'right' }}>{d.count}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                        {d.total.toFixed(0)} Kč
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
