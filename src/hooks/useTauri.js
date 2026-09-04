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

  const checkTauriUpdate = useCallback(async () => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) {
          return {
            available: true,
            version: update.version,
            currentVersion: update.currentVersion,
            body: update.body,
            date: update.date,
            updateRef: update
          };
        }
        return { available: false };
      } catch (err) {
        console.warn('Tauri update check failed:', err);
        return { available: false, error: err?.message || String(err) };
      }
    }
    return { available: false, error: 'Not in Tauri environment' };
  }, []);

  const installTauriUpdate = useCallback(async (updateRef, onProgress) => {
    if (!updateRef) return { success: false, error: 'No update reference provided' };
    try {
      let downloaded = 0;
      let total = 0;
      await updateRef.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength || 0;
          if (onProgress) onProgress({ status: 'started', total, downloaded: 0, percent: 0 });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
          if (onProgress) onProgress({ status: 'progress', total, downloaded, percent });
        } else if (event.event === 'Finished') {
          if (onProgress) onProgress({ status: 'finished', total, downloaded, percent: 100 });
        }
      });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
      return { success: true };
    } catch (err) {
      console.error('Tauri update install failed:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }, []);

  return {
    isTauri,
    openCustomerDisplay,
    restartBackend,
    toggleFullscreen,
    minimizeWindow,
    checkTauriUpdate,
    installTauriUpdate
  };
}
