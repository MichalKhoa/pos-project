import React from 'react';
import { Edit3 } from 'lucide-react';
import { getPresetIconComponent } from '../../utils/presetIcons';

export default function PresetTileCard({
  preset,
  index,
  isEditMode,
  itemMultiplier,
  isDraggingThis,
  isDragOverThis,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onClick,
  storeConfig = null,
  buttonStyle = null
}) {
  const IconComponent = !preset.imageUrl ? getPresetIconComponent(preset.icon) : null;
  const shouldShowVat = storeConfig?.showPresetVat !== false && preset.vat !== undefined;
  const activeStyle = buttonStyle || storeConfig?.presetButtonStyle || 'left-stripe';

  return (
    <button
      key={preset.id}
      type="button"
      draggable={isEditMode}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={(e) => onDragLeave(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`preset-card style-${activeStyle} ${isEditMode ? 'edit-mode' : ''} ${isDraggingThis ? 'dragging' : ''} ${isDragOverThis ? 'drag-over' : ''}`}
      style={{
        '--card-accent': preset.color || '#3b82f6',
        outline: isEditMode
          ? (isDragOverThis ? '2px solid var(--accent-blue)' : '2px dashed var(--accent-amber)')
          : (itemMultiplier > 1 ? '2px solid var(--accent-amber)' : 'none'),
        boxShadow: itemMultiplier > 1 && !isEditMode ? '0 0 12px rgba(245, 158, 11, 0.4)' : undefined,
        opacity: isDraggingThis ? 0.35 : 1,
        cursor: isEditMode ? 'grab' : 'pointer'
      }}
      onClick={() => onClick(preset)}
    >
      {itemMultiplier > 1 && !isEditMode && (
        <div className="preset-multiplier-badge">
          ×{itemMultiplier}
        </div>
      )}

      {/* Header Row: Name on Left, Edit Indicator (Edit Mode) OR Corner Icon (Normal Mode) */}
      <div className="preset-card-header">
        <div className="preset-name">
          <span>{preset.name}</span>
        </div>

        {/* Top-Right Corner: Clean Edit Pencil (Edit Mode) OR Corner Icon/Photo (Normal Mode) */}
        {isEditMode ? (
          <div
            className="preset-corner-icon"
            style={{ color: 'var(--accent-amber)', opacity: 1 }}
            title="Kliknutím upravíte • Přetažením změníte pořadí"
          >
            <Edit3 size={15} />
          </div>
        ) : (
          (preset.imageUrl || IconComponent) && (
            <div className="preset-corner-icon">
              {preset.imageUrl ? (
                <img
                  src={preset.imageUrl}
                  alt=""
                  className="preset-corner-thumb"
                />
              ) : (
                <IconComponent size={18} />
              )}
            </div>
          )
        )}
      </div>

      {/* Footer Row: Price on Left, Smooth Subtle VAT Text in Corner */}
      <div className="preset-price-tag">
        <span className="preset-price">
          {preset.isOpenPrice ? '' : preset.price > 0 ? `${preset.price} Kč` : ''}
        </span>

        {shouldShowVat && (
          <span className="preset-vat-text">{preset.vat}%</span>
        )}
      </div>
    </button>
  );
}
