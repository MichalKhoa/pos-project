import { useState, useEffect, useCallback } from 'react';
import { fetchStoreConfigBackend, saveStoreConfigBackend } from '../api/posApi';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';

export function usePosConfig() {
  const [storeConfig, setStoreConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('himmel_pos_config');
      return saved ? JSON.parse(saved) : DEFAULT_STORE_CONFIG;
    } catch {
      return DEFAULT_STORE_CONFIG;
    }
  });

  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    fetchStoreConfigBackend().then(res => {
      if (res) {
        setStoreConfig(prev => ({ ...prev, ...res }));
      }
    }).catch(err => {
      console.warn("Failed to load store config from backend:", err);
    });
  }, []);

  const updateStoreConfig = useCallback(async (newConfig) => {
    setStoreConfig(newConfig);
    try {
      const safeConfig = { ...newConfig };
      delete safeConfig.cashierPin;
      localStorage.setItem('himmel_pos_config', JSON.stringify(safeConfig));
      await saveStoreConfigBackend(newConfig);
    } catch (err) {
      console.error("Failed to save store config:", err);
    }
  }, []);

  return {
    storeConfig,
    setStoreConfig: updateStoreConfig,
    isAdminMode,
    setIsAdminMode
  };
}
