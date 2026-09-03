/**
 * Safe localStorage wrapper for VoltFlow POS with backward-compatible migration
 * from legacy himmel_pos_* storage keys.
 */

export function getStorageItem(baseKey, defaultValue = null) {
  try {
    const val = localStorage.getItem(`voltflow_pos_${baseKey}`);
    if (val !== null) return val;
    
    // Fallback to legacy key and migrate forward
    const legacyVal = localStorage.getItem(`himmel_pos_${baseKey}`);
    if (legacyVal !== null) {
      localStorage.setItem(`voltflow_pos_${baseKey}`, legacyVal);
      return legacyVal;
    }
  } catch (e) {
    console.warn(`Error reading storage key ${baseKey}:`, e);
  }
  return defaultValue;
}

export function setStorageItem(baseKey, value) {
  try {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(`voltflow_pos_${baseKey}`, strVal);
  } catch (e) {
    console.warn(`Error writing storage key ${baseKey}:`, e);
  }
}

export function removeStorageItem(baseKey) {
  try {
    localStorage.removeItem(`voltflow_pos_${baseKey}`);
    localStorage.removeItem(`himmel_pos_${baseKey}`);
  } catch (e) {
    console.warn(`Error removing storage key ${baseKey}:`, e);
  }
}
