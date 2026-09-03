import React from 'react';
import { Search, AlertTriangle, Plus, Barcode, Calculator, Edit3, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function InventoryStockTable({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  categories,
  showLowStockOnly,
  setShowLowStockOnly,
  presetFilter = 'all',
  setPresetFilter,
  onOpenAddModal,
  filteredPresets,
  editingStock,
  handleStockChange,
  handleOpenStockKeypad,
  handleQuickAddStock,
  setEditingPresetTarget,
  handleSaveRow,
  isSaving,
  categoryMap,
  onTogglePin
}) {
  const { t } = useTranslation();

  return (
    <div className="inventory-main-content">
      {/* Filter & Search Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder={t('inventory.search_placeholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', height: '42px', fontSize: '0.9rem' }}
          />
        </div>

        <select
          className="input-field"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{ width: '180px', height: '42px', fontSize: '0.9rem' }}
        >
          <option value="all">{t('inventory.all_categories')}</option>
          {categories.filter(c => c.id !== 'all').map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Preset vs Warehouse Filter Segment */}
        {setPresetFilter && (
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-md)', gap: '3px', border: '1px solid var(--border-color)', height: '42px', alignItems: 'center' }}>
            <button
              type="button"
              className={`nav-tab ${presetFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem', fontWeight: '700', height: '34px' }}
              onClick={() => setPresetFilter('all')}
            >
              {t('common.all') || 'Vše'}
            </button>
            <button
              type="button"
              className={`nav-tab ${presetFilter === 'pinned' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem', fontWeight: '700', height: '34px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              onClick={() => setPresetFilter('pinned')}
              title={t('inventory.filter_pinned_desc') || 'Zobrazit pouze položky připnuté na pokladnu'}
            >
              <span>📌</span>
              <span>{t('inventory.filter_pinned') || 'Dlaždice'}</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${presetFilter === 'unpinned' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem', fontWeight: '700', height: '34px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              onClick={() => setPresetFilter('unpinned')}
              title={t('inventory.filter_unpinned_desc') || 'Zobrazit pouze skladové položky (bez tlačítka na pokladně)'}
            >
              <span>🏷️</span>
              <span>{t('inventory.filter_unpinned') || 'Pouze sklad'}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          className={`pay-btn ${showLowStockOnly ? 'pay-btn-card' : ''}`}
          style={{ height: '42px', padding: '0 1rem', fontSize: '0.82rem', background: showLowStockOnly ? 'var(--accent-amber)' : 'var(--bg-input)', color: showLowStockOnly ? '#fff' : 'var(--text-primary)', fontWeight: '700' }}
          onClick={() => setShowLowStockOnly(prev => !prev)}
        >
          <AlertTriangle size={16} />
          <span>{showLowStockOnly ? t('inventory.filter_showing_low') : t('inventory.filter_low_stock')}</span>
        </button>

        <button
          type="button"
          className="pay-btn pay-btn-cash"
          style={{ height: '42px', padding: '0 1.2rem', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}
          onClick={onOpenAddModal}
        >
          <Plus size={18} />
          <span>{t('inventory.add_item') || 'Přidat položku'}</span>
        </button>
      </div>

      {/* Main Inventory Table */}
      <div className="table-wrapper" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>{t('inventory.col_item')}</th>
              <th style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>📌 {t('inventory.col_pinned') || 'Na pokladně'}</th>
              <th style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>{t('inventory.col_track')}</th>
              <th style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>{t('inventory.col_stock')}</th>
              <th style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>{t('inventory.col_quick_add')}</th>
              <th style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>{t('inventory.col_min_alert')}</th>
              <th style={{ padding: '1rem 1rem', textAlign: 'left' }}>{t('inventory.col_barcode')}</th>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>{t('inventory.col_action')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredPresets.map(preset => {
              const hasEdit = editingStock[preset.id] !== undefined;
              const currentStock = hasEdit && editingStock[preset.id].stockQuantity !== undefined
                ? editingStock[preset.id].stockQuantity
                : (preset.stockQuantity || 0);

              const currentTrack = hasEdit && editingStock[preset.id].trackStock !== undefined
                ? editingStock[preset.id].trackStock
                : (preset.trackStock || false);

              const currentMin = hasEdit && editingStock[preset.id].minStockAlert !== undefined
                ? editingStock[preset.id].minStockAlert
                : (preset.minStockAlert || 5);

              const currentBarcode = hasEdit && editingStock[preset.id].barcode !== undefined
                ? editingStock[preset.id].barcode
                : (preset.barcode || '');

              const isPinned = preset.showInPresets !== undefined ? !!preset.showInPresets : (preset.show_in_presets !== undefined ? !!preset.show_in_presets : true);
              const cost = preset.costPrice !== undefined ? preset.costPrice : (preset.cost_price !== undefined ? preset.cost_price : 0);

              return (
                <tr key={preset.id} style={{ borderBottom: '1px solid var(--border-color)', background: isOut ? 'rgba(239, 68, 68, 0.05)' : isLow ? 'rgba(245, 158, 11, 0.05)' : 'transparent', transition: 'background 0.15s ease' }}>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{preset.name}</span>
                      {currentTrack && (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: '900',
                          padding: '2px 7px',
                          borderRadius: '12px',
                          background: isOut ? 'rgba(239, 68, 68, 0.2)' : isLow ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                          color: isOut ? 'var(--accent-rose)' : isLow ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                          border: `1px solid ${isOut ? 'rgba(239, 68, 68, 0.4)' : isLow ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`
                        }}>
                          {isOut ? 'Vyprodáno' : isLow ? 'Nízký stav' : 'Skladem'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {categoryMap[preset.category] || preset.category} • <span style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>{preset.price} Kč</span> s DPH
                      {cost > 0 && (
                        <span style={{ marginLeft: '0.4rem', color: 'var(--text-muted)' }}>
                          • Nákup: <strong style={{ color: 'var(--text-secondary)' }}>{cost.toFixed(2)} Kč</strong>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 1-Tap Quick Pin to Register Toggle */}
                  <td style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="pay-btn"
                      title={isPinned ? (t('inventory.unpin_action') || 'Odebrat z rychlých dlaždic na pokladně') : (t('inventory.pin_action') || 'Připnout na pokladnu jako rychlou dlaždici')}
                      style={{
                        height: '34px',
                        padding: '0 0.65rem',
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        borderRadius: 'var(--radius-sm)',
                        border: isPinned ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid var(--border-color)',
                        background: isPinned ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                        color: isPinned ? 'var(--accent-blue)' : 'var(--text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => onTogglePin && onTogglePin(preset.id)}
                    >
                      <span>{isPinned ? '📌' : '🏷️'}</span>
                      <span>{isPinned ? (t('inventory.pinned_tile') || 'Dlaždice') : (t('inventory.barcode_only_short') || 'Sklad')}</span>
                    </button>
                  </td>

                  <td style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={currentTrack}
                      onChange={e => handleStockChange(preset.id, 'trackStock', e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                    />
                  </td>

                  <td style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                      <input
                        type="number"
                        className="input-field"
                        value={currentStock}
                        onChange={e => handleStockChange(preset.id, 'stockQuantity', parseInt(e.target.value || '0', 10))}
                        style={{ width: '75px', height: '38px', textAlign: 'center', fontWeight: '900', fontSize: '1rem', color: isOut ? 'var(--accent-rose)' : isLow ? 'var(--accent-amber)' : 'inherit' }}
                      />
                      <button
                        type="button"
                        className="key-btn"
                        style={{ height: '38px', width: '38px', padding: 0, aspectRatio: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                        onClick={() => handleOpenStockKeypad(preset, currentStock)}
                        title="Otevřít numpad pro zadaný stav zásoby"
                      >
                        <Calculator size={18} />
                      </button>
                    </div>
                  </td>

                  <td style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                      {[+5, +10, +50].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className="key-btn"
                          style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.75rem', fontWeight: '800', aspectRatio: 'auto' }}
                          onClick={() => handleQuickAddStock(preset, amt)}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '1rem 0.65rem', textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input-field"
                      value={currentMin}
                      onChange={e => handleStockChange(preset.id, 'minStockAlert', parseInt(e.target.value || '5', 10))}
                      style={{ width: '70px', height: '38px', textAlign: 'center', fontSize: '0.88rem' }}
                    />
                  </td>

                  <td style={{ padding: '1rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Barcode size={18} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input-field"
                        placeholder={t('inventory.barcode_placeholder')}
                        value={currentBarcode}
                        onChange={e => handleStockChange(preset.id, 'barcode', e.target.value)}
                        style={{ height: '38px', fontSize: '0.85rem', width: '160px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </td>

                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="key-btn"
                        style={{ height: '36px', width: '36px', padding: 0, aspectRatio: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                        onClick={() => setEditingPresetTarget(preset)}
                        title="Upravit položku"
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        type="button"
                        className="pay-btn pay-btn-card"
                        disabled={!hasEdit || isSaving}
                        onClick={() => handleSaveRow(preset)}
                        style={{ height: '36px', padding: '0 0.9rem', fontSize: '0.8rem', opacity: hasEdit ? 1 : 0.4 }}
                      >
                        <Check size={16} />
                        <span>{t('common.save')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredPresets.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  {t('inventory.no_items')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
