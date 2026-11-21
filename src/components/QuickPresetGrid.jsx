import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Layers, Check, Edit3, Search, X, FolderPlus, Trash2, Calculator } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/initialData';
import CategoryManagerModal from './CategoryManagerModal';
import PresetModal from './PresetModal';
import CustomItemModal from './CustomItemModal';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { useConfirm } from '../context/useConfirm.js';
import { usePresetDragDrop } from '../hooks/usePresetDragDrop';
import CategoryFilterBar from './presets/CategoryFilterBar.jsx';
import PresetTileCard from './presets/PresetTileCard.jsx';
import OpenPriceModal from './presets/OpenPriceModal.jsx';
import WeightEntryModal from './presets/WeightEntryModal.jsx';

function QuickPresetGrid({
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
  storeConfig = null,
  isPriceCheckActive = false,
  onTogglePriceCheck = null,
  onInspectPrice = null,
  onOpenCustomModal = null,
  onOpenWeightModal = null
}) {
  const { t } = useTranslation();
  const { askConfirm } = useConfirm();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | null
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [managingCatId, setManagingCatId] = useState(null);
  const [editingPreset, setEditingPreset] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [isInternalCustomModalOpen, setIsInternalCustomModalOpen] = useState(false);
  const [internalWeightPreset, setInternalWeightPreset] = useState(null);

  const handleOpenCustomItem = () => {
    if (onOpenCustomModal) {
      onOpenCustomModal();
    } else {
      setIsInternalCustomModalOpen(true);
    }
  };

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
      return localStorage.getItem('pos_preset_button_style') || 'tinted';
    } catch {
      return 'tinted';
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
      // Only show items configured as touch presets on register
      const isPinned = p.showInPresets !== undefined ? !!p.showInPresets : (p.show_in_presets !== undefined ? !!p.show_in_presets : true);
      if (!isPinned) return false;

      // A typed search looks through every category, not only the open one.
      const matchesCategory = searchTerm.trim() || activeCategory === 'all' || p.category === activeCategory;
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

  const handleTrashDrop = async (e) => {
    e.preventDefault();
    setIsOverTrash(false);
    if (draggedIndex !== null && filteredPresets[draggedIndex]) {
      const targetPreset = filteredPresets[draggedIndex];
      const confirmMsg = t('presets.confirm_delete_named', { name: targetPreset.name });
      if (await askConfirm({ message: confirmMsg, danger: true, confirmLabel: t('dialogs.delete_button') })) {
        onDeletePreset(targetPreset.id);
      }
    }
  };

  const keypadAmountRef = useRef(keypadAmount);
  keypadAmountRef.current = keypadAmount;

  const itemMultiplierRef = useRef(itemMultiplier);
  itemMultiplierRef.current = itemMultiplier;

  const isEditModeRef = useRef(isEditMode);
  isEditModeRef.current = isEditMode;

  const isPriceCheckActiveRef = useRef(isPriceCheckActive);
  isPriceCheckActiveRef.current = isPriceCheckActive;

  const handleCardClick = useCallback((preset) => {
    if (isDraggingRef.current) return;
    if (isPriceCheckActiveRef.current) {
      if (onInspectPrice) onInspectPrice(preset);
      return;
    }
    if (isEditModeRef.current) {
      setEditingPreset(preset);
      setActiveModal('edit');
      return;
    }

    const currentKeypad = keypadAmountRef.current;
    const currentMultiplier = itemMultiplierRef.current;

    const isReturn = (currentMultiplier < 0) || Boolean(currentKeypad && currentKeypad.startsWith('-'));
    const parsedKeypad = parseFloat(currentKeypad);
    const hasNumericKeypad = !isNaN(parsedKeypad) && parsedKeypad !== 0;

    if (preset.isWeighted || preset.is_weighted) {
      const presetWithPrice = hasNumericKeypad
        ? { ...preset, initialUnitPrice: Math.abs(parsedKeypad) }
        : preset;

      if (hasNumericKeypad && onClearKeypadAmount) {
        onClearKeypadAmount();
      }

      if (onOpenWeightModal) {
        onOpenWeightModal(presetWithPrice);
      } else {
        setInternalWeightPreset(presetWithPrice);
      }
      return;
    }

    if (hasNumericKeypad) {
      const customPrice = isReturn ? -Math.abs(parsedKeypad) : Math.abs(parsedKeypad);
      onAddToCart({
        ...preset,
        price: customPrice,
        quantity: Math.max(1, Math.abs(currentMultiplier || 1))
      });
      if (onClearKeypadAmount) onClearKeypadAmount();
      if (setItemMultiplier && currentMultiplier !== 1) setItemMultiplier(1);
      return;
    }

    if (preset.isGeneralPreset || preset.price === 0 || preset.price === '0' || !preset.price) {
      setOpenPriceTarget(preset);
      setEnteredOpenPrice('');
      const openQty = Math.max(1, Math.abs(currentMultiplier || 1));
      setOpenPriceQty(isReturn ? -openQty : openQty);
      return;
    }

    const unitPrice = isReturn ? -Math.abs(parseFloat(preset.price)) : parseFloat(preset.price);
    onAddToCart({
      ...preset,
      price: unitPrice,
      quantity: Math.max(1, Math.abs(currentMultiplier || 1))
    });

    if (onClearKeypadAmount && isReturn) onClearKeypadAmount();
    if (setItemMultiplier && currentMultiplier !== 1) {
      setItemMultiplier(1);
    }
  }, [onAddToCart, onClearKeypadAmount, setItemMultiplier, onInspectPrice, isDraggingRef, onOpenWeightModal]);

  const handleOpenPriceSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const finalPrice = parseFloat(enteredOpenPrice);
    if (isNaN(finalPrice) || finalPrice === 0 || !openPriceTarget) return;

    // The modal opens already in the pad's return mode, so its own state is the only source.
    const isReturn = openPriceQty < 0;
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
      <div className="section-header catalog-header">
        <div className="section-title">
          <Layers size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('presets.title')}</span>
        </div>

        <div className="catalog-actions">
          {itemMultiplier > 1 && (
            <div className="catalog-multiplier" title={t('presets.multiplier_active')}>
              <span>⚡ {itemMultiplier}×</span>
              <button
                type="button"
                onClick={() => setItemMultiplier && setItemMultiplier(1)}
                aria-label={t('common.clear')}
              >
                <X size={13} />
              </button>
            </div>
          )}

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
                title={t('common.clear')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Custom Item 1-Tap Opener */}
          <button
            type="button"
            className="nav-tab catalog-action-btn is-custom"
            onClick={handleOpenCustomItem}
            title={t('custom_item.title')}
          >
            <Calculator size={15} strokeWidth={2.5} />
            <span>{t('custom_item.custom_btn')}</span>
          </button>

          {/* Price Check Mode 1-Tap Toggle (F2) */}
          {onTogglePriceCheck && (
            <button
              type="button"
              className={`nav-tab catalog-action-btn is-icon is-price-check ${isPriceCheckActive ? 'active' : ''}`}
              onClick={onTogglePriceCheck}
              title={t('price_check.toggle_hint')}
              aria-label={isPriceCheckActive ? t('price_check.toggle_active') : t('price_check.toggle_btn')}
              aria-pressed={isPriceCheckActive}
            >
              <Search size={17} strokeWidth={2.5} />
            </button>
          )}

          <button
            type="button"
            className={`nav-tab catalog-action-btn is-icon is-edit ${isEditMode ? 'active' : ''}`}
            onClick={() => setIsEditMode(!isEditMode)}
            title={t('presets.toggle_edit')}
            aria-label={t('presets.edit')}
            aria-pressed={isEditMode}
          >
            {isEditMode ? <Check size={17} /> : <Edit3 size={17} />}
          </button>
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
            onClick={() => {
              setEditingPreset(null);
              setActiveModal('add');
            }}
            title={t('presets.add_preset')}
          >
            <Plus size={15} />
            <span>{t('presets.add_preset')}</span>
          </button>

          <button
            type="button"
            className="preset-edit-cat-btn"
            onClick={() => handleOpenCategoryManager(null)}
            title={t('presets.manage_categories')}
          >
            <FolderPlus size={15} />
            <span>{t('presets.add_category')}</span>
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
        onDelete={editingPreset ? async () => {
          if (await askConfirm({ message: t('dialogs.delete_preset'), danger: true, confirmLabel: t('dialogs.delete_button') })) {
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

      {/* Custom Item Modal (when used standalone without external coordinator) */}
      {isInternalCustomModalOpen && (
        <CustomItemModal
          isOpen={isInternalCustomModalOpen}
          onClose={() => setIsInternalCustomModalOpen(false)}
          onAddToCart={onAddToCart}
          defaultVat={storeConfig?.defaultVat}
          initialMultiplier={itemMultiplier}
          autoOpenTouchKeyboard={storeConfig?.autoOpenTouchKeyboard}
          storeConfig={storeConfig}
        />
      )}

      {/* Weight Entry Modal (when used standalone without external coordinator) */}
      {internalWeightPreset && (
        <WeightEntryModal
          isOpen={!!internalWeightPreset}
          preset={internalWeightPreset}
          onClose={() => setInternalWeightPreset(null)}
          onAddToCart={(item) => {
            onAddToCart(item);
            setInternalWeightPreset(null);
          }}
        />
      )}
    </div>
  );
}

export default React.memo(QuickPresetGrid);
