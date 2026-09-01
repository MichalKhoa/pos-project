import React, { useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { savePresetBackend } from '../api/posApi';
import PresetModal from './PresetModal';
import InventoryMetricsBar from './inventory/InventoryMetricsBar.jsx';
import InventoryStockTable from './inventory/InventoryStockTable.jsx';
import StockKeypadModal from './inventory/StockKeypadModal.jsx';

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
        const next = { ...prev };
        delete next[preset.id];
        return next;
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
    <div className="full-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Metrics Valuation Bar */}
      <InventoryMetricsBar
        totalTrackedCount={totalTrackedCount}
        healthyStockCount={healthyStockCount}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
        totalValuation={totalValuation}
        healthyPct={healthyPct}
        lowPct={lowPct}
        outPct={outPct}
      />

      {statusMessage && (
        <div style={{ background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: statusMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)', border: `1px solid ${statusMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`, padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', fontWeight: '700' }}>
          {statusMessage.text}
        </div>
      )}

      {/* Main Stock Table */}
      <InventoryStockTable
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        showLowStockOnly={showLowStockOnly}
        setShowLowStockOnly={setShowLowStockOnly}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        filteredPresets={filteredPresets}
        editingStock={editingStock}
        handleStockChange={handleStockChange}
        handleOpenStockKeypad={handleOpenStockKeypad}
        handleQuickAddStock={handleQuickAddStock}
        setEditingPresetTarget={setEditingPresetTarget}
        handleSaveRow={handleSaveRow}
        isSaving={isSaving}
        categoryMap={categoryMap}
      />

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

      {/* Stock Keypad Modal */}
      <StockKeypadModal
        stockKeypadTarget={stockKeypadTarget}
        stockKeypadValue={stockKeypadValue}
        setStockKeypadValue={setStockKeypadValue}
        onClose={() => setStockKeypadTarget(null)}
        onConfirm={handleConfirmStockKeypad}
      />
    </div>
  );
}
