import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Receipt, Banknote, CreditCard, RotateCcw, FileText, ArrowRight, Check, AlertOctagon, Info } from 'lucide-react';

const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

/**
 * Calculates Easter Sunday for a given year (Meeus/Jones/Butcher algorithm)
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Returns Czech Holiday information and Retail Closure Law (Zákon č. 223/2016 Sb.) status
 */
function getCzechHoliday(dateObj) {
  const d = dateObj.getDate();
  const m = dateObj.getMonth() + 1; // 1-12
  const y = dateObj.getFullYear();

  // Fixed Czech National Holidays
  if (m === 1 && d === 1) return { name: 'Den obnovy samostatného českého státu / Nový rok', isClosed: true };
  if (m === 5 && d === 1) return { name: 'Svátek práce', isClosed: false };
  if (m === 5 && d === 8) return { name: 'Den vítězství', isClosed: true };
  if (m === 7 && d === 5) return { name: 'Den slovanských věrozvěstů Cyrila a Metoděje', isClosed: false };
  if (m === 7 && d === 6) return { name: 'Den upálení mistra Jana Husa', isClosed: false };
  if (m === 9 && d === 28) return { name: 'Den české státnosti (svatý Václav)', isClosed: true };
  if (m === 10 && d === 28) return { name: 'Den vzniku samostatného československého státu', isClosed: true };
  if (m === 11 && d === 17) return { name: 'Den boje za svobodu a demokracii', isClosed: false };
  if (m === 12 && d === 24) return { name: 'Štědrý den (zákaz prodeje od 12:00)', isClosed: true, isHalfDay: true };
  if (m === 12 && d === 25) return { name: '1. svátek vánoční', isClosed: true };
  if (m === 12 && d === 26) return { name: '2. svátek vánoční', isClosed: true };

  // Dynamic Easter Holidays
  const easterSunday = getEasterSunday(y);

  // Good Friday = Easter Sunday - 2 days
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(easterSunday.getDate() - 2);
  if (goodFriday.getMonth() + 1 === m && goodFriday.getDate() === d) {
    return { name: 'Velký pátek', isClosed: false };
  }

  // Easter Monday = Easter Sunday + 1 day
  const easterMonday = new Date(easterSunday);
  easterMonday.setDate(easterSunday.getDate() + 1);
  if (easterMonday.getMonth() + 1 === m && easterMonday.getDate() === d) {
    return { name: 'Velikonoční pondělí', isClosed: true };
  }

  return null;
}

export default function CalendarModal({
  salesHistory = [],
  onClose,
  onNavigateToHistory
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date()); // Controls displayed month/year
  const [selectedDate, setSelectedDate] = useState(new Date()); // Selected day cell
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_calendar_notes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);

  const selectedDateKey = selectedDate.toISOString().slice(0, 10);
  const selectedDateHoliday = useMemo(() => getCzechHoliday(selectedDate), [selectedDate]);

  // Sync note text when selected date changes
  useEffect(() => {
    setCurrentNoteText(notes[selectedDateKey] || '');
    setIsEditingNote(false);
  }, [selectedDateKey, notes]);

  const handleSaveNote = () => {
    const updatedNotes = {
      ...notes,
      [selectedDateKey]: currentNoteText.trim()
    };
    if (!currentNoteText.trim()) {
      delete updatedNotes[selectedDateKey];
    }
    setNotes(updatedNotes);
    try {
      localStorage.setItem('pos_calendar_notes', JSON.stringify(updatedNotes));
    } catch (e) {
      console.error('Failed to save calendar note', e);
    }
    setIsEditingNote(false);
  };

  // Month Navigation
  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    const now = new Date();
    setViewDate(now);
    setSelectedDate(now);
  };

  // Calculate calendar grid days for viewDate month
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Czech week starts on Monday (1). Sunday is 0 -> map to 6.
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Create array of calendar cell objects
  const calendarCells = [];

  // Padding days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const dateObj = new Date(year, month - 1, dayNum);
    calendarCells.push({ dateObj, isCurrentMonth: false, dayNum });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    calendarCells.push({ dateObj, isCurrentMonth: true, dayNum: d });
  }

  // Calculate sales stats for all days to show indicators
  const salesByDateMap = useMemo(() => {
    const map = {};
    salesHistory.forEach(sale => {
      if (!sale.timestamp) return;
      const dateKey = new Date(sale.timestamp).toISOString().slice(0, 10);
      if (!map[dateKey]) {
        map[dateKey] = {
          count: 0,
          totalRevenue: 0,
          cashTotal: 0,
          cardTotal: 0,
          refundCount: 0,
          refundTotal: 0
        };
      }
      map[dateKey].count += 1;
      const amount = parseFloat(sale.total_amount || 0);
      map[dateKey].totalRevenue += amount;

      if (sale.is_refund || sale.isRefund) {
        map[dateKey].refundCount += 1;
        map[dateKey].refundTotal += Math.abs(amount);
      } else {
        if (sale.payment_method === 'card') {
          map[dateKey].cardTotal += amount;
        } else {
          map[dateKey].cashTotal += amount;
        }
      }
    });
    return map;
  }, [salesHistory]);

  // Selected Day Stats
  const selectedDayStats = salesByDateMap[selectedDateKey] || {
    count: 0,
    totalRevenue: 0,
    cashTotal: 0,
    cardTotal: 0,
    refundCount: 0,
    refundTotal: 0
  };

  const handleOpenReceiptsForDay = () => {
    if (onNavigateToHistory) {
      onNavigateToHistory(selectedDateKey);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '880px', width: '94%', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <CalendarIcon size={22} style={{ color: 'var(--accent-blue)' }} />
            <span>Kalendář Směny & Státní Svátky ČR</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.25rem' }}>
            
            {/* LEFT COLUMN: Calendar Grid & Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Calendar Month Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-main)',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}>
                <button
                  type="button"
                  className="nav-tab"
                  style={{ padding: '0.4rem 0.6rem' }}
                  onClick={handlePrevMonth}
                  title="Předchozí měsíc"
                >
                  <ChevronLeft size={18} />
                </button>

                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {MONTH_NAMES[month]} {year}
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="nav-tab"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', fontWeight: '700' }}
                    onClick={handleGoToToday}
                  >
                    Dnes
                  </button>
                  <button
                    type="button"
                    className="nav-tab"
                    style={{ padding: '0.4rem 0.6rem' }}
                    onClick={handleNextMonth}
                    title="Následující měsíc"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                {WEEKDAYS.map((wd, i) => (
                  <div
                    key={wd}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      color: i >= 5 ? 'var(--accent-rose)' : 'var(--text-muted)',
                      padding: '0.25rem 0'
                    }}
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
                {calendarCells.map((cell, idx) => {
                  const cellKey = cell.dateObj.toISOString().slice(0, 10);
                  const isSelected = cellKey === selectedDateKey;
                  const isToday = cellKey === today.toISOString().slice(0, 10);
                  const holiday = getCzechHoliday(cell.dateObj);
                  const hasSales = salesByDateMap[cellKey] && salesByDateMap[cellKey].count > 0;
                  const hasNote = !!notes[cellKey];

                  // Cell Styling based on Holiday & Retail Closure Status
                  let cellBg = cell.isCurrentMonth ? 'var(--bg-card)' : 'rgba(255,255,255,0.02)';
                  let cellBorder = '1px solid var(--border-color)';

                  if (holiday?.isClosed) {
                    cellBg = cell.isCurrentMonth ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.03)';
                    cellBorder = '1px solid rgba(239, 68, 68, 0.3)';
                  } else if (holiday && !holiday.isClosed) {
                    cellBg = cell.isCurrentMonth ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.03)';
                    cellBorder = '1px solid rgba(59, 130, 246, 0.3)';
                  }

                  if (isSelected) {
                    cellBorder = '2px solid var(--accent-blue)';
                    cellBg = 'rgba(59, 130, 246, 0.18)';
                  } else if (isToday) {
                    cellBorder = '2px solid var(--accent-emerald)';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDate(cell.dateObj)}
                      title={holiday ? `${holiday.name} (${holiday.isClosed ? 'ZÁKAZ PRODEJE' : 'Otevřeno'})` : undefined}
                      style={{
                        position: 'relative',
                        aspectRatio: '1.1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-md)',
                        border: cellBorder,
                        background: cellBg,
                        color: holiday?.isClosed
                          ? 'var(--accent-rose)'
                          : holiday
                          ? 'var(--accent-blue)'
                          : isSelected
                          ? 'var(--accent-blue)'
                          : cell.isCurrentMonth
                          ? 'var(--text-primary)'
                          : 'var(--text-muted)',
                        fontWeight: isSelected || isToday || holiday ? '800' : '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        padding: '4px'
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>{cell.dayNum}</span>

                      {/* Status indicators */}
                      <div style={{ display: 'flex', gap: '3px', marginTop: '2px', alignItems: 'center' }}>
                        {holiday?.isClosed && (
                          <span
                            title={`Zákaz prodeje: ${holiday.name}`}
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--accent-rose)'
                            }}
                          />
                        )}
                        {holiday && !holiday.isClosed && (
                          <span
                            title={`Státní svátek (Otevřeno): ${holiday.name}`}
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--accent-blue)'
                            }}
                          />
                        )}
                        {hasSales && (
                          <span
                            title="Nalezeny tržby"
                            style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }}
                          />
                        )}
                        {hasNote && (
                          <span
                            title="Poznámka ke dni"
                            style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-amber)' }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Holiday & Retail Closure Legend */}
              <div style={{
                background: 'var(--bg-main)',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                color: 'var(--text-secondary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-rose)' }} />
                  <span style={{ fontWeight: '700', color: 'var(--accent-rose)' }}>Zákaz prodeje (Zákon 223/2016 Sb.)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)' }} />
                  <span>Svátek (Otevřeno)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                  <span>Tržba doložena</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-amber)' }} />
                  <span>Poznámka</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Selected Day Details & Holiday Banner */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Czech Holiday & Retail Closure Banner */}
              {selectedDateHoliday && (
                <div style={{
                  background: selectedDateHoliday.isClosed
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)'
                    : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
                  border: selectedDateHoliday.isClosed
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : '1px solid rgba(59, 130, 246, 0.4)',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {selectedDateHoliday.isClosed ? (
                      <AlertOctagon size={20} style={{ color: 'var(--accent-rose)' }} />
                    ) : (
                      <Info size={20} style={{ color: 'var(--accent-blue)' }} />
                    )}
                    <span style={{
                      fontWeight: '800',
                      fontSize: '0.95rem',
                      color: selectedDateHoliday.isClosed ? 'var(--accent-rose)' : 'var(--accent-blue)'
                    }}>
                      {selectedDateHoliday.name}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)', marginLeft: '1.75rem' }}>
                    {selectedDateHoliday.isClosed ? (
                      selectedDateHoliday.isHalfDay ? (
                        '🛑 ZÁKAZ PRODEJE OD 12:00 (Zákon č. 223/2016 Sb.)'
                      ) : (
                        '🛑 ZÁKAZ PRODEJE MALOOBCHODU (Zákon č. 223/2016 Sb.)'
                      )
                    ) : (
                      '🟢 BEZ OMEZENÍ PRODEJNÍ DOBY (Prodejny mohou mít otevřeno)'
                    )}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.75rem' }}>
                    {selectedDateHoliday.isClosed
                      ? 'Dle zákona č. 223/2016 Sb. musí mít prodejny nad 200 m² v tento svátek zavřeno.'
                      : 'Na tento státní svátek se zákonné omezení prodejní doby maloobchodu nevztahuje.'}
                  </div>
                </div>
              )}

              {/* Day Summary Panel */}
              <div style={{
                background: 'var(--bg-main)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>
                  Přehled prodeje pro vybraný den
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>

                {/* Day Summary Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '1rem' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>Tržba Celkem</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-emerald)', marginTop: '2px' }}>
                      {selectedDayStats.totalRevenue.toLocaleString('cs-CZ')} Kč
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>Počet Účtenek</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-blue)', marginTop: '2px' }}>
                      {selectedDayStats.count} ks
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Banknote size={16} style={{ color: 'var(--accent-emerald)' }} />
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hotovost</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {selectedDayStats.cashTotal.toLocaleString('cs-CZ')} Kč
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={16} style={{ color: 'var(--accent-blue)' }} />
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Platby Kartou</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {selectedDayStats.cardTotal.toLocaleString('cs-CZ')} Kč
                      </div>
                    </div>
                  </div>
                </div>

                {/* Storno info if any */}
                {selectedDayStats.refundCount > 0 && (
                  <div style={{
                    marginTop: '0.65rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    color: 'var(--accent-rose)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <RotateCcw size={15} />
                    <span>Registrované vratky / storna: {selectedDayStats.refundCount} ks ({selectedDayStats.refundTotal.toLocaleString('cs-CZ')} Kč)</span>
                  </div>
                )}

                {/* Action button to open Receipts for this day */}
                <button
                  type="button"
                  className="pay-btn pay-btn-card"
                  style={{
                    width: '100%',
                    height: '42px',
                    marginTop: '1rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onClick={handleOpenReceiptsForDay}
                >
                  <Receipt size={16} />
                  <span>Zobrazit Účtenky Dne ({selectedDate.toLocaleDateString('cs-CZ')})</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Shift Note Box */}
              <div style={{
                background: 'var(--bg-main)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={15} style={{ color: 'var(--accent-amber)' }} />
                    <span>Poznámka ke Směně / Dni</span>
                  </div>
                  {!isEditingNote && notes[selectedDateKey] && (
                    <button
                      type="button"
                      className="nav-tab"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => setIsEditingNote(true)}
                    >
                      Upravit
                    </button>
                  )}
                </div>

                {isEditingNote || !notes[selectedDateKey] ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="Přidat poznámku (např. Inventura, Státní svátek)..."
                      value={currentNoteText}
                      onChange={e => setCurrentNoteText(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.65rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                    <button
                      type="button"
                      className="nav-tab"
                      style={{ padding: '0.45rem 0.75rem', background: 'var(--accent-blue)', color: '#fff' }}
                      onClick={handleSaveNote}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                ) : (
                  <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-card)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontWeight: '600'
                  }}>
                    {notes[selectedDateKey]}
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
