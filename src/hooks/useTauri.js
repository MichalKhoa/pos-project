import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook providing an IPC bridge to native Tauri v2 desktop shell.
 * Transparently degrades to standard browser APIs when running in web mode.
 */
export function useTauri() {
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__));
  }, []);

  const openCustomerDisplay = useCallback(async () => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_customer_display');
        return { success: true, mode: 'tauri' };
      } catch (err) {
        console.warn('Tauri open_customer_display failed, falling back to browser window:', err);
      }
    }

    // Web browser fallback: open in popup window
    const popup = window.open('/#/customer-display', 'CustomerDisplay', 'width=1024,height=768,menubar=no,toolbar=no,location=no');
    if (popup) {
      popup.focus();
      return { success: true, mode: 'browser' };
    }
    return { success: false, error: 'Popup blocked' };
  }, []);

  const restartBackend = useCallback(async () => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const message = await invoke('restart_backend');
        return { success: true, message };
      } catch (err) {
        return { success: false, error: err?.message || String(err) };
      }
    }
    return { success: false, error: 'Not running in native desktop shell' };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        const current = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!current);
        return !current;
      } catch (err) {
        console.warn('Tauri fullscreen toggle failed:', err);
      }
    }

    // HTML5 Fullscreen API fallback
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
        return true;
      } else {
        await document.exitFullscreen().catch(() => {});
        return false;
      }
    }
    return false;
  }, []);

  const minimizeWindow = useCallback(async () => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
        return true;
      } catch (err) {
        console.warn('Tauri minimize failed:', err);
      }
    }
    return false;
  }, []);

  return {
    isTauri,
    openCustomerDisplay,
    restartBackend,
    toggleFullscreen,
    minimizeWindow
  };
}
