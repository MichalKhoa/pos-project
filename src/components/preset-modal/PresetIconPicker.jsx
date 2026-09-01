import React from 'react';
import { Sparkles, Image } from 'lucide-react';
import { PRESET_ICON_MAP, PRESET_ICON_LABELS } from '../../utils/presetIcons';

export default function PresetIconPicker({
  icon,
  onSelectIcon,
  imageUrl,
  onSelectImageUrl
}) {
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onSelectImageUrl(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Visual Icon Selection Gallery */}
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
              style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
            >
              Odebrat ikonu
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', maxHeight: '140px', overflowY: 'auto' }}>
          {Object.entries(PRESET_ICON_MAP).map(([iconKey, IconComp]) => {
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
                  transition: 'all 0.15s ease'
                }}
              >
                <IconComp size={18} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Picture / Image File Upload */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Image size={16} style={{ color: 'var(--accent-blue)' }} />
            <span>Obrázek / Fotka Produktu</span>
          </label>
          {imageUrl && (
            <button
              type="button"
              onClick={() => onSelectImageUrl('')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
            >
              Smazat fotku
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}
          />
        </div>
      </div>
    </>
  );
}
