import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check, RotateCcw } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

const CZECH_MONTHS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

const WEEKDAY_NAMES = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export default function TouchDateRangeModal({
  isOpen,
  onClose,
  initialFromDate, // YYYY-MM-DD
  initialToDate,   // YYYY-MM-DD
  onConfirmRange,
  title = 'Vyberte Rozsah Dat (OD – DO)'
}) {
  const { t } = useTranslation();

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // Parse initial dates
  const defaultFrom = initialFromDate || todayIso;
  const defaultTo = initialToDate || todayIso;

  const [startDateIso, setStartDateIso] = useState(defaultFrom);
  const [endDateIso, setEndDateIso] = useState(defaultTo);
  const [pickingState, setPickingState] = useState('start'); // 'start' | 'end'

  // View state for Left Calendar (Right calendar is viewMonth + 1)
  const [viewYear, setViewYear] = useState(() => {
    const y = parseInt(defaultFrom.split('-')[0], 10);
    return isNaN(y) ? today.getFullYear() : y;
  });

  const [viewMonth, setViewMonth] = useState(() => {
    const m = parseInt(defaultFrom.split('-')[1], 10) - 1;
    return isNaN(m) ? today.getMonth() : m;
  });

  // View modes for direct pickers: 'days' | 'months' | 'years'
  const [leftViewMode, setLeftViewMode] = useState('days');
  const [rightViewMode, setRightViewMode] = useState('days');

  useEffect(() => {
    if (isOpen) {
      setStartDateIso(initialFromDate || todayIso);
      setEndDateIso(initialToDate || todayIso);
      setPickingState('start');
      setLeftViewMode('days');
      setRightViewMode('days');

      if (initialFromDate) {
        const parts = initialFromDate.split('-');
        if (parts.length === 3) {
          setViewYear(parseInt(parts[0], 10));
          setViewMonth(parseInt(parts[1], 10) - 1);
        }
      }
    }
  }, [isOpen, initialFromDate, initialToDate, todayIso]);

  if (!isOpen) return null;

  // Calculate Right Calendar Year & Month
  const rightMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const rightYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  // Navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Range Day Click Handler
  const handleDayClick = (clickedIso) => {
    if (!startDateIso || (startDateIso && endDateIso) || clickedIso < startDateIso) {
      // Start new range selection
      setStartDateIso(clickedIso);
      setEndDateIso(null);
      setPickingState('end');
    } else {
      // Complete range selection
      setEndDateIso(clickedIso);
      setPickingState('start');
    }
  };

  // Shortcut Presets
  const applyPreset = (type) => {
    const now = new Date();
    const nowIso = now.toISOString().slice(0, 10);

    if (type === 'today') {
      setStartDateIso(nowIso);
      setEndDateIso(nowIso);
    } else if (type === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yIso = y.toISOString().slice(0, 10);
      setStartDateIso(yIso);
      setEndDateIso(yIso);
    } else if (type === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDateIso(d.toISOString().slice(0, 10));
      setEndDateIso(nowIso);
    } else if (type === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setStartDateIso(d.toISOString().slice(0, 10));
      setEndDateIso(nowIso);
    } else if (type === 'thisMonth') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setStartDateIso(first);
      setEndDateIso(nowIso);
    } else if (type === 'lastMonth') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      setStartDateIso(first);
      setEndDateIso(last);
    }
    setPickingState('start');
  };

  // Helper to build 7x6 day grid cells for given year & month
  const buildCalendarGrid = (yr, mo) => {
    const cells = [];
    const firstDay = new Date(yr, mo, 1);
    const daysInActive = new Date(yr, mo + 1, 0).getDate();
    const daysInPrev = new Date(yr, mo, 0).getDate();

    let dayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
    let leadCount = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // 1. Prev month
    for (let i = leadCount - 1; i >= 0; i--) {
      const prevDay = daysInPrev - i;
      const prevMo = mo === 0 ? 11 : mo - 1;
      const prevYr = mo === 0 ? yr - 1 : yr;
      const iso = `${prevYr}-${(prevMo + 1).toString().padStart(2, '0')}-${prevDay.toString().padStart(2, '0')}`;
      cells.push({ type: 'prev', day: prevDay, month: prevMo, year: prevYr, iso });
    }

    // 2. Current month
    for (let d = 1; d <= daysInActive; d++) {
      const iso = `${yr}-${(mo + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      cells.push({ type: 'current', day: d, month: mo, year: yr, iso });
    }

    // 3. Next month fill to 42
    const fillCount = 42 - cells.length;
    for (let n = 1; n <= fillCount; n++) {
      const nextMo = mo === 11 ? 0 : mo + 1;
      const nextYr = mo === 11 ? yr + 1 : yr;
      const iso = `${nextYr}-${(nextMo + 1).toString().padStart(2, '0')}-${n.toString().padStart(2, '0')}`;
      cells.push({ type: 'next', day: n, month: nextMo, year: nextYr, iso });
    }

    return cells;
  };

  const leftCells = buildCalendarGrid(viewYear, viewMonth);
  const rightCells = buildCalendarGrid(rightYear, rightMonth);

  const yearRange = Array.from({ length: 11 }, (_, i) => 2020 + i);

  // Helper to determine day styling in range selection
  const getDayStyle = (cellIso, isCurrentMonth) => {
    const isStart = cellIso === startDateIso;
    const isEnd = cellIso === endDateIso;
    const isInRange = startDateIso && endDateIso && cellIso > startDateIso && cellIso < endDateIso;
    const isToday = cellIso === todayIso;

    if (isStart) {
      return {
        background: 'var(--accent-emerald)',
        color: '#ffffff',
        fontWeight: '800',
        border: '2px solid var(--accent-emerald)',
        boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)'
      };
    }
    if (isEnd) {
      return {
        background: 'var(--accent-purple)',
        color: '#ffffff',
        fontWeight: '800',
        border: '2px solid var(--accent-purple)',
        boxShadow: '0 0 10px rgba(168, 85, 247, 0.4)'
      };
    }
    if (isInRange) {
      return {
        background: 'rgba(59, 130, 246, 0.22)',
        color: 'var(--text-primary)',
        fontWeight: '700',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        borderRadius: '0px'
      };
    }
    if (isToday) {
      return {
        background: isCurrentMonth ? 'var(--bg-input)' : 'transparent',
        color: 'var(--accent-blue)',
        fontWeight: '800',
        border: '2px solid var(--accent-blue)'
      };
    }
    return {
      background: isCurrentMonth ? 'var(--bg-input)' : 'rgba(255, 255, 255, 0.02)',
      color: isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
      fontWeight: '600',
      border: '1px solid var(--border-color)'
    };
  };

  const formatIsoDisplay = (iso) => {
    if (!iso) return 'Vyberte';
    const parts = iso.split('-');
    return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
  };

  const handleSave = () => {
    if (!startDateIso) return;
    const finalTo = endDateIso || startDateIso;
    onConfirmRange(startDateIso, finalTo);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
    >
      <div
        className="modal-container"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          maxWidth: '860px',
          width: '98%',
          padding: '1.6rem',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.15rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
            <Calendar size={22} />
            <span>{title}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              color: 'var(--text-muted)',
              padding: '0.45rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Range Presets Bar */}
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-input)', padding: '0.55rem 0.85rem', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '0.3rem' }}>
            Rychlé volby:
          </span>
          <button type="button" className="nav-tab" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => applyPreset('today')}>Dnes</button>
          <button type="button" className="nav-tab" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => applyPreset('yesterday')}>Včera</button>
          <button type="button" className="nav-tab" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => applyPreset('7days')}>Posledních 7 dní</button>
          <button type="button" className="nav-tab" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => applyPreset('30days')}>Posledních 30 dní</button>
          <button type="button" className="nav-tab" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => applyPreset('thisMonth')}>Tento měsíc</button>
          <button type="button" className="nav-tab" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => applyPreset('lastMonth')}>Minulý měsíc</button>
        </div>

        {/* Dual Side-by-Side Calendars Container */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {/* Left Calendar (Start Month) */}
          <div style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '0.9rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            {/* Header Stepper Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <button type="button" className="nav-tab" style={{ padding: '0.35rem 0.65rem' }} onClick={handlePrevMonth}>
                <ChevronLeft size={18} />
              </button>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setLeftViewMode(prev => prev === 'months' ? 'days' : 'months')}
                  style={{ padding: '0.3rem 0.6rem', fontWeight: '800', color: 'var(--accent-blue)' }}
                >
                  {CZECH_MONTHS[viewMonth]}
                </button>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setLeftViewMode(prev => prev === 'years' ? 'days' : 'years')}
                  style={{ padding: '0.3rem 0.6rem', fontWeight: '800', color: 'var(--accent-purple)' }}
                >
                  {viewYear}
                </button>
              </div>

              <div style={{ width: '32px' }} /> {/* Spacer */}
            </div>

            {leftViewMode === 'months' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {CZECH_MONTHS.map((m, idx) => (
                  <button key={m} type="button" className="nav-tab" style={{ height: '44px', fontWeight: '800' }} onClick={() => { setViewMonth(idx); setLeftViewMode('days'); }}>
                    {m}
                  </button>
                ))}
              </div>
            )}

            {leftViewMode === 'years' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {yearRange.map(yr => (
                  <button key={yr} type="button" className="nav-tab" style={{ height: '44px', fontWeight: '800' }} onClick={() => { setViewYear(yr); setLeftViewMode('days'); }}>
                    {yr}
                  </button>
                ))}
              </div>
            )}

            {leftViewMode === 'days' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', marginBottom: '0.4rem', textAlign: 'center' }}>
                  {WEEKDAY_NAMES.map(w => <div key={w} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>{w}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                  {leftCells.map((cell, idx) => (
                    <button
                      key={`left-${cell.iso}-${idx}`}
                      type="button"
                      onClick={() => handleDayClick(cell.iso)}
                      style={{
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                        ...getDayStyle(cell.iso, cell.type === 'current')
                      }}
                    >
                      {cell.day}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Calendar (Next Month) */}
          <div style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '0.9rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            {/* Header Stepper Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ width: '32px' }} /> {/* Spacer */}

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setRightViewMode(prev => prev === 'months' ? 'days' : 'months')}
                  style={{ padding: '0.3rem 0.6rem', fontWeight: '800', color: 'var(--accent-blue)' }}
                >
                  {CZECH_MONTHS[rightMonth]}
                </button>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setRightViewMode(prev => prev === 'years' ? 'days' : 'years')}
                  style={{ padding: '0.3rem 0.6rem', fontWeight: '800', color: 'var(--accent-purple)' }}
                >
                  {rightYear}
                </button>
              </div>

              <button type="button" className="nav-tab" style={{ padding: '0.35rem 0.65rem' }} onClick={handleNextMonth}>
                <ChevronRight size={18} />
              </button>
            </div>

            {rightViewMode === 'months' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {CZECH_MONTHS.map((m, idx) => (
                  <button key={m} type="button" className="nav-tab" style={{ height: '44px', fontWeight: '800' }} onClick={() => { setViewMonth(idx === 0 ? 11 : idx - 1); setRightViewMode('days'); }}>
                    {m}
                  </button>
                ))}
              </div>
            )}

            {rightViewMode === 'years' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {yearRange.map(yr => (
                  <button key={yr} type="button" className="nav-tab" style={{ height: '44px', fontWeight: '800' }} onClick={() => { setViewYear(yr); setRightViewMode('days'); }}>
                    {yr}
                  </button>
                ))}
              </div>
            )}

            {rightViewMode === 'days' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', marginBottom: '0.4rem', textAlign: 'center' }}>
                  {WEEKDAY_NAMES.map(w => <div key={w} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>{w}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                  {rightCells.map((cell, idx) => (
                    <button
                      key={`right-${cell.iso}-${idx}`}
                      type="button"
                      onClick={() => handleDayClick(cell.iso)}
                      style={{
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                        ...getDayStyle(cell.iso, cell.type === 'current')
                      }}
                    >
                      {cell.day}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions & Range Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          {/* Formatted Selected Range Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.95rem', fontWeight: '800' }}>
            <span style={{ color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.12)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              OD: {formatIsoDisplay(startDateIso)}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>➔</span>
            <span style={{ color: 'var(--accent-purple)', background: 'rgba(168, 85, 247, 0.12)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              DO: {formatIsoDisplay(endDateIso || startDateIso)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="nav-tab"
              onClick={onClose}
              style={{ padding: '0.65rem 1.25rem', fontWeight: '700' }}
            >
              Zrušit
            </button>

            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '0.65rem 1.5rem',
                fontWeight: '800',
                fontSize: '1rem',
                background: 'var(--accent-emerald)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Check size={18} />
              <span>Potvrdit Rozsah</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
