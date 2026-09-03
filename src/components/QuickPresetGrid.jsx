import React, { useState, useMemo } from 'react';
import { Plus, Layers, Check, Edit3, Search, X, FolderPlus, Trash2 } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/initialData';
import CategoryManagerModal from './CategoryManagerModal';
import PresetModal from './PresetModal';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { usePresetDragDrop } from '../hooks/usePresetDragDrop';
import CategoryFilterBar from './presets/CategoryFilterBar.jsx';
import PresetTileCard from './presets/PresetTileCard.jsx';
import OpenPriceModal from './presets/OpenPriceModal.jsx';

export default function QuickPresetGrid({
  presets,
  categories = DEFAULT_CATEGORIES,
  itemMultiplier = 1,
  setItemMultiplier,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onReorderCategories,
  onAddToCart,
  onAddPreset,
  onUpdatePreset,
  onDeletePreset,
  onReorderPresets,
  keypadAmount = '',
  onClearKeypadAmount,
  isAdminMode = false,
  storeConfig = null
}) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | null
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [managingCatId, setManagingCatId] = useState(null);
  const [editingPreset, setEditingPreset] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);

  const handleOpenCategoryManager = (catId = null) => {
    setManagingCatId(catId);
    setIsCategoryModalOpen(true);
  };

  // Open Price Prompt Modal State
  const [openPriceTarget, setOpenPriceTarget] = useState(null);
  const [enteredOpenPrice, setEnteredOpenPrice] = useState('');
  const [openPriceQty, setOpenPriceQty] = useState(1);

  const density = storeConfig?.presetDensity || (() => {
    try {
      return localStorage.getItem('voltflow_pos_preset_density') || localStorage.getItem('himmel_pos_preset_density') || 'standard';
    } catch {
      return 'standard';
    }
  })();

  const buttonStyle = storeConfig?.presetButtonStyle || (() => {
    try {
      return localStorage.getItem('pos_preset_button_style') || 'left-stripe';
    } catch {
      return 'left-stripe';
    }
  })();

  const gridColumnsSetting = storeConfig?.presetGridColumns || 'auto';
  const getGridStyle = () => {
    if (gridColumnsSetting === '3') return { gridTemplateColumns: 'repeat(3, 1fr)' };
    if (gridColumnsSetting === '4') return { gridTemplateColumns: 'repeat(4, 1fr)' };
    if (gridColumnsSetting === '5') return { gridTemplateColumns: 'repeat(5, 1fr)' };
    if (gridColumnsSetting === '6') return { gridTemplateColumns: 'repeat(6, 1fr)' };
    return undefined;
  };

  const filteredPresets = useMemo(() => {
    return presets.filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const matchesSearch = !searchTerm.trim() ||
        (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.price && p.price.toString().includes(searchTerm)) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [presets, activeCategory, searchTerm]);

  const {
    draggedIndex,
    dragOverIndex,
    isDraggingRef,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  } = usePresetDragDrop({
    presets,
    filteredPresets,
    activeCategory,
    isEditMode,
    onReorderPresets
  });

  const handleTrashDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isOverTrash) setIsOverTrash(true);
  };

  const handleTrashDragLeave = () => {
    setIsOverTrash(false);
  };

  const handleTrashDrop = (e) => {
    e.preventDefault();
    setIsOverTrash(false);
    if (draggedIndex !== null && filteredPresets[draggedIndex]) {
      const targetPreset = filteredPresets[draggedIndex];
      const confirmMsg = t('presets.confirm_delete_named', { name: targetPreset.name }) || `Opravdu chcete smazat ${targetPreset.name}?`;
      if (window.confirm(confirmMsg)) {
        onDeletePreset(targetPreset.id);
      }
    }
  };

  const handleCardClick = (preset) => {
    if (isDraggingRef.current) return;
    if (isEditMode) {
      setEditingPreset(preset);
      setActiveModal('edit');
      return;
    }

    const isReturn = (itemMultiplier < 0) || Boolean(keypadAmount && keypadAmount.startsWith('-'));
    const parsedKeypad = parseFloat(keypadAmount);
    const hasNumericKeypad = !isNaN(parsedKeypad) && parsedKeypad !== 0;

    if (hasNumericKeypad) {
      const customPrice = isReturn ? -Math.abs(parsedKeypad) : Math.abs(parsedKeypad);
      onAddToCart({
        ...preset,
        price: customPrice,
        quantity: Math.max(1, Math.abs(itemMultiplier || 1))
      });
      if (onClearKeypadAmount) onClearKeypadAmount();
      if (setItemMultiplier && itemMultiplier !== 1) setItemMultiplier(1);
      return;
    }

    if (preset.isGeneralPreset || preset.price === 0 || preset.price === '0' || !preset.price) {
      setOpenPriceTarget(preset);
      setEnteredOpenPrice('');
      setOpenPriceQty(Math.max(1, Math.abs(itemMultiplier || 1)));
      return;
    }

    const unitPrice = isReturn ? -Math.abs(parseFloat(preset.price)) : parseFloat(preset.price);
    onAddToCart({
      ...preset,
      price: unitPrice,
      quantity: Math.max(1, Math.abs(itemMultiplier || 1))
    });

    if (onClearKeypadAmount && isReturn) onClearKeypadAmount();
    if (setItemMultiplier && itemMultiplier !== 1) {
      setItemMultiplier(1);
    }
  };

  const handleOpenPriceSubmit = (e) => {
    e.preventDefault();
    const finalPrice = parseFloat(enteredOpenPrice);
    if (isNaN(finalPrice) || finalPrice === 0 || !openPriceTarget) return;

    const isReturn = (openPriceQty < 0) || (itemMultiplier < 0) || Boolean(keypadAmount && keypadAmount.startsWith('-')) || Boolean(enteredOpenPrice && enteredOpenPrice.startsWith('-'));
    const effectivePrice = isReturn ? -Math.abs(finalPrice) : Math.abs(finalPrice);

    onAddToCart({
      ...openPriceTarget,
      price: effectivePrice,
      quantity: Math.max(1, Math.abs(openPriceQty || 1))
    });

    setOpenPriceTarget(null);
    setEnteredOpenPrice('');
    setOpenPriceQty(1);
    if (onClearKeypadAmount) onClearKeypadAmount();
    if (setItemMultiplier && itemMultiplier !== 1) setItemMultiplier(1);
  };

  const handleSavePreset = (presetData) => {
    if (activeModal === 'add') {
      onAddPreset(presetData);
    } else if (activeModal === 'edit' && editingPreset) {
      onUpdatePreset({ ...presetData, id: editingPreset.id });
    }
    setActiveModal(null);
    setEditingPreset(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="section-header">
        <div className="section-title">
          <Layers size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('presets.title')}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
            ({filteredPresets.length})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}>
          {itemMultiplier > 1 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                height: '38px',
                padding: '0 0.65rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title="Aktivní násobič množství"
            >
              <span>⚡ {itemMultiplier}×</span>
              <button
                type="button"
                onClick={() => setItemMultiplier && setItemMultiplier(1)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1px' }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <button
            type="button"
            className="nav-tab"
            style={{
              height: '38px',
              minHeight: '38px',
              padding: '0 0.75rem',
              fontSize: '0.82rem',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--accent-blue)',
              fontWeight: '700',
              gap: '0.35rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              touchAction: 'manipulation'
            }}
            onClick={() => {
              setEditingPreset(null);
              setActiveModal('add');
            }}
            title={t('presets.add_preset')}
          >
            <Plus size={15} />
            <span>{t('common.add') || 'Přidat'}</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${isEditMode ? 'active' : ''}`}
            style={{
              height: '38px',
              minHeight: '38px',
              padding: '0 0.85rem',
              fontSize: '0.82rem',
              background: isEditMode ? 'var(--accent-amber)' : 'rgba(255,255,255,0.06)',
              color: isEditMode ? '#000000' : 'var(--text-primary)',
              fontWeight: '700',
              gap: '0.35rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              touchAction: 'manipulation'
            }}
            onClick={() => setIsEditMode(!isEditMode)}
            title="Zapnout/Vypnout režim úprav tlačítek pokladny"
          >
            {isEditMode ? <Check size={15} /> : <Edit3 size={15} />}
            <span>{isEditMode ? 'Hotovo' : t('presets.edit') || 'Upravit'}</span>
          </button>

          {isAdminMode && (
            <button
              type="button"
              className="nav-tab"
              style={{
                height: '38px',
                minHeight: '38px',
                padding: '0 0.75rem',
                fontSize: '0.82rem',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--accent-purple)',
                fontWeight: '700',
                gap: '0.35rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                touchAction: 'manipulation'
              }}
              onClick={() => setIsCategoryModalOpen(true)}
              title={t('presets.manage_categories')}
            >
              <FolderPlus size={15} />
              <span>{t('presets.add_category')}</span>
            </button>
          )}

          {/* Dedicated Modern Product Search Bar (First from the right) */}
          <div className="preset-search-bar">
            <Search size={15} className="preset-search-icon" />
            <input
              type="text"
              className="preset-search-input"
              placeholder={t('presets.search')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <span className="preset-search-badge">
                {filteredPresets.length}
              </span>
            )}
            {searchTerm && (
              <button
                type="button"
                className="preset-search-clear"
                onClick={() => setSearchTerm('')}
                title={t('common.clear') || 'Vymazat'}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter Bar (Multi-line wrap + drag reorder) */}
      <CategoryFilterBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        isEditMode={isEditMode}
        onManageCategories={handleOpenCategoryManager}
        onReorderCategories={onReorderCategories}
      />

      {/* Light Separator between Categories and Presets */}
      <div className="category-presets-separator" />

      {/* Edit Mode Control Bar with Category Management & Drag-to-Delete Trash Dropzone */}
      {isEditMode && (
        <div className="preset-edit-mode-bar">
          <div className="preset-edit-hint">
            <Edit3 size={15} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <span>{t('presets.edit_mode_hint')}</span>
          </div>

          <button
            type="button"
            className="preset-edit-cat-btn"
            onClick={() => handleOpenCategoryManager(null)}
            title={t('presets.manage_categories')}
          >
            <FolderPlus size={15} />
            <span>{t('presets.manage_categories') || 'Kategorie'}</span>
          </button>

          <div
            className={`preset-trash-dropzone ${draggedIndex !== null ? 'drag-active' : ''} ${isOverTrash ? 'over-trash' : ''}`}
            onDragOver={handleTrashDragOver}
            onDragLeave={handleTrashDragLeave}
            onDrop={handleTrashDrop}
            title={t('presets.drag_to_delete')}
          >
            <Trash2 size={16} className="trash-icon" />
            <span className="trash-label">
              {isOverTrash && draggedIndex !== null && filteredPresets[draggedIndex]
                ? `${t('presets.drop_to_delete')}: "${filteredPresets[draggedIndex].name}"`
                : t('presets.drag_to_delete')}
            </span>
          </div>

          <button
            type="button"
            className="preset-edit-done-btn"
            onClick={() => setIsEditMode(false)}
            title={t('presets.done_editing')}
          >
            <Check size={15} />
            <span>{t('presets.done_editing')}</span>
          </button>
        </div>
      )}

      {/* Grid of Preset Cards */}
      <div className={`preset-grid density-${density}`} style={getGridStyle()}>
        {filteredPresets.map((preset, index) => (
          <PresetTileCard
            key={preset.id}
            preset={preset}
            index={index}
            isEditMode={isEditMode}
            itemMultiplier={itemMultiplier}
            isDraggingThis={draggedIndex === index}
            isDragOverThis={dragOverIndex === index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onClick={handleCardClick}
            storeConfig={storeConfig}
            buttonStyle={buttonStyle}
          />
        ))}
      </div>

      {/* Open Price Modal */}
      <OpenPriceModal
        openPriceTarget={openPriceTarget}
        onClose={() => setOpenPriceTarget(null)}
        enteredOpenPrice={enteredOpenPrice}
        setEnteredOpenPrice={setEnteredOpenPrice}
        openPriceQty={openPriceQty}
        setOpenPriceQty={setOpenPriceQty}
        onSubmit={handleOpenPriceSubmit}
      />

      {/* Preset Add / Edit Modal */}
      <PresetModal
        isOpen={activeModal === 'add' || activeModal === 'edit'}
        mode={activeModal === 'add' ? 'add' : 'edit'}
        preset={editingPreset}
        categories={categories}
        defaultCategory={activeCategory}
        onClose={() => { setActiveModal(null); setEditingPreset(null); }}
        onSave={handleSavePreset}
        onDelete={editingPreset ? () => {
          if (window.confirm('Opravdu chcete toto tlačítko smazat?')) {
            onDeletePreset(editingPreset.id);
            setActiveModal(null);
            setEditingPreset(null);
          }
        } : undefined}
        storeConfig={storeConfig}
        buttonStyle={buttonStyle}
      />

      {/* Category Manager Modal */}
      {isCategoryModalOpen && (
        <CategoryManagerModal
          categories={categories}
          initialEditingCatId={managingCatId}
          onAddCategory={(name) => {
            const createdId = onAddCategory(name);
            return createdId;
          }}
          onEditCategory={onEditCategory}
          onDeleteCategory={onDeleteCategory}
          onReorderCategories={onReorderCategories}
          onClose={() => {
            setIsCategoryModalOpen(false);
            setManagingCatId(null);
          }}
          onSelectCategory={(id) => setActiveCategory(id)}
        />
      )}
    </div>
  );
}
