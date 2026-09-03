import { useState, useEffect, useCallback } from 'react';
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

export function usePosCatalog() {
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
  const reloadBackendCatalog = useCallback(() => {
    fetchCategoriesBackend().then(data => {
      if (Array.isArray(data) && data.length > 0) setCategories(data);
    });
    fetchPresetsBackend().then(data => {
      if (Array.isArray(data) && data.length > 0) setPresets(sanitizePresets(data));
    });
  }, []);

  useEffect(() => {
    reloadBackendCatalog();

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
      reloadBackendCatalog();
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
    setCategories(prev => prev.map(c => {
      if (c.id !== catId) return c;
      const updated = { ...c, name: newName.trim() };
      saveCategoryBackend(updated);
      return updated;
    }));
  }, []);

  const handleDeleteCategory = useCallback((catId) => {
    if (catId === 'all') return;
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
    setCategories(reordered);
    setStorageItem('categories', reordered);
    await reorderCategoriesBackend(reordered);
  }, []);

  // Preset handlers
  const handleAddPreset = useCallback(async (presetData) => {
    const newPreset = {
      ...presetData,
      id: `preset-${Date.now()}`
    };
    setPresets(prev => sanitizePresets([...prev, newPreset]));
    await savePresetBackend(newPreset);
  }, []);

  const handleUpdatePreset = useCallback(async (updated) => {
    setPresets(prev => sanitizePresets(prev.map(p => p.id === updated.id ? updated : p)));
    await savePresetBackend(updated);
  }, []);

  const handleDeletePreset = useCallback(async (presetId) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
    await deletePresetBackend(presetId);
  }, []);

  const handleReorderPresets = useCallback(async (reordered) => {
    setPresets(sanitizePresets(reordered));
    await reorderPresetsBackend(reordered);
  }, []);

  const handleTogglePresetPin = useCallback(async (presetId) => {
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

  return {
    categories,
    setCategories,
    presets,
    setPresets,
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
