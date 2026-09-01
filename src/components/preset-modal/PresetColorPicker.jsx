import React from 'react';
import { COLOR_OPTIONS } from '../../data/initialData';
import { useTranslation } from '../../i18n/LanguageContext';

export default function PresetColorPicker({ selectedColor, onSelectColor }) {
  const { t } = useTranslation();

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
        {t('presets.color')}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                border: isSelected ? '3px solid #ffffff' : '1px solid rgba(0,0,0,0.2)',
                boxShadow: isSelected ? '0 0 8px rgba(0,0,0,0.5)' : 'none',
                cursor: 'pointer',
                transition: 'transform 0.1s ease',
                transform: isSelected ? 'scale(1.15)' : 'scale(1)'
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
