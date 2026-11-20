import { useState, useRef, useEffect, useCallback } from 'react';

// Short "shake" flag for a rejected key press. flash() turns it on for 350 ms.
export function useRejectFlash() {
  const [rejected, setRejected] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const flash = useCallback(() => {
    setRejected(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRejected(false), 350);
  }, []);
  return [rejected, flash];
}
