import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook to provide auto-repeat and hold-to-clear behaviors for backspace buttons.
 * Compatible with mouse and touchscreen pointer events.
 *
 * @param {Object} options
 * @param {Function} options.onBackspace - Callback executed to delete one character
 * @param {Function} [options.onClear] - Callback executed to clear entire field when held past holdClearDelay
 * @param {number} [options.delay=350] - Initial delay before repeating begins (ms)
 * @param {number} [options.interval=70] - Interval between successive repeats (ms)
 * @param {number} [options.holdClearDelay=1100] - Continuous hold duration before clearing all (ms)
 * @param {boolean} [options.disabled=false] - When true, handlers are no-ops
 * @returns {Object} Pointer and click event handlers to spread onto button
 */
export function useHoldBackspace({
  onBackspace,
  onClear,
  delay = 350,
  interval = 70,
  holdClearDelay = 1100,
  disabled = false
}) {
  const delayTimerRef = useRef(null);
  const repeatIntervalRef = useRef(null);
  const clearAllTimerRef = useRef(null);
  const cleanupTimeoutRef = useRef(null);
  const pointerFiredRef = useRef(false);
  const isHoldingRef = useRef(false);

  const onBackspaceRef = useRef(onBackspace);
  const onClearRef = useRef(onClear);
  useEffect(() => {
    onBackspaceRef.current = onBackspace;
    onClearRef.current = onClear;
  }, [onBackspace, onClear]);

  const clearTimers = useCallback(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    if (clearAllTimerRef.current) {
      clearTimeout(clearAllTimerRef.current);
      clearAllTimerRef.current = null;
    }
    isHoldingRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [clearTimers]);

  const handlePointerDown = useCallback((e) => {
    if (disabled) return;
    if (e.button !== undefined && e.button !== 0) return;

    clearTimers();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Safe fallback if pointer capture fails
    }

    pointerFiredRef.current = true;
    isHoldingRef.current = true;

    if (onBackspaceRef.current) {
      onBackspaceRef.current();
    }

    if (onClearRef.current && holdClearDelay > 0) {
      clearAllTimerRef.current = setTimeout(() => {
        if (onClearRef.current) {
          onClearRef.current();
        }
        clearTimers();
      }, holdClearDelay);
    }

    delayTimerRef.current = setTimeout(() => {
      repeatIntervalRef.current = setInterval(() => {
        if (!isHoldingRef.current) {
          clearTimers();
          return;
        }
        if (onBackspaceRef.current) {
          onBackspaceRef.current();
        }
      }, interval);
    }, delay);
  }, [disabled, delay, interval, holdClearDelay, clearTimers]);

  const endPointerInteraction = useCallback((e) => {
    clearTimers();
    try {
      if (e?.currentTarget && e?.pointerId !== undefined) {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }
    } catch {
      // Safe fallback
    }
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
    }
    cleanupTimeoutRef.current = setTimeout(() => {
      pointerFiredRef.current = false;
    }, 60);
  }, [clearTimers]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (pointerFiredRef.current) {
      pointerFiredRef.current = false;
      return;
    }
    // Keyboard Enter / Space on button
    if (onBackspaceRef.current) {
      onBackspaceRef.current();
    }
  }, [disabled]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: endPointerInteraction,
    onPointerLeave: endPointerInteraction,
    onPointerCancel: endPointerInteraction,
    onClick: handleClick,
    onContextMenu: handleContextMenu,
  };
}

export default useHoldBackspace;
