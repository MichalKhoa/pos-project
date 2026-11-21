# #0012 Two cart lines of one product (after price override) share id; +, delete and inspector act on the first line

- 2026-11-19T23:42:56Z `issue`: Two cart lines of one product (after price override) share id; +, delete and inspector act on the first line [src/hooks/useCart.js]
- 2026-11-19T23:42:58Z `fix`: Each cart line gets lineId; findLineIndex tries lineId, then product id, then index. Tests in useCart.test.js and cart_inspector_qty.test.jsx; browser repro confirmed (commit 96a188d) [src/hooks/useCart.js]
