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
  onDelete
}) {
  const { t } = useTranslation();

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
      className={`preset-card ${isEditMode ? 'edit-mode' : ''} ${isDraggingThis ? 'dragging' : ''} ${isDragOverThis ? 'drag-over' : ''}`}
      style={{
        '--card-accent': preset.color || '#3b82f6',
        position: 'relative',
        outline: isEditMode
          ? (isDragOverThis ? '2px solid var(--accent-blue)' : '2px dashed var(--accent-amber)')
          : (itemMultiplier > 1 ? '2px solid var(--accent-amber)' : 'none'),
        boxShadow: itemMultiplier > 1 && !isEditMode ? '0 0 12px rgba(245, 158, 11, 0.3)' : undefined,
        opacity: isDraggingThis ? 0.4 : 1,
        cursor: isEditMode ? 'grab' : 'pointer'
      }}
      onClick={() => onClick(preset)}
    >
      {itemMultiplier > 1 && !isEditMode && (
        <div
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontWeight: '900',
            padding: '2px 7px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'none',
            letterSpacing: '0.02em',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            zIndex: 2
          }}
        >
          ×{itemMultiplier}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flex: 1, width: '100%' }}>
        {isEditMode && (
          <div
            className="drag-handle"
            title="Chytit a přetáhnout"
            style={{ marginRight: '6px', display: 'inline-flex', alignItems: 'center', cursor: 'grab' }}
          >
            <GripVertical size={16} />
          </div>
        )}

        <div className="preset-name" style={{ flex: 1 }}>
          <span>{preset.name}</span>
          {preset.isGeneralPreset && (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: '600',
              background: 'rgba(255, 255, 255, 0.18)',
              color: 'rgba(255, 255, 255, 0.95)',
              padding: '1px 5px',
              borderRadius: '4px',
              marginLeft: '6px',
              verticalAlign: 'middle',
              display: 'inline-block',
              letterSpacing: '0.01em'
            }}>
              {t('presets.general_badge') || 'Druh zboží'}
            </span>
          )}
        </div>

        {/* Bottom-Right Corner Visual Icon / Photo Badge */}
        {preset.imageUrl ? (
          <img
            src={preset.imageUrl}
            alt=""
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              width: '26px',
              height: '26px',
              objectFit: 'cover',
              borderRadius: '5px',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 1
            }}
          />
        ) : (() => {
          const IconComponent = getPresetIconComponent(preset.icon);
          return IconComponent ? (
            <div
              style={{
                position: 'absolute',
                bottom: '5px',
                right: '6px',
                opacity: 0.32,
                color: 'var(--text-primary)',
                pointerEvents: 'none',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconComponent size={28} />
            </div>
          ) : null;
        })()}

        {isEditMode && (
          <div style={{ display: 'flex', gap: '2px', flexShrink: 0, marginLeft: '4px', alignItems: 'center' }}>
            <span
              type="button"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: index === 0 ? 'var(--text-muted)' : '#fff',
                borderRadius: '4px',
                padding: '2px 4px',
                display: 'inline-flex',
                alignItems: 'center',
                opacity: index === 0 ? 0.35 : 1,
                cursor: index === 0 ? 'default' : 'pointer'
              }}
              onClick={(e) => onMovePosition(index, -1, e)}
              title="Posunout vlevo"
            >
              <MoveLeft size={12} />
            </span>
            <span
              type="button"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: index === totalCount - 1 ? 'var(--text-muted)' : '#fff',
                borderRadius: '4px',
                padding: '2px 4px',
                display: 'inline-flex',
                alignItems: 'center',
                opacity: index === totalCount - 1 ? 0.35 : 1,
                cursor: index === totalCount - 1 ? 'default' : 'pointer'
              }}
              onClick={(e) => onMovePosition(index, 1, e)}
              title="Posunout vpravo"
            >
              <MoveRight size={12} />
            </span>
            <span
              style={{ background: 'var(--accent-amber)', color: '#000', borderRadius: '4px', padding: '3px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
              onClick={(e) => onOpenEditModal(preset, e)}
              title={t('presets.edit')}
            >
              <Edit3 size={13} />
            </span>
            <span
              style={{ background: 'var(--accent-rose)', color: '#fff', borderRadius: '4px', padding: '3px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
              onClick={(e) => onDelete(preset.id, e)}
              title={t('presets.delete')}
            >
              <Trash2 size={13} />
            </span>
          </div>
        )}
      </div>

      <div className="preset-price-tag">
        <span className="preset-price">
          {preset.price === 0 || !preset.price ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: '800' }}>
              {t('presets.open_price_badge') || 'Volná cena'}
            </span>
          ) : (
            `${preset.price} Kč`
          )}
        </span>
        {preset.vat !== undefined && (
          <span className="preset-vat-badge">{preset.vat}%</span>
        )}
      </div>
    </button>
  );
}
