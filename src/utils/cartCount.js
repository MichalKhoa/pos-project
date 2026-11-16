// "N položek" in the cart: pieces count by quantity, a weighed line counts as one item
// (350 kg typed by mistake must not read "350 položek").
export function countCartItems(cartItems) {
  return (cartItems || []).reduce((sum, i) => {
    const q = Number(i.quantity) || 0;
    const weighed = i.unit === 'kg' || i.unit === 'g' || i.isWeighted || i.is_weighted || !Number.isInteger(q);
    return sum + (weighed ? Math.sign(q) : q);
  }, 0);
}
