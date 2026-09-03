import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

const FlagCZ = ({ style = {}, className = '' }) => (
  <svg width="20" height="14" viewBox="0 0 640 480" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }} className={className}>
    <rect width="640" height="480" fill="#d7141a"/>
    <rect width="640" height="240" fill="#fff"/>
    <path d="M0 0l320 240L0 480z" fill="#11457e"/>
  </svg>
);

const FlagVN = ({ style = {}, className = '' }) => (
  <svg width="20" height="14" viewBox="0 0 640 480" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }} className={className}>
    <rect width="640" height="480" fill="#da251d"/>
    <polygon points="320,84 357,198 477,198 380,268 417,382 320,312 223,382 260,268 163,198 283,198" fill="#ffff00"/>
  </svg>
);

const FlagUK = ({ style = {}, className = '' }) => (
  <svg width="20" height="14" viewBox="0 0 640 480" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }} className={className}>
    <path fill="#012169" d="M0 0h640v480H0z"/>
    <path fill="#FFF" d="m75 0 245 180L565 0h75v50L395 240l245 190v50h-75L320 300 75 480H0v-50l245-190L0 50V0h75z"/>
    <path fill="#C8102E" d="m425 300 215 165v15h-35L390 315l35-15zm120-300 95 70v15l-115-85h20zM0 465l195-150-35-15L0 435v30zm0-465 215 165-35 15L0 35V0z"/>
    <path fill="#FFF" d="M240 0v480h160V0H240zM0 160v160h640V160H0z"/>
    <path fill="#C8102E" d="M0 192v96h640v-96H0zM272 0v480h96V0h-96z"/>
  </svg>
);

function getFlagComponent(code) {
  switch (code?.toLowerCase()) {
    case 'cs':
      return <FlagCZ />;
    case 'vi':
      return <FlagVN />;
    case 'en':
      return <FlagUK />;
    default:
      return <FlagCZ />;
  }
}

export default function LanguageSelector({
  value,
  onChange,
  variant = 'dropdown',
  compact = false,
  style = {}
}) {
  const { language, setLanguage, languages } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeLangCode = value || language;
  const currentLang = languages.find(l => l.code === activeLangCode) || languages[0];

  const handleSelect = (code) => {
    setLanguage(code);
    if (onChange) {
      onChange(code);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 🏁 Full-width segmented bar choice for touchscreen settings
  if (variant === 'bar') {
    return (
      <div className="settings-segmented-group" style={{ width: '100%', ...style }}>
        {languages.map(l => {
          const isSelected = l.code === currentLang.code;
          return (
            <button
              key={l.code}
              type="button"
              className={`settings-segmented-btn ${isSelected ? 'active' : ''}`}
              style={{
                minHeight: '46px',
                fontSize: '0.92rem',
                gap: '0.6rem',
                padding: '0 1rem'
              }}
              onClick={() => handleSelect(l.code)}
            >
              {getFlagComponent(l.code)}
              <span>{l.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // 🌐 Compact dropdown pill for navbars and mobile drawer
  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'var(--bg-main)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '999px',
          padding: compact ? '0 0.6rem' : '0.45rem 0.75rem',
          height: '36px',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          fontSize: '0.8rem',
          fontWeight: '800',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease'
        }}
      >
        {getFlagComponent(currentLang.code)}
        <span>{currentLang.label}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 999,
            minWidth: '150px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            padding: '0.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem'
          }}
        >
          {languages.map(l => {
            const isSelected = l.code === currentLang.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSelect(l.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'var(--bg-input)' : 'transparent',
                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? '800' : '600',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
              >
                {getFlagComponent(l.code)}
                <span style={{ flex: 1 }}>{l.name} ({l.label})</span>
                {isSelected && <Check size={14} style={{ color: 'var(--accent-blue)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
