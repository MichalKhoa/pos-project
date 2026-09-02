import React, { useRef } from 'react';
import { Pipette } from 'lucide-react';
import { COLOR_OPTIONS } from '../../data/initialData';
import { useTranslation } from '../../i18n/LanguageContext';

export default function PresetColorPicker({ selectedColor, onSelectColor }) {
  const { t } = useTranslation();
  const colorInputRef = useRef(null);

  const isPresetColor = COLOR_OPTIONS.includes(selectedColor);

  const handleCustomColorClick = () => {
    if (colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700' }}>
          {t('presets.color')}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            fontWeight: '700',
            letterSpacing: '0.04em'
          }}>
            {selectedColor || '#2563eb'}
          </span>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: selectedColor || '#2563eb',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {COLOR_OPTIONS.map(c => {
          const isSelected = selectedColor === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelectColor(c)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: c,
                border: isSelected ? '3px solid #ffffff' : '1px solid rgba(0,0,0,0.25)',
                boxShadow: isSelected ? '0 0 0 2px var(--accent-blue), 0 2px 8px rgba(0,0,0,0.5)' : 'none',
                cursor: 'pointer',
                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                padding: 0,
                flexShrink: 0
              }}
              title={c}
            />
          );
        })}

        {/* Custom Color Picker Button */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <input
            ref={colorInputRef}
            type="color"
            value={selectedColor || '#2563eb'}
            onChange={(e) => onSelectColor(e.target.value)}
            style={{
              position: 'absolute',
              opacity: 0,
              width: '1px',
              height: '1px',
              pointerEvents: 'none'
            }}
          />
          <button
            type="button"
            onClick={handleCustomColorClick}
            style={{
              height: '32px',
              padding: '0 0.65rem',
              borderRadius: '16px',
              background: !isPresetColor ? selectedColor : 'var(--bg-input)',
              color: !isPresetColor ? '#ffffff' : 'var(--text-primary)',
              border: !isPresetColor ? '2px solid #ffffff' : '1px dashed var(--border-color)',
              boxShadow: !isPresetColor ? '0 0 0 2px var(--accent-blue)' : 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
              fontWeight: '700',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            title={t('presets.custom_color')}
          >
            <Pipette size={14} />
            <span>{t('presets.custom_color')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
