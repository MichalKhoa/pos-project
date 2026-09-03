import { useState, useEffect, useRef, useCallback } from 'react';

export function useAutoLock(autoLockMinutes = 15) {
  const [isAppLocked, setIsAppLocked] = useState(false);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity));

    const checkInterval = setInterval(() => {
      const minutesLimit = autoLockMinutes !== undefined ? autoLockMinutes : 15;
      if (minutesLimit > 0 && !isAppLocked) {
        const elapsedMs = Date.now() - lastActivityRef.current;
        if (elapsedMs >= minutesLimit * 60 * 1000) {
          setIsAppLocked(true);
        }
      }
    }, 10000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(checkInterval);
    };
  }, [autoLockMinutes, isAppLocked]);

  const unlockApp = useCallback(() => {
    setIsAppLocked(false);
    lastActivityRef.current = Date.now();
  }, []);

  return {
    isAppLocked,
    setIsAppLocked,
    unlockApp
  };
}
