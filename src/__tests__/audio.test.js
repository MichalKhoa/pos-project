import { describe, it, expect, beforeEach, vi } from 'vitest';
import { soundFx } from '../utils/audio';

describe('SoundEffectsManager', () => {
  beforeEach(() => {
    soundFx.setSoundEnabled(true);
  });

  it('enables and disables sound correctly', () => {
    expect(soundFx.isSoundEnabled()).toBe(true);
    soundFx.setSoundEnabled(false);
    expect(soundFx.isSoundEnabled()).toBe(false);
    soundFx.setSoundEnabled(true);
    expect(soundFx.isSoundEnabled()).toBe(true);
  });

  it('plays all tone types safely without throwing in headless environments', () => {
    expect(() => soundFx.playScanChime()).not.toThrow();
    expect(() => soundFx.playSuccessChime()).not.toThrow();
    expect(() => soundFx.playErrorChime()).not.toThrow();
    expect(() => soundFx.playCashChime()).not.toThrow();
    expect(() => soundFx.playDeleteTone()).not.toThrow();
    expect(() => soundFx.playKeypadClick()).not.toThrow();
  });

  it('early-returns when sound is disabled', () => {
    soundFx.setSoundEnabled(false);
    const getCtxSpy = vi.spyOn(soundFx, 'getAudioContext');
    
    soundFx.playScanChime();
    soundFx.playSuccessChime();
    soundFx.playErrorChime();
    soundFx.playCashChime();
    soundFx.playDeleteTone();
    soundFx.playKeypadClick();

    expect(getCtxSpy).not.toHaveBeenCalled();
    getCtxSpy.mockRestore();
  });

  it('constructs WebAudio oscillator graph when AudioContext is provided', () => {
    const mockOsc = {
      type: '',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };

    const mockCtx = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn(() => mockOsc),
      createGain: vi.fn(() => mockGain),
      destination: {}
    };

    vi.spyOn(soundFx, 'getAudioContext').mockReturnValue(mockCtx);

    soundFx.playScanChime();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
    expect(mockOsc.start).toHaveBeenCalled();

    soundFx.playDeleteTone();
    expect(mockOsc.frequency.setValueAtTime).toHaveBeenCalledWith(420, 10);

    soundFx.playKeypadClick();
    expect(mockOsc.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 10);

    vi.restoreAllMocks();
  });
});
