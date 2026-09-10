import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DEFAULT_CATEGORIES, DEFAULT_PRESETS } from '../data/initialData';
import { getStorageItem, setStorageItem } from '../utils/storage';
import {
  fetchCategoriesBackend,
  saveCategoryBackend,
  deleteCategoryBackend,
  reorderCategoriesBackend,
  fetchPresetsBackend,
  savePresetBackend,
  deletePresetBackend,
  reorderPresetsBackend,
  togglePresetPinBackend
} from '../api/posApi';

export const sanitizePresets = (list) => {
  if (!Array.isArray(list)) return list;
  return list.map(p => {
    if (p && p.isGeneralPreset) {
      return { ...p, trackStock: false, stockQuantity: 0 };
    }
    return p;
  });
};

/**
 * Standalone utility to find a preset by barcode in an array of presets or Map
 */
export function lookupPresetByBarcode(presets, barcode) {
  if (!presets || !barcode) return null;
  const target = String(barcode).trim().toLowerCase();
  if (!target) return null;

  if (presets instanceof Map) {
    return presets.get(target) || null;
  }

  if (Array.isArray(presets)) {
    for (const p of presets) {
      if (!p || !p.barcode) continue;
      const codes = String(p.barcode)
        .split(',')
        .map(b => b.trim().toLowerCase())
        .filter(Boolean);
      if (codes.includes(target)) {
        return p;
      }
    }
  }
  return null;
}

export function usePosCatalog() {
  const lastBackendFetchRef = useRef(0);
  const isDirtyRef = useRef(false);

  const [categories, setCategories] = useState(() => {
    try {
      const saved = getStorageItem('categories');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const [presets, setPresets] = useState(() => {
    try {
      const saved = getStorageItem('presets');
      const parsed = saved ? JSON.parse(saved) : null;
      const initial = Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRESETS;
      return sanitizePresets(initial);
    } catch {
      return sanitizePresets(DEFAULT_PRESETS);
    }
  });

  // Sync to LocalStorage (offline fallback)
  useEffect(() => {
    setStorageItem('categories', categories);
  }, [categories]);

  useEffect(() => {
    setStorageItem('presets', presets);
  }, [presets]);

  // Load from backend on mount and handle storage/focus sync
  const reloadBackendCatalog = useCallback((force = false) => {
    if (!force && !isDirtyRef.current && (Date.now() - lastBackendFetchRef.current < 60000)) {
      return;
    }
    lastBackendFetchRef.current = Date.now();
    isDirtyRef.current = false;

    fetchCategoriesBackend().then(data => {
      if (Array.isArray(data) && data.length > 0) setCategories(data);
    });
    fetchPresetsBackend().then(data => {
      if (Array.isArray(data) && data.length > 0) setPresets(sanitizePresets(data));
    });
  }, []);

  useEffect(() => {
    reloadBackendCatalog(true);

    const handleStorageChange = (e) => {
      if (!e.key || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if ((e.key === 'voltflow_pos_categories' || e.key === 'himmel_pos_categories') && Array.isArray(data)) {
          setCategories(data);
        } else if ((e.key === 'voltflow_pos_presets' || e.key === 'himmel_pos_presets') && Array.isArray(data)) {
          setPresets(sanitizePresets(data));
        }
      } catch (err) {
        console.warn('Multi-tab storage sync error in catalog:', err);
      }
    };

    const handleFocus = () => {
      reloadBackendCatalog(false);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [reloadBackendCatalog]);

  // Category handlers
  const handleAddCategory = useCallback((name) => {
    if (!name.trim()) return;
    isDirtyRef.current = true;
    const newCat = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      position: categories.length
    };
    setCategories(prev => [...prev, newCat]);
    saveCategoryBackend(newCat);
    return newCat.id;
  }, [categories.length]);

  const handleEditCategory = useCallback((catId, newName) => {
    if (!newName.trim() || catId === 'all') return;
    isDirtyRef.current = true;
    setCategories(prev => prev.map(c => {
      if (c.id !== catId) return c;
      const updated = { ...c, name: newName.trim() };
      saveCategoryBackend(updated);
      return updated;
    }));
  }, []);

  const handleDeleteCategory = useCallback((catId) => {
    if (catId === 'all') return;
    isDirtyRef.current = true;
    setCategories(prev => prev.filter(c => c.id !== catId));
    deleteCategoryBackend(catId);
    const fallbackCategory = categories.find(c => c.id !== 'all' && c.id !== catId)?.id || 'all';
    setPresets(prev => prev.map(p => {
      if (p.category !== catId) return p;
      const updated = { ...p, category: fallbackCategory };
      savePresetBackend(updated);
      return updated;
    }));
  }, [categories]);

  const handleReorderCategories = useCallback(async (reordered) => {
    isDirtyRef.current = true;
    setCategories(reordered);
    setStorageItem('categories', reordered);
    await reorderCategoriesBackend(reordered);
  }, []);

  // Preset handlers
  const handleAddPreset = useCallback(async (presetData) => {
    isDirtyRef.current = true;
    const newPreset = {
      ...presetData,
      id: `preset-${Date.now()}`
    };
    setPresets(prev => sanitizePresets([...prev, newPreset]));
    await savePresetBackend(newPreset);
  }, []);

  const handleUpdatePreset = useCallback(async (updated) => {
    isDirtyRef.current = true;
    setPresets(prev => sanitizePresets(prev.map(p => p.id === updated.id ? updated : p)));
    await savePresetBackend(updated);
  }, []);

  const handleDeletePreset = useCallback(async (presetId) => {
    isDirtyRef.current = true;
    setPresets(prev => prev.filter(p => p.id !== presetId));
    await deletePresetBackend(presetId);
  }, []);

  const handleReorderPresets = useCallback(async (reordered) => {
    isDirtyRef.current = true;
    setPresets(sanitizePresets(reordered));
    await reorderPresetsBackend(reordered);
  }, []);

  const handleTogglePresetPin = useCallback(async (presetId) => {
    isDirtyRef.current = true;
    setPresets(prev => sanitizePresets(prev.map(p => {
      if (p.id === presetId) {
        const currentPin = p.showInPresets !== undefined ? !!p.showInPresets : (p.show_in_presets !== undefined ? !!p.show_in_presets : true);
        const nextPin = !currentPin;
        return { ...p, showInPresets: nextPin, show_in_presets: nextPin };
      }
      return p;
    })));
    await togglePresetPinBackend(presetId);
  }, []);

  // In-memory barcode lookup Map (lowercase trimmed barcode -> preset)
  const barcodeMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(presets)) return map;
    for (const p of presets) {
      if (!p || !p.barcode) continue;
      const codes = String(p.barcode)
        .split(',')
        .map(b => b.trim().toLowerCase())
        .filter(Boolean);
      for (const code of codes) {
        if (!map.has(code)) {
          map.set(code, p);
        }
      }
    }
    return map;
  }, [presets]);

  const findPresetByBarcode = useCallback((barcode) => {
    if (!barcode) return null;
    const target = String(barcode).trim().toLowerCase();
    if (!target) return null;
    return barcodeMap.get(target) || null;
  }, [barcodeMap]);

  return {
    categories,
    setCategories,
    presets,
    setPresets,
    barcodeMap,
    findPresetByBarcode,
    handleAddCategory,
    handleEditCategory,
    handleDeleteCategory,
    handleReorderCategories,
    handleAddPreset,
    handleUpdatePreset,
    handleDeletePreset,
    handleReorderPresets,
    handleTogglePresetPin,
    reloadBackendCatalog
  };
}
