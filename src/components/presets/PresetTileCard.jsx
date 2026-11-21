/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Edit3 } from 'lucide-react';
import PresetTileArt from './PresetTileArt';
import { useLanguage } from '../../i18n/LanguageContext';
import { normalizePresetStyle, readableTextOn } from '../../utils/presetTileStyle';

function PresetTileCard({
  preset,
  index,
  isEditMode,
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
  const { t } = useLanguage();
  const shouldShowVat = storeConfig?.showPresetVat === true && preset.vat !== undefined;
  const activeStyle = normalizePresetStyle(buttonStyle || storeConfig?.presetButtonStyle);
  const accent = preset.color || '#3b82f6';
  const hasPhoto = Boolean(preset.imageUrl);

  const isInventoryEnabled = Boolean(storeConfig?.inventoryEnabled);
  const isStockTracked = isInventoryEnabled && Boolean(preset.trackStock ?? preset.track_stock);
  const rawStock = preset.stockQuantity ?? preset.stock_quantity;
  const stockQuantity = rawStock !== undefined && rawStock !== null ? Number(rawStock) : 0;
  const rawMinStock = preset.minStockAlert ?? preset.min_stock_alert;
  const minStockAlert = rawMinStock !== undefined && rawMinStock !== null ? Number(rawMinStock) : 5;

  let stockBadge = null;
  if (isStockTracked) {
    if (stockQuantity <= 0) {
      stockBadge = {
        type: 'out-of-stock',
        text: t('presets.out_of_stock')
      };
    } else if (stockQuantity <= minStockAlert) {
      stockBadge = {
        type: 'low-stock',
        text: t('presets.low_stock', { count: stockQuantity })
      };
    }
  }

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
      className={`preset-card style-${activeStyle} ${hasPhoto ? 'has-photo' : ''} ${stockBadge ? 'has-stock-badge' : ''} ${stockBadge?.type === 'out-of-stock' ? 'is-out-of-stock' : ''} ${isEditMode ? 'edit-mode' : ''} ${isDraggingThis ? 'dragging' : ''} ${isDragOverThis ? 'drag-over' : ''}`}
      style={{
        '--card-accent': accent,
        '--card-fg': readableTextOn(accent),
        outline: isEditMode
          ? (isDragOverThis ? '2px solid var(--accent-blue)' : '2px dashed var(--accent-amber)')
          : 'none',
        opacity: isDraggingThis ? 0.35 : undefined,
        cursor: isEditMode ? 'grab' : 'pointer'
      }}
      onClick={() => onClick(preset)}
    >
      <PresetTileArt preset={preset} />

      <div className="preset-card-header">
        <div className="preset-name">
          <span>{preset.name}</span>
        </div>

        {isEditMode && (
          <div
            className="preset-corner-icon"
            style={{ color: 'var(--accent-amber)', opacity: 1 }}
            title={t('presets.edit_mode_hint')}
          >
            <Edit3 size={15} />
          </div>
        )}
      </div>

      {stockBadge && (
        <span className={`preset-stock-badge ${stockBadge.type}`}>
          {stockBadge.text}
        </span>
      )}

      <div className="preset-price-tag">
        {!preset.isOpenPrice && preset.price > 0 ? (
          <span className="preset-price-chip">
            <span className="preset-price">{`${preset.price} Kč`}</span>
          </span>
        ) : (
          <span className="preset-price-chip is-open" aria-hidden="true">
            <span className="preset-price">… Kč</span>
          </span>
        )}

        {shouldShowVat && (
          <span className="preset-vat-text">{preset.vat}%</span>
        )}
      </div>
    </button>
  );
}

export function arePresetCardPropsEqual(prevProps, nextProps) {
  if (prevProps.isEditMode !== nextProps.isEditMode) return false;
  if (prevProps.isDraggingThis !== nextProps.isDraggingThis) return false;
  if (prevProps.isDragOverThis !== nextProps.isDragOverThis) return false;
  if (prevProps.buttonStyle !== nextProps.buttonStyle) return false;
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.onClick !== nextProps.onClick) return false;
  if (prevProps.storeConfig?.presetButtonStyle !== nextProps.storeConfig?.presetButtonStyle) return false;
  if (prevProps.storeConfig?.showPresetVat !== nextProps.storeConfig?.showPresetVat) return false;
  if (Boolean(prevProps.storeConfig?.inventoryEnabled) !== Boolean(nextProps.storeConfig?.inventoryEnabled)) return false;

  const p1 = prevProps.preset;
  const p2 = nextProps.preset;
  if (p1 === p2) return true;
  if (!p1 || !p2) return false;
  return (
    p1.id === p2.id &&
    p1.name === p2.name &&
    p1.price === p2.price &&
    p1.isOpenPrice === p2.isOpenPrice &&
    p1.vat === p2.vat &&
    p1.color === p2.color &&
    p1.icon === p2.icon &&
    p1.imageUrl === p2.imageUrl &&
    (p1.trackStock ?? p1.track_stock) === (p2.trackStock ?? p2.track_stock) &&
    (p1.stockQuantity ?? p1.stock_quantity) === (p2.stockQuantity ?? p2.stock_quantity) &&
    (p1.minStockAlert ?? p1.min_stock_alert) === (p2.minStockAlert ?? p2.min_stock_alert)
  );
}

export default React.memo(PresetTileCard, arePresetCardPropsEqual);
