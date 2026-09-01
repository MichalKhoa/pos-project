import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function SalesPeriodBar({
  periodFilter,
  onSelectPreset,
  periodBadgeLabel,
  onStepPeriod,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  onOpenCalendar,
  onOpenRangeModal,
  totalMatchingSales
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Preset Filter Chips & Stepper */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: 'var(--bg-card)',
        padding: '0.65rem 1rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)'
      }}>
        {/* Chips row */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className={`nav-tab ${periodFilter === 'today' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => onSelectPreset('today')}
          >
            {t('history.period_today')}
          </button>

          <button
            className={`nav-tab ${periodFilter === 'yesterday' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => onSelectPreset('yesterday')}
          >
            {t('history.period_yesterday')}
          </button>

          <button
            className={`nav-tab ${periodFilter === 'week' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => onSelectPreset('week')}
          >
            {t('history.period_week')}
          </button>

          <button
            className={`nav-tab ${periodFilter === 'month' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => onSelectPreset('month')}
          >
            {t('history.period_month')}
          </button>

          <button
            className={`nav-tab ${periodFilter === 'year' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => onSelectPreset('year')}
          >
            {t('history.period_year')}
          </button>

          <button
            className={`nav-tab ${periodFilter === 'all' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => onSelectPreset('all')}
          >
            {t('history.all_period')}
          </button>

          <button
            className={`nav-tab ${periodFilter === 'custom' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => onSelectPreset('custom')}
          >
            <Filter size={14} />
            <span>{t('history.custom_date')}</span>
          </button>
        </div>

        {/* Stepper Controls (‹ Date Badge ›) */}
        {periodFilter !== 'all' && periodFilter !== 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-input)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <button
              className="nav-tab"
              style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)' }}
              onClick={() => onStepPeriod('prev')}
              title={t('history.prev_period')}
            >
              <ChevronLeft size={18} />
            </button>

            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0 0.5rem', cursor: 'pointer' }}
              onClick={() => onOpenCalendar('reference')}
              title="Přejít na přesné datum v kalendáři"
            >
              <Calendar size={16} style={{ color: 'var(--accent-emerald)' }} />
              <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {periodBadgeLabel}
              </span>
            </div>

            <button
              className="nav-tab"
              style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)' }}
              onClick={() => onStepPeriod('next')}
              title={t('history.next_period')}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Custom Date Range Picker Block */}
      {periodFilter === 'custom' && (
        <div style={{
          background: 'var(--bg-card)',
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--accent-blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary-btn"
              onClick={onOpenRangeModal}
              style={{
                padding: '0.55rem 1rem',
                background: 'var(--accent-blue)',
                color: '#ffffff',
                borderRadius: 'var(--radius-md)',
                fontWeight: '800',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                border: 'none',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Calendar size={18} />
              <span>Vybrat Rozsah Dat (Vedle Sebe)</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="nav-tab"
                onClick={() => onOpenCalendar('from')}
                style={{
                  padding: '0.45rem 0.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.88rem',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                <span>OD: {fromDate ? fromDate.split('-').reverse().join('. ') : 'Vybrat'}</span>
              </button>

              <span style={{ color: 'var(--text-muted)', fontWeight: '800' }}>➔</span>

              <button
                type="button"
                className="nav-tab"
                onClick={() => onOpenCalendar('to')}
                style={{
                  padding: '0.45rem 0.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--accent-purple)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.88rem',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                <span>DO: {toDate ? toDate.split('-').reverse().join('. ') : 'Vybrat'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="nav-tab"
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
              onClick={() => {
                const today = new Date();
                const d = new Date();
                d.setDate(d.getDate() - 6);
                setFromDate(d.toISOString().slice(0, 10));
                setToDate(today.toISOString().slice(0, 10));
              }}
            >
              Posledních 7 dní
            </button>

            <button
              className="nav-tab"
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
              onClick={() => {
                const today = new Date();
                const d = new Date();
                d.setDate(d.getDate() - 29);
                setFromDate(d.toISOString().slice(0, 10));
                setToDate(today.toISOString().slice(0, 10));
              }}
            >
              Posledních 30 dní
            </button>

            <button
              className="nav-tab"
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
              onClick={() => {
                const today = new Date();
                const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                setFromDate(firstOfLastMonth.toISOString().slice(0, 10));
                setToDate(lastOfLastMonth.toISOString().slice(0, 10));
              }}
            >
              Minulý měsíc
            </button>
          </div>

          <span className="status-badge" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', fontWeight: '800', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            {totalMatchingSales} transakcí
          </span>
        </div>
      )}
    </div>
  );
}
