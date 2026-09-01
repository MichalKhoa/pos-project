import React from 'react';

export default function PresetStockFields({
  isGeneralPreset,
  trackStock,
  stockQuantity,
  onChangeStockQuantity,
  minStockAlert,
  onChangeMinStockAlert
}) {
  if (isGeneralPreset || !trackStock) return null;

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <div style={{ flex: 1 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
          Počáteční stav skladu (ks)
        </label>
        <input
          type="number"
          placeholder="10"
          value={stockQuantity}
          onChange={e => onChangeStockQuantity(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)'
          }}
        />
      </div>

      <div style={{ flex: 1 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
          Min. limit varování (ks)
        </label>
        <input
          type="number"
          placeholder="5"
          value={minStockAlert}
          onChange={e => onChangeMinStockAlert(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)'
          }}
        />
      </div>
    </div>
  );
}
