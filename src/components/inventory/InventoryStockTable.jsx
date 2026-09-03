import React, { useState, useMemo } from 'react';
import { Search, AlertTriangle, Plus, Barcode, Calculator, Edit3, Check, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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

  const [sortField, setSortField] = useState('name'); // 'name' | 'pinned' | 'stock' | 'minStock'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'pinned' ? 'desc' : 'asc');
    }
  };

  const sortedPresets = useMemo(() => {
    return [...filteredPresets].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        const nameA = a.name || '';
        const nameB = b.name || '';
        comparison = nameA.localeCompare(nameB, 'cs', { sensitivity: 'base' });
      } else if (sortField === 'pinned') {
        const pinA = a.showInPresets !== undefined ? !!a.showInPresets : (a.show_in_presets !== undefined ? !!a.show_in_presets : true);
        const pinB = b.showInPresets !== undefined ? !!b.showInPresets : (b.show_in_presets !== undefined ? !!b.show_in_presets : true);
        comparison = (pinA === pinB ? 0 : pinA ? 1 : -1);
      } else if (sortField === 'stock') {
        const stockA = editingStock[a.id]?.stockQuantity !== undefined ? editingStock[a.id].stockQuantity : (a.stockQuantity || 0);
        const stockB = editingStock[b.id]?.stockQuantity !== undefined ? editingStock[b.id].stockQuantity : (b.stockQuantity || 0);
        comparison = stockA - stockB;
      } else if (sortField === 'minStock') {
        const minA = editingStock[a.id]?.minStockAlert !== undefined ? editingStock[a.id].minStockAlert : (a.minStockAlert || 5);
        const minB = editingStock[b.id]?.minStockAlert !== undefined ? editingStock[b.id].minStockAlert : (b.minStockAlert || 5);
        comparison = minA - minB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredPresets, sortField, sortDirection, editingStock]);

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.35, flexShrink: 0 }} />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp size={13} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
      : <ArrowDown size={13} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />;
  };

  return (
    <div className="inventory-main-content">
      {/* Filter & Search Toolbar (Ergonomic 38px Touch Targets) */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder={t('inventory.search_placeholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.3rem', height: '38px', fontSize: '0.88rem' }}
          />
        </div>

        <select
          className="input-field"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{ width: '160px', height: '38px', fontSize: '0.86rem', padding: '0 0.65rem' }}
        >
          <option value="all">{t('inventory.all_categories')}</option>
          {categories.filter(c => c.id !== 'all').map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Preset vs Warehouse Filter Segment */}
        {setPresetFilter && (
          <div style={{ display: 'inline-flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-sm)', gap: '3px', border: '1px solid var(--border-color)', height: '38px', alignItems: 'center' }}>
            <button
              type="button"
              className={`nav-tab ${presetFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0 0.65rem', fontSize: '0.8rem', fontWeight: '700', height: '30px', minHeight: 'unset', border: 'none' }}
              onClick={() => setPresetFilter('all')}
            >
              {t('common.all') || 'Vše'}
            </button>
            <button
              type="button"
              className={`nav-tab ${presetFilter === 'pinned' ? 'active' : ''}`}
              style={{ padding: '0 0.65rem', fontSize: '0.8rem', fontWeight: '700', height: '30px', minHeight: 'unset', border: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              onClick={() => setPresetFilter('pinned')}
              title={t('inventory.filter_pinned_desc') || 'Zobrazit pouze položky připnuté na pokladnu'}
            >
              <span>📌</span>
              <span>{t('inventory.filter_pinned') || 'Dlaždice'}</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${presetFilter === 'unpinned' ? 'active' : ''}`}
              style={{ padding: '0 0.65rem', fontSize: '0.8rem', fontWeight: '700', height: '30px', minHeight: 'unset', border: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
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
          onClick={() => setShowLowStockOnly(prev => !prev)}
          style={{
            height: '38px',
            padding: '0 0.85rem',
            fontSize: '0.82rem',
            fontWeight: '800',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            borderRadius: 'var(--radius-sm)',
            border: showLowStockOnly ? '1px solid var(--accent-amber)' : '1px solid var(--border-color)',
            background: showLowStockOnly ? 'var(--accent-amber)' : 'var(--bg-input)',
            color: showLowStockOnly ? '#000000' : 'var(--text-primary)',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          title={showLowStockOnly ? 'Zrušit filtr nízkých zásob' : 'Filtrovat pouze položky s nízkou zásobou'}
        >
          <AlertTriangle size={15} style={{ color: showLowStockOnly ? '#000000' : 'var(--accent-amber)' }} />
          <span>{showLowStockOnly ? (t('inventory.filter_showing_low') || 'Nízké zásoby') : (t('inventory.filter_low_stock') || 'Nízký stav')}</span>
        </button>

        <button
          type="button"
          onClick={onOpenAddModal}
          style={{
            height: '38px',
            padding: '0 1rem',
            fontSize: '0.85rem',
            fontWeight: '800',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-emerald)',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            marginLeft: 'auto',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: 'opacity 0.15s ease'
          }}
        >
          <Plus size={16} />
          <span>{t('inventory.add_item') || 'Přidat položku'}</span>
        </button>
      </div>

      {/* Main Inventory Table (High Density & Sticky Header) */}
      <div className="table-wrapper" style={{ flex: 1, maxHeight: 'calc(100dvh - 165px)', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)' }}>
            <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              <th
                style={{ padding: '0.65rem 0.85rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('name')}
                title="Seřadit podle názvu položky"
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ color: sortField === 'name' ? 'var(--text-primary)' : 'inherit', fontWeight: sortField === 'name' ? '800' : 'inherit' }}>
                    {t('inventory.col_item')}
                  </span>
                  {renderSortIcon('name')}
                </div>
              </th>

              <th
                style={{ padding: '0.65rem 0.45rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('pinned')}
                title="Seřadit podle připnutí na pokladnu"
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                  <span style={{ color: sortField === 'pinned' ? 'var(--text-primary)' : 'inherit', fontWeight: sortField === 'pinned' ? '800' : 'inherit' }}>
                    📌 {t('inventory.col_pinned') || 'Na pokladně'}
                  </span>
                  {renderSortIcon('pinned')}
                </div>
              </th>

              <th style={{ padding: '0.65rem 0.45rem', textAlign: 'center' }}>{t('inventory.col_track')}</th>

              <th
                style={{ padding: '0.65rem 0.45rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('stock')}
                title="Seřadit podle skladové zásoby"
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                  <span style={{ color: sortField === 'stock' ? 'var(--text-primary)' : 'inherit', fontWeight: sortField === 'stock' ? '800' : 'inherit' }}>
                    {t('inventory.col_stock')}
                  </span>
                  {renderSortIcon('stock')}
                </div>
              </th>

              <th style={{ padding: '0.65rem 0.45rem', textAlign: 'center' }}>{t('inventory.col_quick_add')}</th>

              <th
                style={{ padding: '0.65rem 0.45rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('minStock')}
                title="Seřadit podle minimálního stavu"
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                  <span style={{ color: sortField === 'minStock' ? 'var(--text-primary)' : 'inherit', fontWeight: sortField === 'minStock' ? '800' : 'inherit' }}>
                    {t('inventory.col_min_alert')}
                  </span>
                  {renderSortIcon('minStock')}
                </div>
              </th>

              <th style={{ padding: '0.65rem 0.65rem', textAlign: 'left' }}>{t('inventory.col_barcode')}</th>
              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>{t('inventory.col_action')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPresets.map(preset => {
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
              const isLow = currentTrack && currentStock <= currentMin;
              const isOut = currentTrack && currentStock <= 0;

              return (
                <tr key={preset.id} style={{ borderBottom: '1px solid var(--border-color)', background: isOut ? 'rgba(239, 68, 68, 0.05)' : isLow ? 'rgba(245, 158, 11, 0.05)' : 'transparent', transition: 'background 0.15s ease' }}>
                  <td style={{ padding: '0.45rem 0.85rem' }}>
                    <div style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>{preset.name}</span>
                      {currentTrack && (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: '900',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: isOut ? 'rgba(239, 68, 68, 0.2)' : isLow ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                          color: isOut ? 'var(--accent-rose)' : isLow ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                          border: `1px solid ${isOut ? 'rgba(239, 68, 68, 0.4)' : isLow ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`
                        }}>
                          {isOut ? 'Vyprodáno' : isLow ? 'Nízký stav' : 'Skladem'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {categoryMap[preset.category] || preset.category} • <span style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>{preset.price} Kč</span> s DPH
                      {cost > 0 && (
                        <span style={{ marginLeft: '0.35rem', color: 'var(--text-muted)' }}>
                          • Nákup: <strong style={{ color: 'var(--text-secondary)' }}>{cost.toFixed(2)} Kč</strong>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 1-Tap Quick Pin to Register Toggle */}
                  <td style={{ padding: '0.55rem 0.45rem', textAlign: 'center' }}>
                    <button
                      type="button"
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
                        justifyContent: 'center',
                        gap: '0.3rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => onTogglePin && onTogglePin(preset.id)}
                    >
                      <span>{isPinned ? '📌' : '🏷️'}</span>
                      <span>{isPinned ? (t('inventory.pinned_tile') || 'Dlaždice') : (t('inventory.barcode_only_short') || 'Sklad')}</span>
                    </button>
                  </td>

                  <td style={{ padding: '0.55rem 0.45rem', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={currentTrack}
                      onChange={e => handleStockChange(preset.id, 'trackStock', e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                    />
                  </td>

                  <td style={{ padding: '0.55rem 0.45rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}>
                      <input
                        type="number"
                        className="input-field"
                        value={currentStock}
                        onChange={e => handleStockChange(preset.id, 'stockQuantity', parseInt(e.target.value || '0', 10))}
                        style={{ width: '70px', height: '38px', textAlign: 'center', fontWeight: '900', fontSize: '1rem', color: isOut ? 'var(--accent-rose)' : isLow ? 'var(--accent-amber)' : 'inherit' }}
                      />
                      <button
                        type="button"
                        className="key-btn"
                        style={{ height: '38px', width: '38px', padding: 0, aspectRatio: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                        onClick={() => handleOpenStockKeypad(preset, currentStock)}
                        title="Otevřít numpad pro zadaný stav zásoby"
                      >
                        <Calculator size={16} />
                      </button>
                    </div>
                  </td>

                  <td style={{ padding: '0.55rem 0.45rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                      {[+5, +10, +50].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className="key-btn"
                          style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.78rem', fontWeight: '800', aspectRatio: 'auto' }}
                          onClick={() => handleQuickAddStock(preset, amt)}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '0.55rem 0.45rem', textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input-field"
                      value={currentMin}
                      onChange={e => handleStockChange(preset.id, 'minStockAlert', parseInt(e.target.value || '5', 10))}
                      style={{ width: '62px', height: '38px', textAlign: 'center', fontSize: '0.88rem' }}
                    />
                  </td>

                  <td style={{ padding: '0.55rem 0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Barcode size={16} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input-field"
                        placeholder={t('inventory.barcode_placeholder')}
                        value={currentBarcode}
                        onChange={e => handleStockChange(preset.id, 'barcode', e.target.value)}
                        style={{ height: '38px', fontSize: '0.85rem', width: '145px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </td>

                  <td style={{ padding: '0.55rem 0.85rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="key-btn"
                        style={{ height: '38px', width: '38px', padding: 0, aspectRatio: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                        onClick={() => setEditingPresetTarget(preset)}
                        title="Upravit položku"
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        type="button"
                        disabled={!hasEdit || isSaving}
                        onClick={() => handleSaveRow(preset)}
                        style={{
                          height: '38px',
                          padding: '0 0.85rem',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: hasEdit ? 'var(--accent-blue)' : 'var(--bg-input)',
                          color: hasEdit ? '#ffffff' : 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: hasEdit ? 'pointer' : 'default',
                          opacity: hasEdit ? 1 : 0.4,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Check size={16} />
                        <span>{t('common.save')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {sortedPresets.length === 0 && (
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
