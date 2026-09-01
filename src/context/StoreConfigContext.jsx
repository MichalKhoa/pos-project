/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';
import { fetchStoreConfigBackend, saveStoreConfigBackend } from '../api/posApi';

const StoreConfigContext = createContext(null);

export function StoreConfigProvider({ children }) {
  const [storeConfig, setStoreConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('himmel_pos_config');
      if (saved) return { ...DEFAULT_STORE_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore parse error
    }
    return DEFAULT_STORE_CONFIG;
  });

  const [isAdminMode, setIsAdminMode] = useState(false);

  // Sync with SQLite backend on initial mount
  useEffect(() => {
    let isMounted = true;
    fetchStoreConfigBackend()
      .then((cfg) => {
        if (isMounted && cfg && typeof cfg === 'object') {
          setStoreConfig((prev) => ({ ...prev, ...cfg }));
          localStorage.setItem('himmel_pos_config', JSON.stringify(cfg));
        }
      })
      .catch(() => {
        // offline fallback
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateStoreConfig = useCallback(async (newConfig) => {
    const merged = { ...storeConfig, ...newConfig };
    setStoreConfig(merged);
    try {
      localStorage.setItem('himmel_pos_config', JSON.stringify(merged));
      await saveStoreConfigBackend(merged);
    } catch (e) {
      console.warn('Failed to save store configuration to backend:', e);
    }
  }, [storeConfig]);

  const toggleAdminMode = useCallback(() => {
    setIsAdminMode((prev) => !prev);
  }, []);

  const value = {
    storeConfig,
    setStoreConfig,
    updateStoreConfig,
    isAdminMode,
    setIsAdminMode,
    toggleAdminMode
  };

  return (
    <StoreConfigContext.Provider value={value}>
      {children}
    </StoreConfigContext.Provider>
  );
}

export function useStoreConfig() {
  const context = useContext(StoreConfigContext);
  if (!context) {
    throw new Error('useStoreConfig must be used within a StoreConfigProvider');
  }
  return context;
}
