// Tells a barcode scanner from a person at the keyboard: a scanner "types" every
// character within a few milliseconds and ends with Enter.
// Same thresholds as usePosKeyboardShortcuts (70 ms between keys, Enter within 100 ms).
export const BURST_KEY_GAP_MS = 70;
export const BURST_ENTER_GAP_MS = 100;
export const BURST_MIN_LENGTH = 3;

export function createBurstTracker(now = () => Date.now()) {
  let last = 0;
  let count = 0;

  return {
    // Call for every printable key. Returns true when the key continues a burst.
    onChar() {
      const t = now();
      const continues = count >= 1 && t - last <= BURST_KEY_GAP_MS;
      count = continues ? count + 1 : 1;
      last = t;
      return continues;
    },
    // Call for Enter. Returns true when it ends a scanner burst.
    onEnter() {
      const t = now();
      const isScan = count >= BURST_MIN_LENGTH && t - last <= BURST_ENTER_GAP_MS;
      count = 0;
      last = t;
      return isScan;
    }
  };
}
