import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRejectFlash } from './useRejectFlash.js';

describe('useRejectFlash', () => {
  afterEach(() => vi.useRealTimers());

  it('turns on, restarts on a second flash, and turns off after 350 ms', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRejectFlash());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(200));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current[0]).toBe(false);
  });

  it('clears its timer on unmount', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useRejectFlash());
    act(() => result.current[1]());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
