import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, RotateCcw, Check, Grid } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

const CZECH_MONTHS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

const WEEKDAY_NAMES = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export default function TouchCalendarModal({
  isOpen,
  onClose,
  initialDate, // YYYY-MM-DD format
  onConfirm,
  title = 'Vyberte Datum'
}) {
  const { t, language } = useTranslation();

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // Parse initial date
  const parsedInitial = useMemo(() => {
    if (initialDate && initialDate.length === 10) {
      const parts = initialDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return { year: y, month: m, day: d, iso: initialDate };
        }
      }
    }
    return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate(), iso: todayIso };
  }, [initialDate, todayIso]);

  const [viewYear, setViewYear] = useState(parsedInitial.year);
  const [viewMonth, setViewMonth] = useState(parsedInitial.month);
  const [selectedIso, setSelectedIso] = useState(parsedInitial.iso);
  const [viewMode, setViewMode] = useState('days'); // 'days' | 'months' | 'years'

  useEffect(() => {
    if (isOpen) {
      setViewYear(parsedInitial.year);
      setViewMonth(parsedInitial.month);
      setSelectedIso(parsedInitial.iso);
      setViewMode('days');
    }
  }, [isOpen, parsedInitial]);

  if (!isOpen) return null;

  // Month Stepper helpers
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

  // Select day
  const handleSelectDay = (year, month, day) => {
    const formattedMm = (month + 1).toString().padStart(2, '0');
    const formattedDd = day.toString().padStart(2, '0');
    const iso = `${year}-${formattedMm}-${formattedDd}`;
    setSelectedIso(iso);
    onConfirm(iso);
    onClose();
  };

  // Jump to Today
  const handleSelectToday = () => {
    setSelectedIso(todayIso);
    onConfirm(todayIso);
    onClose();
  };

  // Calculate 7x6 Calendar Grid cells (Monday to Sunday)
  const calendarGridCells = () => {
    const cells = [];
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInActiveMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    let dayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    let leadDaysCount = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // 1. Leading days from previous month
    for (let i = leadDaysCount - 1; i >= 0; i--) {
      const prevDayNum = daysInPrevMonth - i;
      const prevMonthNum = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYearNum = viewMonth === 0 ? viewYear - 1 : viewYear;
      const iso = `${prevYearNum}-${(prevMonthNum + 1).toString().padStart(2, '0')}-${prevDayNum.toString().padStart(2, '0')}`;

      cells.push({
        type: 'prev',
        day: prevDayNum,
        month: prevMonthNum,
        year: prevYearNum,
        iso
      });
    }

    // 2. Current Month days
    for (let d = 1; d <= daysInActiveMonth; d++) {
      const iso = `${viewYear}-${(viewMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      cells.push({
        type: 'current',
        day: d,
        month: viewMonth,
        year: viewYear,
        iso
      });
    }

    // 3. Trailing days from next month to fill 42 cells (6 rows x 7 cols)
    const remainingCount = 42 - cells.length;
    for (let n = 1; n <= remainingCount; n++) {
      const nextMonthNum = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYearNum = viewMonth === 11 ? viewYear + 1 : viewYear;
      const iso = `${nextYearNum}-${(nextMonthNum + 1).toString().padStart(2, '0')}-${n.toString().padStart(2, '0')}`;

      cells.push({
        type: 'next',
        day: n,
        month: nextMonthNum,
        year: nextYearNum,
        iso
      });
    }

    return cells;
  };

  const cells = calendarGridCells();

  // Generate Year picker range (2020 through 2030)
  const yearRange = Array.from({ length: 11 }, (_, i) => 2020 + i);

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
        background: 'rgba(0, 0, 0, 0.75)',
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
          maxWidth: '440px',
          width: '100%',
          padding: '1.6rem',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
            <Calendar size={20} />
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
              padding: '0.4rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Month & Year Navigation Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          background: 'var(--bg-input)',
          padding: '0.45rem 0.65rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            type="button"
            className="nav-tab"
            onClick={handlePrevMonth}
            style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)' }}
            title="Předchozí měsíc"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Clickable Month & Year Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              className="nav-tab"
              onClick={() => setViewMode(prev => prev === 'months' ? 'days' : 'months')}
              style={{
                padding: '0.35rem 0.7rem',
                fontSize: '1rem',
                fontWeight: '800',
                color: viewMode === 'months' ? 'var(--accent-blue)' : 'var(--text-primary)',
                background: viewMode === 'months' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                borderRadius: 'var(--radius-md)'
              }}
              title="Zobrazit výběr měsíců"
            >
              {CZECH_MONTHS[viewMonth]}
            </button>

            <button
              type="button"
              className="nav-tab"
              onClick={() => setViewMode(prev => prev === 'years' ? 'days' : 'years')}
              style={{
                padding: '0.35rem 0.7rem',
                fontSize: '1rem',
                fontWeight: '800',
                color: viewMode === 'years' ? 'var(--accent-purple)' : 'var(--text-primary)',
                background: viewMode === 'years' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                borderRadius: 'var(--radius-md)'
              }}
              title="Zobrazit výběr roků"
            >
              {viewYear}
            </button>
          </div>

          <button
            type="button"
            className="nav-tab"
            onClick={handleNextMonth}
            style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)' }}
            title="Následující měsíc"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 1. Month Picker Touch Grid Sub-View */}
        {viewMode === 'months' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', padding: '0.4rem 0' }}>
            {CZECH_MONTHS.map((monthName, idx) => (
              <button
                key={monthName}
                type="button"
                className="nav-tab"
                onClick={() => {
                  setViewMonth(idx);
                  setViewMode('days');
                }}
                style={{
                  height: '52px',
                  fontSize: '0.95rem',
                  fontWeight: '800',
                  background: idx === viewMonth ? 'var(--accent-blue)' : 'var(--bg-card)',
                  color: idx === viewMonth ? '#ffffff' : 'var(--text-primary)',
                  border: idx === viewMonth ? 'none' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                {monthName}
              </button>
            ))}
          </div>
        )}

        {/* 2. Year Picker Touch Grid Sub-View */}
        {viewMode === 'years' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', padding: '0.4rem 0' }}>
            {yearRange.map(yr => (
              <button
                key={yr}
                type="button"
                className="nav-tab"
                onClick={() => {
                  setViewYear(yr);
                  setViewMode('days');
                }}
                style={{
                  height: '52px',
                  fontSize: '1.05rem',
                  fontWeight: '800',
                  background: yr === viewYear ? 'var(--accent-purple)' : 'var(--bg-card)',
                  color: yr === viewYear ? '#ffffff' : 'var(--text-primary)',
                  border: yr === viewYear ? 'none' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                {yr}
              </button>
            ))}
          </div>
        )}

        {/* 3. Standard 7x6 Touch Day Grid Sub-View */}
        {viewMode === 'days' && (
          <div>
            {/* Weekday Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', marginBottom: '0.5rem', textAlign: 'center' }}>
              {WEEKDAY_NAMES.map(w => (
                <div key={w} style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>
                  {w}
                </div>
              ))}
            </div>

            {/* 7x6 Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
              {cells.map((cell, idx) => {
                const isSelected = cell.iso === selectedIso;
                const isToday = cell.iso === todayIso;
                const isCurrentMonth = cell.type === 'current';

                return (
                  <button
                    key={`${cell.iso}-${idx}`}
                    type="button"
                    onClick={() => handleSelectDay(cell.year, cell.month, cell.day)}
                    style={{
                      height: '46px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected
                        ? '2px solid var(--accent-emerald)'
                        : isToday
                        ? '2px solid var(--accent-blue)'
                        : '1px solid var(--border-color)',
                      background: isSelected
                        ? 'var(--accent-emerald)'
                        : isCurrentMonth
                        ? 'var(--bg-input)'
                        : 'rgba(255, 255, 255, 0.03)',
                      color: isSelected
                        ? '#ffffff'
                        : isCurrentMonth
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                      fontWeight: isSelected || isToday ? '800' : '600',
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 10px rgba(16, 185, 129, 0.35)' : 'none',
                      transition: 'all 0.1s ease'
                    }}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button
            type="button"
            className="nav-tab"
            onClick={handleSelectToday}
            style={{
              flex: 1,
              height: '44px',
              fontWeight: '800',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--accent-blue)',
              borderColor: 'rgba(59, 130, 246, 0.3)'
            }}
          >
            <Calendar size={16} />
            <span>Dnes</span>
          </button>

          <button
            type="button"
            className="nav-tab"
            onClick={onClose}
            style={{
              flex: 1,
              height: '44px',
              fontWeight: '700',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-input)',
              borderColor: 'var(--border-color)'
            }}
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
