import React from 'react';
import { DollarSign, Banknote, CreditCard, Receipt, BarChart3, PieChart, Flame, Trophy, Clock, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function SalesAnalyticsCharts({
  periodLabel,
  totalRevenue = 0,
  cashRevenue = 0,
  cardRevenue = 0,
  qrRevenue = 0,
  transactionCount = 0,
  avgOrderValue = 0,
  totalNetto = 0,
  totalVat = 0,
  periodTaxSummary,
  paymentMethodSummary,
  sortedCategories = [],
  topProducts = [],
  hourlySales = { hours: [], maxRevenue: 1, peakHour: null },
  refundMetrics = { count: 0, amount: 0 }
}) {
  const { t } = useTranslation();

  const cashPercent = totalRevenue > 0 ? (((paymentMethodSummary?.cash?.total || 0) / totalRevenue) * 100).toFixed(1) : '0.0';
  const cardPercent = totalRevenue > 0 ? (((paymentMethodSummary?.card?.total || 0) / totalRevenue) * 100).toFixed(1) : '0.0';
  const qrPercent = totalRevenue > 0 ? (((paymentMethodSummary?.qr?.total || 0) / totalRevenue) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Primary KPI Metrics (Single Unified Row) */}
      <div className="analytics-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {/* Total Revenue */}
        <div className="metric-card" style={{ padding: '0.85rem 1rem' }}>
          <div className="metric-header">
            <span>{t('analytics.gross_revenue') || 'Tržba s DPH'}</span>
            <div className="metric-icon" style={{ background: 'var(--accent-emerald)', color: '#ffffff' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-emerald)', fontSize: '1.4rem' }}>
            {totalRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('analytics.netto_base') || 'Základ'}: <strong style={{ color: 'var(--text-primary)' }}>{totalNetto.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč</strong>
          </div>
        </div>

        {/* Total VAT */}
        <div className="metric-card" style={{ padding: '0.85rem 1rem' }}>
          <div className="metric-header">
            <span>{t('analytics.vat_collected') || 'Vybraná DPH'}</span>
            <div className="metric-icon" style={{ background: 'var(--accent-purple)', color: '#ffffff' }}>
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-purple)', fontSize: '1.4rem' }}>
            {totalVat.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {periodLabel}
          </div>
        </div>

        {/* Transactions & AOV */}
        <div className="metric-card" style={{ padding: '0.85rem 1rem' }}>
          <div className="metric-header">
            <span>{t('history.txn_count') || 'Počet účtenek'}</span>
            <div className="metric-icon" style={{ background: 'var(--accent-blue)', color: '#ffffff' }}>
              <Receipt size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ fontSize: '1.4rem' }}>
            {transactionCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('shift_stats.receipts') || 'účtenek'}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('history.avg_receipt') || 'Průměr'}: <strong style={{ color: 'var(--accent-emerald)' }}>{avgOrderValue.toFixed(0)} Kč</strong>
          </div>
        </div>

        {/* Payment Split Preview */}
        <div className="metric-card" style={{ padding: '0.85rem 1rem' }}>
          <div className="metric-header">
            <span>{t('analytics.payment_split') || 'Platby'}</span>
            <div className="metric-icon" style={{ background: 'var(--accent-amber)', color: '#ffffff' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.15rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Banknote size={15} style={{ color: 'var(--accent-emerald)' }} /> {cashRevenue.toFixed(0)} Kč
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CreditCard size={15} style={{ color: 'var(--accent-blue)' }} /> {cardRevenue.toFixed(0)} Kč
            </span>
          </div>
          {refundMetrics.count > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
              <RotateCcw size={12} />
              <span>{refundMetrics.count} {t('history.refunds_only') || 'vratek'} (-{refundMetrics.amount.toFixed(0)} Kč)</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 1: Hourly Rush Hour Heatmap (Left) + Top Selling Products (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '0.75rem', alignItems: 'stretch' }}>
        {/* Hourly Rush Hour Heatmap */}
        <div className="table-card" style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Clock size={17} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('analytics.hourly_rush') || 'Špičky a tržby po hodinách'}</span>
            </h3>

            {hourlySales.peakHour && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: '800',
                color: 'var(--accent-amber)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <Flame size={13} />
                <span>{t('analytics.peak_hour') || 'Špička'}: {hourlySales.peakHour.label} ({hourlySales.peakHour.revenue.toFixed(0)} Kč)</span>
              </div>
            )}
          </div>

          {totalRevenue === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {t('analytics.no_hourly_data') || 'Ve zvoleném období nejsou data pro graf tržeb.'}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '140px' }}>
              {/* Bar Columns Container */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '4px', height: '120px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                {hourlySales.hours.map(h => {
                  const isPeak = hourlySales.peakHour && hourlySales.peakHour.hour === h.hour && h.revenue > 0;
                  const heightPercent = h.revenue > 0 ? Math.max(8, Math.round((h.revenue / hourlySales.maxRevenue) * 100)) : 4;

                  return (
                    <div
                      key={h.hour}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        justifyContent: 'flex-end',
                        position: 'relative'
                      }}
                      title={`${h.label}: ${h.revenue.toFixed(0)} Kč (${h.count} prodejů)`}
                    >
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '22px',
                          height: `${heightPercent}%`,
                          background: isPeak ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' : h.revenue > 0 ? 'linear-gradient(180deg, var(--accent-blue) 0%, #2563eb 100%)' : 'var(--bg-input)',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.3s ease',
                          boxShadow: isPeak ? '0 0 8px rgba(245, 158, 11, 0.5)' : 'none'
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Hour X-Axis Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>07:00</span>
                <span>10:00</span>
                <span>13:00</span>
                <span>16:00</span>
                <span>19:00</span>
                <span>22:00</span>
              </div>
            </div>
          )}
        </div>

        {/* Top Best-Selling Products */}
        <div className="table-card" style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Trophy size={17} style={{ color: 'var(--accent-amber)' }} />
            <span>{t('analytics.top_products') || 'Nejprodávanější položky'}</span>
          </h3>

          <div style={{ flex: 1, overflowX: 'auto' }}>
            {topProducts.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t('analytics.no_products_sold') || 'Ve zvoleném období nebyly prodány žádné položky.'}
              </div>
            ) : (
              <table className="data-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                    <th style={{ textAlign: 'left' }}>Položka</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>{t('analytics.sold_units') || 'Prodáno'}</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>{t('history.revenue') || 'Tržba'}</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>Podíl</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(p => {
                    const rankBadgeBg =
                      p.rank === 1 ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                      p.rank === 2 ? 'linear-gradient(135deg, #94a3b8, #64748b)' :
                      p.rank === 3 ? 'linear-gradient(135deg, #b45309, #78350f)' :
                      'var(--bg-input)';
                    const rankTextColor = p.rank <= 3 ? '#ffffff' : 'var(--text-muted)';

                    return (
                      <tr key={p.name}>
                        <td style={{ textAlign: 'center', padding: '0.35rem 0.4rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            borderRadius: 'var(--radius-full)',
                            background: rankBadgeBg,
                            color: rankTextColor,
                            fontSize: '0.72rem',
                            fontWeight: '900'
                          }}>
                            {p.rank}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left', fontWeight: '700', padding: '0.35rem 0.5rem' }}>
                          <div>{p.name}</div>
                          <div style={{ width: `${p.relativeBar}%`, height: '3px', background: 'var(--accent-emerald)', borderRadius: '2px', marginTop: '2px', opacity: 0.8 }} />
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>
                          <span style={{ background: 'var(--bg-input)', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', fontWeight: '700', fontSize: '0.75rem' }}>
                            {p.quantity} ks
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-emerald)', textAlign: 'right', padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>
                          {p.totalRevenue.toFixed(0)} Kč
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', padding: '0.35rem 0.5rem' }}>
                          {p.sharePercent}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Visual Payment Split & Category Shares (Left) + VAT Tax Table (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '0.75rem', alignItems: 'stretch' }}>
        {/* Payment Methods & Category Shares Panel */}
        <div className="table-card" style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <CreditCard size={17} style={{ color: 'var(--accent-emerald)' }} />
              <span>{t('analytics.payment_split') || 'Rozdělení plateb'}</span>
            </h3>

            {/* Stacked Payment Percentage Bar */}
            <div style={{ height: '14px', width: '100%', background: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden', display: 'flex', gap: '2px', marginBottom: '0.5rem' }}>
              <div style={{ width: `${cashPercent}%`, background: 'var(--accent-emerald)', height: '100%', transition: 'width 0.3s' }} title={`Hotovost: ${cashPercent}%`} />
              <div style={{ width: `${cardPercent}%`, background: 'var(--accent-blue)', height: '100%', transition: 'width 0.3s' }} title={`Karta: ${cardPercent}%`} />
              <div style={{ width: `${qrPercent}%`, background: 'var(--accent-amber)', height: '100%', transition: 'width 0.3s' }} title={`QR platba: ${qrPercent}%`} />
            </div>

            {/* Payment Method Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: 'var(--radius-full)', background: 'var(--accent-emerald)' }} />
                <span>{t('payment.cash')}: <strong>{cashRevenue.toFixed(0)} Kč</strong> ({cashPercent}%)</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: 'var(--radius-full)', background: 'var(--accent-blue)' }} />
                <span>{t('payment.card')}: <strong>{cardRevenue.toFixed(0)} Kč</strong> ({cardPercent}%)</span>
              </div>

              {parseFloat(qrPercent) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: 'var(--radius-full)', background: 'var(--accent-amber)' }} />
                  <span>QR: <strong>{qrRevenue.toFixed(0)} Kč</strong> ({qrPercent}%)</span>
                </div>
              )}
            </div>
          </div>

          {/* Category Sales Shares */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.65rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <PieChart size={15} style={{ color: 'var(--accent-purple)' }} />
              <span>{t('history.category_sales') || 'Tržby podle kategorií'}</span>
            </h4>

            {sortedCategories.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Žádné kategorie v období.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {sortedCategories.slice(0, 5).map(cat => {
                  const share = totalRevenue > 0 ? ((cat.total / totalRevenue) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={cat.category} style={{ fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '700', textTransform: 'capitalize' }}>{cat.category}</span>
                        <span>{cat.total.toFixed(0)} Kč <span style={{ color: 'var(--text-muted)' }}>({share}%)</span></span>
                      </div>
                      <div style={{ height: '4px', width: '100%', background: 'var(--bg-input)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${share}%`, height: '100%', background: 'var(--accent-purple)', borderRadius: '2px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* VAT Tax Summary Table */}
        <div className="table-card" style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <BarChart3 size={17} style={{ color: 'var(--accent-blue)' }} />
            <span>{t('analytics.vat_breakdown') || 'Rozpis DPH'} ({periodLabel})</span>
          </h3>

          <div style={{ flex: 1, overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Sazba DPH</th>
                  <th style={{ textAlign: 'right' }}>Základ (Netto)</th>
                  <th style={{ textAlign: 'right' }}>DPH</th>
                  <th style={{ textAlign: 'right' }}>Celkem s DPH</th>
                </tr>
              </thead>
              <tbody>
                {(periodTaxSummary ? Object.values(periodTaxSummary) : []).map(tItem => (
                  <tr key={tItem.rate}>
                    <td style={{ fontWeight: '700', textAlign: 'left' }}>{tItem.rate}%</td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{(tItem.net || 0).toFixed(2)} Kč</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: '700', textAlign: 'right' }}>
                      {(tItem.tax || 0).toFixed(2)} Kč
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                      {(tItem.gross || 0).toFixed(2)} Kč
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '800' }}>
                  <td style={{ textAlign: 'left' }}>CELKEM</td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{(totalNetto || 0).toFixed(2)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', textAlign: 'right' }}>{(totalVat || 0).toFixed(2)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', textAlign: 'right' }}>{(totalRevenue || 0).toFixed(2)} Kč</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
