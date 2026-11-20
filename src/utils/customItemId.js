let seq = 0;

// Id for a free-amount cart item. Date.now() alone repeats when two are added in the same
// millisecond, and the backend matches refunds by item_id.
export function newCustomItemId() {
  return `custom-${Date.now()}-${(seq++).toString(36)}`;
}

export const DEFAULT_ITEM_NAME = 'Volný prodej';
export const DEFAULT_RETURN_ITEM_NAME = 'Vratka / Vrácené zboží';

// Stored name of a return line. Plain text: the name is saved in the sale and printed on the
// thermal receipt, where an emoji comes out as "?". Names already marked (including old ones
// with the emoji, for example from parked carts) are left alone.
export function returnLineName(name) {
  const n = name || '';
  return /vratka|↩️/i.test(n) ? n : `Vratka: ${n}`;
}
