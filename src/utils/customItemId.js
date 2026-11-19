let seq = 0;

// Id for a free-amount cart item. Date.now() alone repeats when two are added in the same
// millisecond, and the backend matches refunds by item_id.
export function newCustomItemId() {
  return `custom-${Date.now()}-${(seq++).toString(36)}`;
}
