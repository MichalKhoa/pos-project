import { useEffect } from 'react';

// A modal that takes the keyboard (own keys, or none) registers here so the global register
// shortcuts (pad digits, Enter-adds-item, barcode scan) do not also fire behind it.
let owners = 0;

export const acquireKeyboard = () => { owners += 1; };
export const releaseKeyboard = () => { owners = Math.max(0, owners - 1); };
export const isKeyboardOwned = () => owners > 0;

export function useOwnKeyboard(isOpen) {
  useEffect(() => {
    if (!isOpen) return undefined;
    acquireKeyboard();
    return releaseKeyboard;
  }, [isOpen]);
}
