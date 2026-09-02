import React, { useState, useMemo } from 'react';
import { Sparkles, Search, X } from 'lucide-react';
import {
  PRESET_ICON_MAP,
  PRESET_ICON_LABELS,
  PRESET_ICON_CATEGORIES,
  ICON_CATEGORY_MAP
} from '../../utils/presetIcons';
import { useTranslation } from '../../i18n/LanguageContext';

export default function PresetIconPicker({
  icon,
  onSelectIcon
}) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIcons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return Object.entries(PRESET_ICON_MAP).filter(([iconKey]) => {
      // Category filter
      if (activeCategory !== 'all') {
        const cat = ICON_CATEGORY_MAP[iconKey];
        if (cat !== activeCategory) return false;
      }
      // Search query filter
      if (q) {
        const label = (PRESET_ICON_LABELS[iconKey] || '').toLowerCase();
        const key = iconKey.toLowerCase();
        return label.includes(q) || key.includes(q);
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {/* Header with Title and Clear Icon */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
            <span>Ikona položky (Vektorový symbol)</span>
          </label>
          {icon && (
            <button
              type="button"
              onClick={() => onSelectIcon('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-rose)',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
            >
              <X size={13} />
              <span>Odebrat ikonu</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', marginBottom: '0.45rem' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={t('presets.search_icon') || 'Hledat ikonu podle názvu...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.6rem 0.45rem 2rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Filter Chips (Wrap across lines, all visible) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
          {PRESET_ICON_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: '14px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  border: isActive ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                  background: isActive ? 'var(--accent-blue)' : 'var(--bg-card)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.12s ease'
                }}
              >
                {t(cat.labelKey) || cat.fallback}
              </button>
            );
          })}
        </div>

        {/* Icons Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
          gap: '0.35rem',
          background: 'var(--bg-card)',
          padding: '0.5rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          maxHeight: '160px',
          overflowY: 'auto'
        }}>
          {filteredIcons.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Žádné ikony neodpovídají hledání.
            </div>
          ) : (
            filteredIcons.map(([iconKey, IconComp]) => {
              const isSelected = icon === iconKey;
              const labelText = PRESET_ICON_LABELS[iconKey] || iconKey;
              return (
                <button
                  key={iconKey}
                  type="button"
                  title={labelText}
                  onClick={() => onSelectIcon(isSelected ? '' : iconKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--accent-blue)' : 'var(--bg-card)',
                    border: isSelected ? '2px solid #fff' : '1px solid var(--border-color)',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                >
                  <IconComp size={18} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
