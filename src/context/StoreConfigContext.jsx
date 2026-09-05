/* eslint-disable react/only-export-components, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';
import { fetchStoreConfigBackend, saveStoreConfigBackend } from '../api/posApi';
import { getStorageItem, setStorageItem } from '../utils/storage';

const TECHNICIAN_SESSION_TIMEOUT_SECONDS = 10 * 60; // 10 minutes = 600s

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
  const [adminSessionRemainingSeconds, setAdminSessionRemainingSeconds] = useState(0);
  const [adminPin, setAdminPin] = useState(null);
  const lastAdminActivityRef = useRef(Date.now());

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

  // Sync button animation mode to root element ('instant' by default for touchscreens)
  useEffect(() => {
    const animMode = storeConfig?.buttonAnimationMode || (() => {
      try {
        return localStorage.getItem('voltflow_button_animation_mode') || 'instant';
      } catch {
        return 'instant';
      }
    })();
    document.documentElement.setAttribute('data-button-animation', animMode);
  }, [storeConfig?.buttonAnimationMode]);

  // Sync font size to root element ('md' / 16px by default)
  const currentFontSize = storeConfig?.fontSize || (() => {
    try {
      return localStorage.getItem('voltflow_font_size') || 'md';
    } catch {
      return 'md';
    }
  })();

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', currentFontSize);
    try {
      localStorage.setItem('voltflow_font_size', currentFontSize);
    } catch (e) {
      console.warn(e);
    }
  }, [currentFontSize]);

  // Sync with SQLite backend on initial mount with retry loop for cold-start
  useEffect(() => {
    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 25; // 25 * 600ms = 15 seconds cold-start polling
    let timerId = null;

    const attemptSync = () => {
      fetchStoreConfigBackend()
        .then((cfg) => {
          if (isMounted && cfg && typeof cfg === 'object') {
            setStoreConfig((prev) => ({ ...prev, ...cfg }));
            setStorageItem('config', cfg);
          }
        })
        .catch(() => {
          if (isMounted && attempts < maxAttempts) {
            attempts += 1;
            timerId = setTimeout(attemptSync, 600);
          }
        });
    };

    attemptSync();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
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

  const enterAdminMode = useCallback((pin = null) => {
    lastAdminActivityRef.current = Date.now();
    setAdminPin(pin);
    setIsAdminMode(true);
    setAdminSessionRemainingSeconds(TECHNICIAN_SESSION_TIMEOUT_SECONDS);
  }, []);

  const exitAdminMode = useCallback(() => {
    setIsAdminMode(false);
    setAdminPin(null);
    setAdminSessionRemainingSeconds(0);
  }, []);

  const resetAdminInactivity = useCallback(() => {
    lastAdminActivityRef.current = Date.now();
    if (isAdminMode) {
      setAdminSessionRemainingSeconds(TECHNICIAN_SESSION_TIMEOUT_SECONDS);
    }
  }, [isAdminMode]);

  const toggleAdminMode = useCallback(() => {
    setIsAdminMode((prev) => {
      if (prev) {
        setAdminPin(null);
        setAdminSessionRemainingSeconds(0);
        return false;
      } else {
        lastAdminActivityRef.current = Date.now();
        setAdminSessionRemainingSeconds(TECHNICIAN_SESSION_TIMEOUT_SECONDS);
        return true;
      }
    });
  }, []);

  // Inactivity tracking: 10-minute auto-lock
  useEffect(() => {
    if (!isAdminMode) {
      setAdminSessionRemainingSeconds(0);
      return;
    }

    lastAdminActivityRef.current = Date.now();
    setAdminSessionRemainingSeconds(TECHNICIAN_SESSION_TIMEOUT_SECONDS);

    const handleUserActivity = () => {
      lastAdminActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const timer = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - lastAdminActivityRef.current) / 1000);
      const remaining = Math.max(0, TECHNICIAN_SESSION_TIMEOUT_SECONDS - elapsedSec);
      setAdminSessionRemainingSeconds(remaining);

      if (remaining <= 0) {
        setIsAdminMode(false);
        setAdminPin(null);
        setAdminSessionRemainingSeconds(0);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(timer);
    };
  }, [isAdminMode]);

  const setFontSize = useCallback((size) => {
    const validSizes = ['sm', 'md', 'lg', 'xl'];
    if (validSizes.includes(size)) {
      document.documentElement.setAttribute('data-font-size', size);
      try {
        localStorage.setItem('voltflow_font_size', size);
      } catch (e) {
        console.warn(e);
      }
      updateStoreConfig({ fontSize: size });
    }
  }, [updateStoreConfig]);

  const cycleFontSize = useCallback(() => {
    const validSizes = ['sm', 'md', 'lg', 'xl'];
    const currentIndex = validSizes.indexOf(currentFontSize);
    const nextIndex = (currentIndex + 1) % validSizes.length;
    setFontSize(validSizes[nextIndex]);
  }, [currentFontSize, setFontSize]);

  const value = {
    storeConfig,
    setStoreConfig,
    updateStoreConfig,
    isAdminMode,
    setIsAdminMode,
    adminSessionRemainingSeconds,
    adminPin,
    setAdminPin,
    enterAdminMode,
    exitAdminMode,
    resetAdminInactivity,
    toggleAdminMode,
    fontSize: currentFontSize,
    setFontSize,
    cycleFontSize
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
