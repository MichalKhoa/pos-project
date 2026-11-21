# #0013 Inspector quantity field cannot be cleared or typed (controlled by item.quantity, clamps every keystroke); decimals impossible for weighed items

- 2026-11-19T23:43:00Z `issue`: Inspector quantity field cannot be cleared or typed (controlled by item.quantity, clamps every keystroke); decimals impossible for weighed items [src/components/cart/CartItemInspector.jsx]
- 2026-11-19T23:43:02Z `fix`: Local qtyText state; live update only while text is a valid quantity, clamp and restore on blur or Enter. Tests in cart_inspector_qty.test.jsx; browser check typed 12 after Backspace (commit 96a188d) [src/components/cart/CartItemInspector.jsx]
