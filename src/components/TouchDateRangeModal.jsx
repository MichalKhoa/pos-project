import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check, Sparkles } from 'lucide-react';


import { CZECH_MONTHS, WEEKDAY_NAMES, buildCalendarGrid, stepMonth } from '../utils/calendarGrid.js';

export default function TouchDateRangeModal({
  isOpen,
  onClose,
  initialFromDate, // YYYY-MM-DD
  initialToDate,   // YYYY-MM-DD
  onConfirmRange,
  title = 'Vyberte Rozsah Dat (OD – DO)'
}) {

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const defaultFrom = initialFromDate || todayIso;
  const defaultTo = initialToDate || todayIso;

  const [startDateIso, setStartDateIso] = useState(defaultFrom);
  const [endDateIso, setEndDateIso] = useState(defaultTo);
  const [, setPickingState] = useState('start');

  const [viewYear, setViewYear] = useState(() => {
    const y = parseInt(defaultFrom.split('-')[0], 10);
    return isNaN(y) ? today.getFullYear() : y;
  });

  const [viewMonth, setViewMonth] = useState(() => {
    const m = parseInt(defaultFrom.split('-')[1], 10) - 1;
    return isNaN(m) ? today.getMonth() : m;
  });

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

  const rightMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const rightYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  const handlePrevMonth = () => {
    const next = stepMonth(viewYear, viewMonth, 'prev');
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const handleNextMonth = () => {
    const next = stepMonth(viewYear, viewMonth, 'next');
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const handleDayClick = (clickedIso) => {
    if (!startDateIso || (startDateIso && endDateIso) || clickedIso < startDateIso) {
      setStartDateIso(clickedIso);
      setEndDateIso(null);
      setPickingState('end');
    } else {
      setEndDateIso(clickedIso);
      setPickingState('start');
    }
  };

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

  const leftCells = buildCalendarGrid(viewYear, viewMonth);
  const rightCells = buildCalendarGrid(rightYear, rightMonth);

  const yearRange = Array.from({ length: 11 }, (_, i) => 2020 + i);

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
        boxShadow: 'var(--shadow-glow)'
      };
    }
    if (isEnd) {
      return {
        background: 'var(--accent-purple)',
        color: '#ffffff',
        fontWeight: '800',
        border: '2px solid var(--accent-purple)',
        boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)'
      };
    }
    if (isInRange) {
      return {
        background: 'rgba(59, 130, 246, 0.12)',
        color: 'var(--accent-blue)',
        fontWeight: '700',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        borderRadius: '0px'
      };
    }
    if (isToday) {
      return {
        background: 'var(--bg-input)',
        color: 'var(--accent-blue)',
        fontWeight: '800',
        border: '2px solid var(--accent-blue)'
      };
    }
    return {
      background: isCurrentMonth ? 'var(--bg-card)' : 'var(--bg-input)',
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
        background: 'rgba(0, 0, 0, 0.65)',
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
          border: '2px solid var(--accent-blue)',
          borderRadius: '24px',
          maxWidth: '860px',
          width: '98%',
          padding: '1.6rem',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem',
          color: 'var(--text-primary)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
            <Calendar size={22} />
            <span style={{ letterSpacing: '-0.01em' }}>{title}</span>
          </div>

          <button
            type="button"
            className="nav-tab"
            onClick={onClose}
            style={{
              padding: '0.45rem',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Range Presets Bar */}
        <div style={{
          display: 'flex',
          gap: '0.45rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          padding: '0.6rem 0.85rem',
          borderRadius: '16px'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Sparkles size={13} style={{ color: 'var(--accent-blue)' }} />
            Rychlé volby:
          </span>
          {[
            { label: 'Dnes', key: 'today' },
            { label: 'Včera', key: 'yesterday' },
            { label: 'Posledních 7 dní', key: '7days' },
            { label: 'Posledních 30 dní', key: '30days' },
            { label: 'Tento měsíc', key: 'thisMonth' },
            { label: 'Minulý měsíc', key: 'lastMonth' }
          ].map(p => (
            <button
              key={p.key}
              type="button"
              className="nav-tab"
              onClick={() => applyPreset(p.key)}
              style={{
                padding: '0.35rem 0.7rem',
                fontSize: '0.82rem',
                fontWeight: '700',
                borderRadius: '8px'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Dual Side-by-Side Calendars Container */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {/* Left Calendar (Start Month) */}
          <div style={{
            background: 'var(--bg-input)',
            padding: '1rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color)'
          }}>
            {/* Header Stepper Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              marginBottom: '0.9rem',
              background: 'var(--bg-card)',
              padding: '0.4rem 0.6rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                className="nav-tab"
                onClick={handlePrevMonth}
                style={{ padding: '0.3rem 0.5rem', borderRadius: '6px' }}
              >
                <ChevronLeft size={20} />
              </button>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setLeftViewMode(prev => prev === 'months' ? 'days' : 'months')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    color: 'var(--accent-blue)',
                    borderColor: 'var(--accent-blue)'
                  }}
                >
                  {CZECH_MONTHS[viewMonth]}
                </button>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setLeftViewMode(prev => prev === 'years' ? 'days' : 'years')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    color: 'var(--accent-purple)',
                    borderColor: 'var(--accent-purple)'
                  }}
                >
                  {viewYear}
                </button>
              </div>

              <div style={{ width: '32px' }} />
            </div>

            {leftViewMode === 'months' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
                {CZECH_MONTHS.map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    className="nav-tab"
                    onClick={() => { setViewMonth(idx); setLeftViewMode('days'); }}
                    style={{
                      height: '44px',
                      fontWeight: '800',
                      background: idx === viewMonth ? 'var(--accent-blue)' : 'var(--bg-card)',
                      color: idx === viewMonth ? '#ffffff' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {leftViewMode === 'years' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
                {yearRange.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    className="nav-tab"
                    onClick={() => { setViewYear(yr); setLeftViewMode('days'); }}
                    style={{
                      height: '44px',
                      fontWeight: '800',
                      background: yr === viewYear ? 'var(--accent-purple)' : 'var(--bg-card)',
                      color: yr === viewYear ? '#ffffff' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            )}

            {leftViewMode === 'days' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', marginBottom: '0.45rem', textAlign: 'center' }}>
                  {WEEKDAY_NAMES.map(w => <div key={w} style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)' }}>{w}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                  {leftCells.map((cell, idx) => (
                    <button
                      key={`left-${cell.iso}-${idx}`}
                      type="button"
                      onClick={() => handleDayClick(cell.iso)}
                      style={{
                        height: '42px',
                        borderRadius: '8px',
                        fontSize: '0.92rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
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
          <div style={{
            background: 'var(--bg-input)',
            padding: '1rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color)'
          }}>
            {/* Header Stepper Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              marginBottom: '0.9rem',
              background: 'var(--bg-card)',
              padding: '0.4rem 0.6rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ width: '32px' }} />

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setRightViewMode(prev => prev === 'months' ? 'days' : 'months')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    color: 'var(--accent-blue)',
                    borderColor: 'var(--accent-blue)'
                  }}
                >
                  {CZECH_MONTHS[rightMonth]}
                </button>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setRightViewMode(prev => prev === 'years' ? 'days' : 'years')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    color: 'var(--accent-purple)',
                    borderColor: 'var(--accent-purple)'
                  }}
                >
                  {rightYear}
                </button>
              </div>

              <button
                type="button"
                className="nav-tab"
                onClick={handleNextMonth}
                style={{ padding: '0.3rem 0.5rem', borderRadius: '6px' }}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {rightViewMode === 'months' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
                {CZECH_MONTHS.map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    className="nav-tab"
                    onClick={() => { setViewMonth(idx === 0 ? 11 : idx - 1); setRightViewMode('days'); }}
                    style={{
                      height: '44px',
                      fontWeight: '800',
                      background: idx === rightMonth ? 'var(--accent-blue)' : 'var(--bg-card)',
                      color: idx === rightMonth ? '#ffffff' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {rightViewMode === 'years' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
                {yearRange.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    className="nav-tab"
                    onClick={() => { setViewYear(yr); setRightViewMode('days'); }}
                    style={{
                      height: '44px',
                      fontWeight: '800',
                      background: yr === rightYear ? 'var(--accent-purple)' : 'var(--bg-card)',
                      color: yr === rightYear ? '#ffffff' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            )}

            {rightViewMode === 'days' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', marginBottom: '0.45rem', textAlign: 'center' }}>
                  {WEEKDAY_NAMES.map(w => <div key={w} style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)' }}>{w}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                  {rightCells.map((cell, idx) => (
                    <button
                      key={`right-${cell.iso}-${idx}`}
                      type="button"
                      onClick={() => handleDayClick(cell.iso)}
                      style={{
                        height: '42px',
                        borderRadius: '8px',
                        fontSize: '0.92rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
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

        {/* Bottom Actions & Selected Range Display */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.95rem', fontWeight: '800' }}>
            <span style={{ color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.12)', padding: '0.4rem 0.75rem', borderRadius: '10px', border: '1px solid var(--accent-emerald)' }}>
              OD: {formatIsoDisplay(startDateIso)}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>➔</span>
            <span style={{ color: 'var(--accent-purple)', background: 'rgba(168, 85, 247, 0.12)', padding: '0.4rem 0.75rem', borderRadius: '10px', border: '1px solid var(--accent-purple)' }}>
              DO: {formatIsoDisplay(endDateIso || startDateIso)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="nav-tab"
              onClick={onClose}
              style={{
                padding: '0.7rem 1.4rem',
                fontWeight: '700',
                borderRadius: '12px'
              }}
            >
              Zrušit
            </button>

            <button
              type="button"
              className="primary-btn"
              onClick={handleSave}
              style={{
                padding: '0.7rem 1.75rem',
                fontWeight: '800',
                fontSize: '1rem',
                background: 'var(--accent-emerald)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-glow)'
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
