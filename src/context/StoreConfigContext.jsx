/* eslint-disable react/only-export-components, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';
import { fetchStoreConfigBackend, saveStoreConfigBackend, saveSecuritySettingsBackend } from '../api/posApi';
import { getStorageItem, setStorageItem } from '../utils/storage';

export const FONT_SIZES = ['sm', 'md', 'lg', 'xl'];
const TECHNICIAN_SESSION_TIMEOUT_SECONDS = 10 * 60; // 10 minutes = 600s

const StoreConfigContext = createContext(null);

export function StoreConfigProvider({ children }) {
  const [storeConfig, setStoreConfig] = useState(() => {
    // The backend does not store fontSize, so the localStorage key is its only persisted copy.
    let savedFontSize;
    try {
      savedFontSize = localStorage.getItem('voltflow_font_size') || undefined;
    } catch {
      // ignore storage error
    }
    const fontSize = FONT_SIZES.includes(savedFontSize) ? { fontSize: savedFontSize } : {};
    try {
      const saved = getStorageItem('config');
      if (saved) return { ...DEFAULT_STORE_CONFIG, ...JSON.parse(saved), ...fontSize };
    } catch {
      // ignore parse error
    }
    return { ...DEFAULT_STORE_CONFIG, ...fontSize };
  });

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminSessionRemainingSeconds, setAdminSessionRemainingSeconds] = useState(0);
  const [adminPin, setAdminPin] = useState(null);
  const lastAdminActivityRef = useRef(Date.now());
  const adminPinRef = useRef(null);
  adminPinRef.current = adminPin;

  // Sync highlight accent to root element
  useEffect(() => {
    const accent = storeConfig?.highlightColor || (() => {
      try {
        return localStorage.getItem('voltflow_highlight_color') || 'charcoal';
      } catch {
        return 'charcoal';
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

  // Sync font size to root element ('lg' / 18px by default)
  const currentFontSize = storeConfig?.fontSize || (() => {
    try {
      return localStorage.getItem('voltflow_font_size') || 'lg';
    } catch {
      return 'lg';
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

  // Latest config for building the saved copy; the state update itself is functional so a quick
  // save cannot overwrite lock flags that changed a moment earlier.
  const storeConfigRef = useRef(storeConfig);
  storeConfigRef.current = storeConfig;

  const updateStoreConfig = useCallback(async (newConfig) => {
    setStoreConfig((prev) => ({ ...prev, ...newConfig }));
    const merged = { ...storeConfigRef.current, ...newConfig };
    try {
      setStorageItem('config', merged);
      await saveStoreConfigBackend(merged);
    } catch (e) {
      console.warn('Failed to save store configuration to backend:', e);
    }
  }, []);

  // Security settings (PINs, lock switches) go through their own endpoint call.
  // Returns the server result; on success the status flags in storeConfig follow it.
  const saveSecuritySettings = useCallback(async (updates) => {
    const result = await saveSecuritySettingsBackend(updates, adminPinRef.current);
    if (result?.status === 'ERROR') return result;
    const flags = {};
    if (updates.lockScreenEnabled !== undefined) flags.lockScreenEnabled = updates.lockScreenEnabled;
    if (updates.adminPinEnabled !== undefined) flags.adminPinEnabled = updates.adminPinEnabled;
    if (updates.cashierPin) {
      flags.hasPin = true;
      flags.cashierPinLength = updates.cashierPin.length;
    }
    if (updates.adminPin) {
      flags.hasAdminPin = true;
      flags.adminPinLength = updates.adminPin.length;
    }
    if (result?.recoveryCode) flags.hasRecoveryCode = true;
    setStoreConfig((prev) => ({ ...prev, ...flags }));
    return result;
  }, []);

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
    if (FONT_SIZES.includes(size)) {
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
    const nextIndex = (FONT_SIZES.indexOf(currentFontSize) + 1) % FONT_SIZES.length;
    setFontSize(FONT_SIZES[nextIndex]);
  }, [currentFontSize, setFontSize]);

  const value = {
    storeConfig,
    setStoreConfig,
    updateStoreConfig,
    saveSecuritySettings,
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
