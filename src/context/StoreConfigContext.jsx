/* eslint-disable react/only-export-components, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';
import { fetchStoreConfigBackend, saveStoreConfigBackend } from '../api/posApi';
import { getStorageItem, setStorageItem } from '../utils/storage';

const StoreConfigContext = createContext(null);

export function StoreConfigProvider({ children }) {
  const [storeConfig, setStoreConfig] = useState(() => {
    try {
      const saved = getStorageItem('config');
      if (saved) return { ...DEFAULT_STORE_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore parse error
    }
    return DEFAULT_STORE_CONFIG;
  });

  const [isAdminMode, setIsAdminMode] = useState(false);

  // Sync highlight accent to root element
  useEffect(() => {
    const accent = storeConfig?.highlightColor || (() => {
      try {
        return localStorage.getItem('voltflow_highlight_color') || 'indigo';
      } catch {
        return 'indigo';
      }
    })();
    document.documentElement.setAttribute('data-accent', accent);
  }, [storeConfig?.highlightColor]);

  // Sync with SQLite backend on initial mount
  useEffect(() => {
    let isMounted = true;
    fetchStoreConfigBackend()
      .then((cfg) => {
        if (isMounted && cfg && typeof cfg === 'object') {
          setStoreConfig((prev) => ({ ...prev, ...cfg }));
          setStorageItem('config', cfg);
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
      setStorageItem('config', merged);
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
