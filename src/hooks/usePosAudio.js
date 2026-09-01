import { useState, useCallback } from 'react';
import { soundFx } from '../utils/audio';

export function usePosAudio() {
  const [soundEnabled, setSoundEnabledState] = useState(() => soundFx.isSoundEnabled());

  const toggleSound = useCallback(() => {
    const next = !soundFx.isSoundEnabled();
    soundFx.setSoundEnabled(next);
    setSoundEnabledState(next);
  }, []);

  const playScan = useCallback(() => soundFx.playScanChime(), []);
  const playSuccess = useCallback(() => soundFx.playSuccessChime(), []);
  const playError = useCallback(() => soundFx.playErrorChime(), []);
  const playCash = useCallback(() => soundFx.playCashChime(), []);

  return {
    soundEnabled,
    toggleSound,
    playScan,
    playSuccess,
    playError,
    playCash
  };
}

export default usePosAudio;
