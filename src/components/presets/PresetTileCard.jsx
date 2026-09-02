import React from 'react';
import { GripVertical, MoveLeft, MoveRight, Edit3, Trash2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { getPresetIconComponent } from '../../utils/presetIcons';

export default function PresetTileCard({
  preset,
  index,
  totalCount,
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
  onMovePosition,
  onOpenEditModal,
  onDelete,
  storeConfig = null,
  buttonStyle = null
}) {
  const { t } = useTranslation();
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
        opacity: isDraggingThis ? 0.4 : 1,
        cursor: isEditMode ? 'grab' : 'pointer'
      }}
      onClick={() => onClick(preset)}
    >
      {itemMultiplier > 1 && !isEditMode && (
        <div className="preset-multiplier-badge">
          ×{itemMultiplier}
        </div>
      )}

      {/* Header Row: Name on Left, Edit Controls or Smooth Corner Icon on Right */}
      <div className="preset-card-header">
        {isEditMode && (
          <div
            className="drag-handle"
            title="Chytit a přetáhnout"
            style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center', cursor: 'grab' }}
          >
            <GripVertical size={16} />
          </div>
        )}

        <div className="preset-name">
          <span>{preset.name}</span>
        </div>

        {/* Top-Right Corner: Edit Controls (Edit Mode) OR Clean Borderless Corner Icon (Normal Mode) */}
        {isEditMode ? (
          <div className="preset-edit-actions">
            <span
              type="button"
              className="preset-edit-btn"
              style={{ opacity: index === 0 ? 0.35 : 1, cursor: index === 0 ? 'default' : 'pointer' }}
              onClick={(e) => onMovePosition(index, -1, e)}
              title="Posunout vlevo"
            >
              <MoveLeft size={12} />
            </span>
            <span
              type="button"
              className="preset-edit-btn"
              style={{ opacity: index === totalCount - 1 ? 0.35 : 1, cursor: index === totalCount - 1 ? 'default' : 'pointer' }}
              onClick={(e) => onMovePosition(index, 1, e)}
              title="Posunout vpravo"
            >
              <MoveRight size={12} />
            </span>
            <span
              className="preset-edit-btn preset-edit-btn-amber"
              onClick={(e) => onOpenEditModal(preset, e)}
              title={t('presets.edit')}
            >
              <Edit3 size={13} />
            </span>
            <span
              className="preset-edit-btn preset-edit-btn-rose"
              onClick={(e) => onDelete(preset.id, e)}
              title={t('presets.delete')}
            >
              <Trash2 size={13} />
            </span>
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
