import React, { useState } from 'react';
import { Search, Package, AlertTriangle, Check, Barcode, ShieldAlert } from 'lucide-react';
import { savePresetBackend } from '../api/posApi';

export default function InventoryView({ presets = [], categories = [], onUpdatePresets }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [editingStock, setEditingStock] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.name;
    return acc;
  }, {});

  const filteredPresets = presets.filter(p => {
    const nameMatch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const barcodeMatch = (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase());
    const catMatch = selectedCategory === 'all' || p.category === selectedCategory;
    const isTracked = p.trackStock;
    const isLowStock = isTracked && ((p.stockQuantity || 0) <= (p.minStockAlert || 5));

    if (showLowStockOnly && !isLowStock) return false;
    return (nameMatch || barcodeMatch) && catMatch;
  });

  const lowStockCount = presets.filter(p => p.trackStock && (p.stockQuantity || 0) <= (p.minStockAlert || 5)).length;
  const outOfStockCount = presets.filter(p => p.trackStock && (p.stockQuantity || 0) <= 0).length;
  const totalTrackedCount = presets.filter(p => p.trackStock).length;

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

      setStatusMessage({ type: 'success', text: `Zásoby u ${preset.name} byly úspěšně uloženy.` });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Chyba při ukládání zásab: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="view-container" style={{ padding: '1.2rem', gap: '1rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package style={{ color: 'var(--accent-blue)' }} />
            <span>Správa Skladových Zásob & Čárových Kódů</span>
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Přehled naskladnění, úroveň minimálních zásob a registrace EAN kódů.
          </p>
        </div>

        {/* Quick Summary Cards */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg-input)', padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Package size={18} style={{ color: 'var(--accent-blue)' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sledované položky</div>
              <div style={{ fontSize: '1rem', fontWeight: '800' }}>{totalTrackedCount}</div>
            </div>
          </div>

          <div
            style={{
              background: lowStockCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-input)',
              borderColor: lowStockCount > 0 ? 'var(--accent-amber)' : 'var(--border-color)',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              cursor: 'pointer'
            }}
            onClick={() => setShowLowStockOnly(prev => !prev)}
            title="Klikněte pro zobrazení položek vyžadujících naskladnění"
          >
            <AlertTriangle size={18} style={{ color: 'var(--accent-amber)' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nízká zásoba (Min)</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent-amber)' }}>{lowStockCount}</div>
            </div>
          </div>

          <div style={{ background: outOfStockCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-input)', borderColor: outOfStockCount > 0 ? 'var(--accent-rose)' : 'var(--border-color)', padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={18} style={{ color: 'var(--accent-rose)' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vyprodáno ($\le$ 0 ks)</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent-rose)' }}>{outOfStockCount}</div>
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div style={{ background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: statusMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)', border: `1px solid ${statusMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`, padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '700' }}>
          {statusMessage.text}
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Hledat název zboží nebo EAN čárový kód..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.2rem', height: '38px', fontSize: '0.85rem' }}
          />
        </div>

        <select
          className="input-field"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{ width: '180px', height: '38px', fontSize: '0.85rem' }}
        >
          <option value="all">Všechny kategorie</option>
          {categories.filter(c => c.id !== 'all').map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          type="button"
          className={`pay-btn ${showLowStockOnly ? 'pay-btn-card' : ''}`}
          style={{ height: '38px', padding: '0 1rem', fontSize: '0.8rem', background: showLowStockOnly ? 'var(--accent-amber)' : 'var(--bg-input)', color: showLowStockOnly ? '#fff' : 'var(--text-primary)' }}
          onClick={() => setShowLowStockOnly(prev => !prev)}
        >
          <AlertTriangle size={14} />
          <span>{showLowStockOnly ? 'Zobrazeno: Pouze vyžadující naskladnění' : 'Filtr: Nízká zásoba'}</span>
        </button>
      </div>

      {/* Inventory Table */}
      <div className="table-wrapper" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Položka Katalogu</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Sledovat</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Skladová Zásoba</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Rychlé Naskladnění</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Min. Zásoba</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>EAN / Čárový Kód</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Akce</th>
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
                <tr key={preset.id} style={{ borderBottom: '1px solid var(--border-color)', background: isOut ? 'rgba(239, 68, 68, 0.05)' : isLow ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{preset.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {categoryMap[preset.category] || preset.category} • {preset.price} Kč s DPH
                    </div>
                  </td>

                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={currentTrack}
                      onChange={e => handleStockChange(preset.id, 'trackStock', e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </td>

                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input-field"
                      value={currentStock}
                      onChange={e => handleStockChange(preset.id, 'stockQuantity', parseInt(e.target.value || '0', 10))}
                      style={{ width: '75px', height: '32px', textAlign: 'center', fontWeight: '800', color: isOut ? 'var(--accent-rose)' : isLow ? 'var(--accent-amber)' : 'inherit' }}
                    />
                  </td>

                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      {[+5, +10, +50].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className="key-btn"
                          style={{ height: '28px', padding: '0 0.4rem', fontSize: '0.7rem', fontWeight: '700' }}
                          onClick={() => handleQuickAddStock(preset, amt)}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input-field"
                      value={currentMin}
                      onChange={e => handleStockChange(preset.id, 'minStockAlert', parseInt(e.target.value || '5', 10))}
                      style={{ width: '60px', height: '32px', textAlign: 'center' }}
                    />
                  </td>

                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Barcode size={16} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input-field"
                        placeholder="EAN čárový kód..."
                        value={currentBarcode}
                        onChange={e => handleStockChange(preset.id, 'barcode', e.target.value)}
                        style={{ height: '32px', fontSize: '0.8rem', width: '150px' }}
                      />
                    </div>
                  </td>

                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="pay-btn pay-btn-card"
                      disabled={!hasEdit || isSaving}
                      onClick={() => handleSaveRow(preset)}
                      style={{ height: '32px', padding: '0 0.75rem', fontSize: '0.75rem', opacity: hasEdit ? 1 : 0.4 }}
                    >
                      <Check size={14} />
                      <span>Uložit</span>
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredPresets.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Žádné skladové položky neodpovídají zadaným kritériím.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
