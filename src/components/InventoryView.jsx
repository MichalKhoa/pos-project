import React, { useState } from 'react';
import { Search, Package, AlertTriangle, Check, Barcode, ShieldAlert, TrendingUp, Plus, Calculator, Edit3 } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { savePresetBackend } from '../api/posApi';
import PresetModal from './PresetModal';

export default function InventoryView({ presets = [], categories = [], onUpdatePresets, onAddPreset }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [editingStock, setEditingStock] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Add & Edit Item Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPresetTarget, setEditingPresetTarget] = useState(null);

  // Stock Keypad Modal state
  const [stockKeypadTarget, setStockKeypadTarget] = useState(null);
  const [stockKeypadValue, setStockKeypadValue] = useState('0');

  const handleOpenStockKeypad = (preset, currentStock) => {
    setStockKeypadTarget(preset);
    setStockKeypadValue(currentStock.toString());
  };

  const handleConfirmStockKeypad = () => {
    if (!stockKeypadTarget) return;
    const newStock = Math.max(0, parseInt(stockKeypadValue || '0', 10));
    handleStockChange(stockKeypadTarget.id, 'stockQuantity', newStock);
    setStockKeypadTarget(null);
  };

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.name;
    return acc;
  }, {});

  const handleSavePresetModal = async (updatedPreset) => {
    setIsSaving(true);
    try {
      if (editingPresetTarget) {
        const updatedList = presets.map(p => p.id === updatedPreset.id ? updatedPreset : p);
        await savePresetBackend(updatedPreset);
        if (onUpdatePresets) onUpdatePresets(updatedList);
        setStatusMessage({ type: 'success', text: `Položka "${updatedPreset.name}" byla úspěšně upravena.` });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Chyba při ukládání změněné položky.' });
    } finally {
      setIsSaving(false);
      setEditingPresetTarget(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleDeletePresetModal = async (presetId) => {
    if (window.confirm('Opravdu chcete tuto položku smazat ze skladu?')) {
      setIsSaving(true);
      try {
        const remaining = presets.filter(p => p.id !== presetId);
        if (onUpdatePresets) onUpdatePresets(remaining);
        setStatusMessage({ type: 'success', text: 'Položka byla smazána.' });
      } catch (err) {
        console.error(err);
      } finally {
        setIsSaving(false);
        setEditingPresetTarget(null);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    }
  };

  const handleSaveNewPreset = async (newPreset) => {
    setIsSaving(true);
    try {
      if (onAddPreset) {
        onAddPreset(newPreset);
      } else {
        await savePresetBackend(newPreset);
        if (onUpdatePresets) onUpdatePresets([newPreset, ...presets]);
      }

      setStatusMessage({ type: 'success', text: `Položka ${newPreset.name} byla úspěšně přidána.` });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Chyba při přidávání položky: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Exclude General Presets completely from Inventory View
  const individualPresets = presets.filter(p => !p.isGeneralPreset);

  const filteredPresets = individualPresets.filter(p => {
    const nameMatch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const barcodeMatch = (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase());
    const catMatch = selectedCategory === 'all' || p.category === selectedCategory;
    const isTracked = p.trackStock;
    const isLowStock = isTracked && ((p.stockQuantity || 0) <= (p.minStockAlert || 5));

    if (showLowStockOnly && !isLowStock) return false;
    return (nameMatch || barcodeMatch) && catMatch;
  });

  const trackedPresets = individualPresets.filter(p => p.trackStock);
  const totalTrackedCount = trackedPresets.length;
  const lowStockItems = trackedPresets.filter(p => (p.stockQuantity || 0) <= (p.minStockAlert || 5));
  const lowStockCount = lowStockItems.length;
  const outOfStockCount = trackedPresets.filter(p => (p.stockQuantity || 0) <= 0).length;
  const healthyStockCount = trackedPresets.filter(p => (p.stockQuantity || 0) > (p.minStockAlert || 5)).length;

  // Total Monetary Inventory Valuation in CZK
  const totalValuation = trackedPresets.reduce((sum, p) => sum + ((p.price || 0) * (p.stockQuantity || 0)), 0);

  const healthyPct = totalTrackedCount > 0 ? (healthyStockCount / totalTrackedCount) * 100 : 100;
  const lowPct = totalTrackedCount > 0 ? ((lowStockCount - outOfStockCount) / totalTrackedCount) * 100 : 0;
  const outPct = totalTrackedCount > 0 ? (outOfStockCount / totalTrackedCount) * 100 : 0;

  const handleStockChange = (id, field, value) => {
    setEditingStock(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };

  const handleQuickAddStock = (preset, amount) => {
    const currentVal = editingStock[preset.id]?.stockQuantity !== undefined
      ? editingStock[preset.id].stockQuantity
      : (preset.stockQuantity || 0);
    const newStock = Math.max(0, parseInt(currentVal, 10) + amount);
    handleStockChange(preset.id, 'stockQuantity', newStock);
  };

  const handleDirectRestockAndSave = async (preset, amount) => {
    const currentVal = preset.stockQuantity || 0;
    const newStock = currentVal + amount;
    const updatedPreset = {
      ...preset,
      stockQuantity: newStock,
      trackStock: true
    };

    setIsSaving(true);
    try {
      await savePresetBackend(updatedPreset);
      const newPresets = presets.map(p => p.id === preset.id ? updatedPreset : p);
      if (onUpdatePresets) onUpdatePresets(newPresets);

      setStatusMessage({ type: 'success', text: t('inventory.saved_success', { name: preset.name }) });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({ type: 'error', text: t('inventory.save_error', { error: err.message }) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRow = async (preset) => {
    const edits = editingStock[preset.id];
    if (!edits) return;

    setIsSaving(true);
    const updatedPreset = {
      ...preset,
      stockQuantity: edits.stockQuantity !== undefined ? parseInt(edits.stockQuantity, 10) : (preset.stockQuantity || 0),
      trackStock: edits.trackStock !== undefined ? edits.trackStock : (preset.trackStock || false),
      minStockAlert: edits.minStockAlert !== undefined ? parseInt(edits.minStockAlert, 10) : (preset.minStockAlert || 5),
      barcode: edits.barcode !== undefined ? edits.barcode : (preset.barcode || '')
    };

    try {
      await savePresetBackend(updatedPreset);
      const newPresets = presets.map(p => p.id === preset.id ? updatedPreset : p);
      if (onUpdatePresets) onUpdatePresets(newPresets);

      setEditingStock(prev => {
        const copy = { ...prev };
        delete copy[preset.id];
        return copy;
      });

      setStatusMessage({ type: 'success', text: t('inventory.saved_success', { name: preset.name }) });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({ type: 'error', text: t('inventory.save_error', { error: err.message }) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="full-view-container">
      {/* Header & Status Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Package style={{ color: 'var(--accent-blue)', width: '28px', height: '28px' }} />
            <span>{t('inventory.title')}</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {t('inventory.subtitle')}
          </p>
        </div>

        {/* Header Summary Badges */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg-card)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Package size={20} style={{ color: 'var(--accent-blue)' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('inventory.tracked_items')}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: '900' }}>{totalTrackedCount}</div>
            </div>
          </div>

          <div
            style={{
              background: lowStockCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-card)',
              borderColor: lowStockCount > 0 ? 'var(--accent-amber)' : 'var(--border-color)',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer'
            }}
            onClick={() => setShowLowStockOnly(prev => !prev)}
            title={t('inventory.low_stock_title')}
          >
            <AlertTriangle size={20} style={{ color: 'var(--accent-amber)' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('inventory.low_stock')}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--accent-amber)' }}>{lowStockCount}</div>
            </div>
          </div>

          <div style={{ background: outOfStockCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)', borderColor: outOfStockCount > 0 ? 'var(--accent-rose)' : 'var(--border-color)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ShieldAlert size={20} style={{ color: 'var(--accent-rose)' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('inventory.out_of_stock')}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--accent-rose)' }}>{outOfStockCount}</div>
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div style={{ background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: statusMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)', border: `1px solid ${statusMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`, padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', fontWeight: '700' }}>
          {statusMessage.text}
        </div>
      )}

      {/* 2-Column Split Layout */}
      <div className="inventory-split-container">
        {/* Main Content Area (Table + Filters) */}
        <div className="inventory-main-content">
          {/* Filter & Search Toolbar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
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
              style={{ width: '200px', height: '42px', fontSize: '0.9rem' }}
            >
              <option value="all">{t('inventory.all_categories')}</option>
              {categories.filter(c => c.id !== 'all').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button
              type="button"
              className={`pay-btn ${showLowStockOnly ? 'pay-btn-card' : ''}`}
              style={{ height: '42px', padding: '0 1.2rem', fontSize: '0.85rem', background: showLowStockOnly ? 'var(--accent-amber)' : 'var(--bg-input)', color: showLowStockOnly ? '#fff' : 'var(--text-primary)', fontWeight: '700' }}
              onClick={() => setShowLowStockOnly(prev => !prev)}
            >
              <AlertTriangle size={16} />
              <span>{showLowStockOnly ? t('inventory.filter_showing_low') : t('inventory.filter_low_stock')}</span>
            </button>

            <button
              type="button"
              className="pay-btn pay-btn-cash"
              style={{ height: '42px', padding: '0 1.2rem', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={18} />
              <span>Přidat položku</span>
            </button>
          </div>

          {/* Main Inventory Table */}
          <div className="table-wrapper" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>{t('inventory.col_item')}</th>
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

                  const isLow = currentTrack && currentStock <= currentMin;
                  const isOut = currentTrack && currentStock <= 0;

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
                        </div>
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
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      {t('inventory.no_items')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar: Stock Analytics & Low Stock Action Center */}
        <div className="inventory-sidebar">
          {/* Inventory Valuation Card */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={16} style={{ color: 'var(--accent-emerald)' }} />
                <span>Ocenění skladu</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0.2rem' }}>Celková hodnota zásoby</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                {totalValuation.toLocaleString()} Kč
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Spočítáno z {totalTrackedCount} sledovaných položek
              </div>
            </div>

            {/* Health Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                <span>Stav zásob</span>
                <span style={{ color: 'var(--accent-emerald)' }}>{healthyPct.toFixed(0)}% v pořádku</span>
              </div>
              <div className="stock-health-bar-container">
                <div className="stock-health-bar-segment" style={{ width: `${healthyPct}%`, background: 'var(--accent-emerald)' }} title={`V pořádku: ${healthyStockCount}`} />
                <div className="stock-health-bar-segment" style={{ width: `${lowPct}%`, background: 'var(--accent-amber)' }} title={`Nízký stav: ${lowStockCount - outOfStockCount}`} />
                <div className="stock-health-bar-segment" style={{ width: `${outPct}%`, background: 'var(--accent-rose)' }} title={`Vyprodáno: ${outOfStockCount}`} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                <span>🟢 {healthyStockCount} OK</span>
                <span>🟡 {lowStockCount - outOfStockCount} Nízké</span>
                <span>🔴 {outOfStockCount} 0 ks</span>
              </div>
            </div>
          </div>

          {/* Low Stock Action Center */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} />
                <span>Rychlé naskladnění ({lowStockCount})</span>
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Položky vyžadující doplnění zásoby:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '2px' }}>
              {lowStockItems.map(item => {
                const isOut = (item.stockQuantity || 0) <= 0;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--bg-input)',
                      border: `1px solid ${isOut ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {item.name}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '900',
                        color: isOut ? 'var(--accent-rose)' : 'var(--accent-amber)',
                        background: isOut ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        padding: '1px 6px',
                        borderRadius: '6px'
                      }}>
                        📦 {item.stockQuantity || 0} ks
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                      {[+10, +50, +100].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className="key-btn"
                          style={{
                            flex: 1,
                            height: '30px',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            aspectRatio: 'auto',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: 'var(--accent-blue)',
                            borderColor: 'rgba(59, 130, 246, 0.25)'
                          }}
                          onClick={() => handleDirectRestockAndSave(item, amt)}
                          title={`Přidat +${amt} ks a ihned uložit`}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {lowStockItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--accent-emerald)', fontSize: '0.82rem', fontWeight: '700', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)' }}>
                  ✨ Všechny sledované položky mají dostatečnou zásobu.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <PresetModal
        isOpen={isAddModalOpen}
        mode="add"
        categories={categories}
        defaultCategory={selectedCategory}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveNewPreset}
      />

      {/* Edit Modal */}
      <PresetModal
        isOpen={!!editingPresetTarget}
        mode="edit"
        preset={editingPresetTarget}
        categories={categories}
        defaultCategory={selectedCategory}
        onClose={() => setEditingPresetTarget(null)}
        onSave={handleSavePresetModal}
        onDelete={editingPresetTarget ? () => handleDeletePresetModal(editingPresetTarget.id) : undefined}
      />

      {/* Touch Numpad Modal for Stock Quantity Editing */}
      {stockKeypadTarget && (
        <div className="modal-overlay" onClick={() => setStockKeypadTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <Calculator size={20} style={{ color: 'var(--accent-blue)' }} />
                <span>Úprava skladu: {stockKeypadTarget.name}</span>
              </div>
              <button className="close-modal-btn" onClick={() => setStockKeypadTarget(null)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Quantity Display Box */}
              <div className="keypad-input-container" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', fontWeight: '600' }}>
                  Nová skladová zásoba
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                  {stockKeypadValue || '0'} ks
                </div>
              </div>

              {/* Quick Modifier Chips */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center', margin: '0.65rem 0' }}>
                {[-10, -5, -1, +1, +5, +10, +50].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    className="vat-btn"
                    style={{ flex: 1, minWidth: '45px', padding: '0.45rem 0.2rem', fontSize: '0.8rem', fontWeight: '800' }}
                    onClick={() => {
                      const cur = parseInt(stockKeypadValue || '0', 10);
                      const nextVal = Math.max(0, cur + amt);
                      setStockKeypadValue(nextVal.toString());
                    }}
                  >
                    {amt > 0 ? `+${amt}` : amt}
                  </button>
                ))}
                <button
                  type="button"
                  className="vat-btn"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontWeight: '800', color: 'var(--accent-rose)' }}
                  onClick={() => setStockKeypadValue('0')}
                >
                  0 ks
                </button>
              </div>

              {/* Numpad Grid */}
              <div className="keypad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {['7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    className="key-btn"
                    style={{ height: '52px', aspectRatio: 'auto' }}
                    onClick={() => setStockKeypadValue(prev => prev === '0' ? num : prev.length < 6 ? prev + num : prev)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className="key-btn key-action"
                  style={{ height: '52px', aspectRatio: 'auto' }}
                  onClick={() => setStockKeypadValue(prev => prev.length > 1 ? prev.slice(0, -1) : '0')}
                >
                  ⌫
                </button>

                {['4', '5', '6'].map(num => (
                  <button
                    key={num}
                    type="button"
                    className="key-btn"
                    style={{ height: '52px', aspectRatio: 'auto' }}
                    onClick={() => setStockKeypadValue(prev => prev === '0' ? num : prev.length < 6 ? prev + num : prev)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className="key-btn key-action"
                  style={{ height: '52px', fontSize: '0.9rem', fontWeight: '700', aspectRatio: 'auto' }}
                  onClick={() => setStockKeypadValue('0')}
                >
                  C
                </button>

                {['1', '2', '3'].map(num => (
                  <button
                    key={num}
                    type="button"
                    className="key-btn"
                    style={{ height: '52px', aspectRatio: 'auto' }}
                    onClick={() => setStockKeypadValue(prev => prev === '0' ? num : prev.length < 6 ? prev + num : prev)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className="key-btn"
                  style={{ height: '52px', aspectRatio: 'auto', fontWeight: '800' }}
                  onClick={() => setStockKeypadValue(prev => (parseInt(prev || '0', 10) + 10).toString())}
                >
                  +10
                </button>

                <button
                  type="button"
                  className="key-btn"
                  style={{ height: '52px', gridColumn: 'span 2', aspectRatio: 'auto' }}
                  onClick={() => setStockKeypadValue(prev => prev === '0' ? '0' : prev.length < 6 ? prev + '0' : prev)}
                >
                  0
                </button>
                <button
                  type="button"
                  className="key-btn"
                  style={{ height: '52px', gridColumn: 'span 2', aspectRatio: 'auto' }}
                  onClick={() => setStockKeypadValue(prev => prev === '0' ? '0' : prev.length < 6 ? prev + '00' : prev)}
                >
                  00
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.85rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  style={{ flex: 1, justifyContent: 'center', height: '48px' }}
                  onClick={() => setStockKeypadTarget(null)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="pay-btn pay-btn-cash"
                  style={{ flex: 1.5, height: '48px' }}
                  onClick={handleConfirmStockKeypad}
                >
                  <Check size={18} />
                  <span>Uložit stav</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
