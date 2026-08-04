import React, { useState, useEffect } from 'react';
import { Calendar, Delete, X, Check, RotateCcw } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

const CZECH_MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export default function DateKeypadModal({
  isOpen,
  onClose,
  initialDate, // YYYY-MM-DD format
  onConfirm,
  title = 'Zadejte Datum'
}) {
  const { t } = useTranslation();

  // Helper: Convert YYYY-MM-DD to DDMMYYYY digit string
  const isoToDigits = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length !== 3) return '';
    const [yyyy, mm, dd] = parts;
    return `${dd}${mm}${yyyy}`;
  };

  // Helper: Convert DDMMYYYY digit string to formatted string (DD.MM.YYYY)
  const formatDigitsDisplay = (rawDigits) => {
    const clean = rawDigits.slice(0, 8);
    let dd = clean.slice(0, 2);
    let mm = clean.slice(2, 4);
    let yyyy = clean.slice(4, 8);

    let result = dd;
    if (clean.length >= 3) result += '.' + mm;
    if (clean.length >= 5) result += '.' + yyyy;
    return result;
  };

  // Helper: Check max days in month (taking leap year into account)
  const getDaysInMonth = (year, month) => {
    if (month === 2) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      return isLeap ? 29 : 28;
    }
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  };

  // Real-time live date validation
  const validateDate = (rawDigits) => {
    if (!rawDigits || rawDigits.length === 0) {
      return { isValid: false, errorMsg: 'Zadejte datum' };
    }
    if (rawDigits.length >= 2) {
      const dd = parseInt(rawDigits.slice(0, 2), 10);
      if (dd < 1 || dd > 31) return { isValid: false, errorMsg: 'Den musí být v rozmezí 01–31' };
    }
    if (rawDigits.length >= 4) {
      const mm = parseInt(rawDigits.slice(2, 4), 10);
      if (mm < 1 || mm > 12) return { isValid: false, errorMsg: 'Měsíc musí být v rozmezí 01–12' };
    }
    if (rawDigits.length < 8) {
      return { isValid: false, errorMsg: 'Zadejte kompletní datum (DD.MM.YYYY)' };
    }

    const dd = parseInt(rawDigits.slice(0, 2), 10);
    const mm = parseInt(rawDigits.slice(2, 4), 10);
    const yyyy = parseInt(rawDigits.slice(4, 8), 10);

    if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) {
      return { isValid: false, errorMsg: 'Neplatné číslo data' };
    }
    if (mm < 1 || mm > 12) {
      return { isValid: false, errorMsg: 'Měsíc musí být v rozmezí 01–12' };
    }
    if (yyyy < 2000 || yyyy > 2099) {
      return { isValid: false, errorMsg: 'Rok musí být v rozmezí 2000–2099' };
    }

    const maxDays = getDaysInMonth(yyyy, mm);
    if (dd < 1 || dd > maxDays) {
      const monthName = CZECH_MONTH_NAMES[mm - 1] || 'Tento měsíc';
      return { isValid: false, errorMsg: `${monthName} ${yyyy} má pouze ${maxDays} dní` };
    }

    const formattedMm = mm.toString().padStart(2, '0');
    const formattedDd = dd.toString().padStart(2, '0');
    return { isValid: true, errorMsg: '', isoDate: `${yyyy}-${formattedMm}-${formattedDd}` };
  };

  const [digits, setDigits] = useState('');
  const [isOverwritePending, setIsOverwritePending] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setDigits(isoToDigits(initialDate));
      setIsOverwritePending(true);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const validation = validateDate(digits);

  const handleDigitPress = (digit) => {
    if (isOverwritePending) {
      setDigits(digit);
      setIsOverwritePending(false);
    } else {
      if (digits.length >= 8) return;
      setDigits(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setIsOverwritePending(false);
    setDigits(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setIsOverwritePending(false);
    setDigits('');
  };

  const handleSetToday = () => {
    setIsOverwritePending(false);
    const todayIso = new Date().toISOString().slice(0, 10);
    setDigits(isoToDigits(todayIso));
  };

  const handleSave = () => {
    if (!validation.isValid || !validation.isoDate) return;
    onConfirm(validation.isoDate);
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
          borderRadius: 'var(--radius-xl)',
          maxWidth: '380px',
          width: '100%',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          margin: '0 auto'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
            <Calendar size={22} />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
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

        {/* Formatted Date Display Box with Overwrite Indicator */}
        <div style={{
          background: isOverwritePending ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-input)',
          border: validation.errorMsg && digits.length >= 8 ? '2px solid #ef4444' : isOverwritePending ? '2px solid var(--accent-blue)' : '2px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.85rem 1rem',
          textAlign: 'center',
          marginBottom: '0.75rem',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.15s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
              Zadané Datum (DD.MM.YYYY)
            </span>
            {isOverwritePending && (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', fontWeight: '800', background: 'rgba(59, 130, 246, 0.2)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-sm)' }}>
                Připraveno k přepsání
              </span>
            )}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.75rem',
            fontWeight: '800',
            color: isOverwritePending ? 'var(--accent-blue)' : digits ? 'var(--text-primary)' : 'var(--text-muted)',
            minHeight: '2.4rem',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            letterSpacing: '0.08em'
          }}>
            {digits ? formatDigitsDisplay(digits) : 'DD . MM . YYYY'}
          </div>
        </div>

        {/* Live Validation Error Alert */}
        {validation.errorMsg && digits.length > 0 && (
          <div style={{
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.45rem 0.75rem',
            fontSize: '0.82rem',
            textAlign: 'center',
            fontWeight: '700',
            marginBottom: '0.85rem'
          }}>
            {validation.errorMsg}
          </div>
        )}

        {/* Touch Keypad Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginBottom: '1.25rem' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              className="keypad-btn"
              onClick={() => handleDigitPress(num)}
              style={{
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                fontWeight: '800',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer'
              }}
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            className="keypad-btn"
            onClick={handleSetToday}
            style={{
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              fontWeight: '800',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-blue)',
              cursor: 'pointer'
            }}
          >
            Dnes
          </button>

          <button
            type="button"
            className="keypad-btn"
            onClick={() => handleDigitPress('0')}
            style={{
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              fontWeight: '800',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer'
            }}
          >
            0
          </button>

          <button
            type="button"
            className="keypad-btn"
            onClick={handleBackspace}
            style={{
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              cursor: 'pointer'
            }}
            title="Smazat poslední číslici"
          >
            <Delete size={22} />
          </button>
        </div>

        {/* Modal Bottom Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleClear}
            style={{
              flex: 1,
              height: '46px',
              fontWeight: '700',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={16} />
            <span>Smazat</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!validation.isValid}
            style={{
              flex: 1.5,
              height: '46px',
              fontWeight: '800',
              fontSize: '0.95rem',
              background: validation.isValid ? 'var(--accent-emerald)' : 'rgba(255, 255, 255, 0.1)',
              color: validation.isValid ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: validation.isValid ? 'pointer' : 'not-allowed',
              opacity: validation.isValid ? 1 : 0.6,
              boxShadow: validation.isValid ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Check size={18} />
            <span>Potvrdit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
