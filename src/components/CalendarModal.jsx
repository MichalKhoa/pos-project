import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Receipt, Banknote, CreditCard, RotateCcw, FileText, ArrowRight, Check, AlertOctagon, Info } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

import { getCzechHoliday } from '../utils/czechHolidays.js';
import { fetchDailySalesStats } from '../api/posApi';

export default function CalendarModal({
  salesHistory = [],
  onClose,
  onNavigateToHistory
}) {
  const { t, language } = useTranslation();
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

  // Dynamic Month & Weekday arrays according to active language
  const weekdaysList = t('calendar.weekdays');
  const monthNamesList = t('calendar.months');

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

  const viewMonthStr = useMemo(() => {
    return `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  }, [viewDate]);

  const [backendStatsMap, setBackendStatsMap] = useState({});

  useEffect(() => {
    let isCancelled = false;
    fetchDailySalesStats({ month: viewMonthStr }).then(data => {
      if (!isCancelled && data && typeof data === 'object') {
        setBackendStatsMap(data);
      }
    });
    return () => { isCancelled = true; };
  }, [viewMonthStr]);

  // Calculate sales stats for all days to show indicators (backend aggregate first, local fallback)
  const salesByDateMap = useMemo(() => {
    if (backendStatsMap && Object.keys(backendStatsMap).length > 0) {
      return backendStatsMap;
    }

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
  }, [salesHistory, backendStatsMap]);

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
            <span>{t('calendar.title')}</span>
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
                  title={t('calendar.prev_month')}
                >
                  <ChevronLeft size={18} />
                </button>

                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {monthNamesList[month]} {year}
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="nav-tab"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', fontWeight: '700' }}
                    onClick={handleGoToToday}
                  >
                    {t('calendar.today')}
                  </button>
                  <button
                    type="button"
                    className="nav-tab"
                    style={{ padding: '0.4rem 0.6rem' }}
                    onClick={handleNextMonth}
                    title={t('calendar.next_month')}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                {weekdaysList.map((wd, i) => (
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
                  <span style={{ fontWeight: '700', color: 'var(--accent-rose)' }}>{t('calendar.legend_closed')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)' }} />
                  <span>{t('calendar.legend_open')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                  <span>{t('calendar.legend_sales')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-amber)' }} />
                  <span>{t('calendar.legend_note')}</span>
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
                        t('calendar.half_day_closed')
                      ) : (
                        t('calendar.full_day_closed')
                      )
                    ) : (
                      t('calendar.no_restriction')
                    )}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.75rem' }}>
                    {selectedDateHoliday.isClosed
                      ? t('calendar.closed_desc')
                      : t('calendar.open_desc')}
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
                  {t('calendar.day_summary_title')}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedDate.toLocaleDateString(language === 'cs' ? 'cs-CZ' : language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>

                {/* Day Summary Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '1rem' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>{t('calendar.total_revenue')}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-emerald)', marginTop: '2px' }}>
                      {selectedDayStats.totalRevenue.toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-US')} Kč
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>{t('calendar.receipt_count')}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-blue)', marginTop: '2px' }}>
                      {selectedDayStats.count} ks
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Banknote size={16} style={{ color: 'var(--accent-emerald)' }} />
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('calendar.cash_total')}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {selectedDayStats.cashTotal.toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-US')} Kč
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={16} style={{ color: 'var(--accent-blue)' }} />
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('calendar.card_total')}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {selectedDayStats.cardTotal.toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-US')} Kč
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
                    <span>{t('calendar.refunds_registered')}: {selectedDayStats.refundCount} ks ({selectedDayStats.refundTotal.toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-US')} Kč)</span>
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
                  <span>{t('calendar.view_day_receipts')} ({selectedDate.toLocaleDateString(language === 'cs' ? 'cs-CZ' : language === 'vi' ? 'vi-VN' : 'en-US')})</span>
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
                    <span>{t('calendar.shift_note_title')}</span>
                  </div>
                  {!isEditingNote && notes[selectedDateKey] && (
                    <button
                      type="button"
                      className="nav-tab"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => setIsEditingNote(true)}
                    >
                      {t('calendar.edit_note')}
                    </button>
                  )}
                </div>

                {isEditingNote || !notes[selectedDateKey] ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder={t('calendar.note_placeholder')}
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
