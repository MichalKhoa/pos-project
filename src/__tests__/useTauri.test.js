import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTauri } from '../hooks/useTauri.js';

describe('useTauri Hook', () => {
  const originalTauri = window.__TAURI_INTERNALS__;
  let openSpy;

  beforeEach(() => {
    delete window.__TAURI_INTERNALS__;
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({
      focus: vi.fn()
    }));
  });

  afterEach(() => {
    if (originalTauri !== undefined) {
      window.__TAURI_INTERNALS__ = originalTauri;
    } else {
      delete window.__TAURI_INTERNALS__;
    }
    openSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('detects standard web environment when window.__TAURI_INTERNALS__ is undefined', () => {
    const { result } = renderHook(() => useTauri());
    expect(result.current.isTauri).toBe(false);
  });

  it('detects Tauri environment when window.__TAURI_INTERNALS__ is present', () => {
    window.__TAURI_INTERNALS__ = {};
    const { result } = renderHook(() => useTauri());
    expect(result.current.isTauri).toBe(true);
  });

  it('falls back to window.open for customer display in browser mode', async () => {
    const { result } = renderHook(() => useTauri());
    let res;
    await act(async () => {
      res = await result.current.openCustomerDisplay();
    });

    expect(openSpy).toHaveBeenCalledWith(
      '/#/customer-display',
      'CustomerDisplay',
      expect.stringContaining('width=1024')
    );
    expect(res).toEqual({ success: true, mode: 'browser' });
  });

  it('returns graceful error when restarting backend in browser mode', async () => {
    const { result } = renderHook(() => useTauri());
    let res;
    await act(async () => {
      res = await result.current.restartBackend();
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('native desktop shell');
  });
});
