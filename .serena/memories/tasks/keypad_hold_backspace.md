# Task: Keypad Backspace Auto-Repeat & Long-Hold Clear

## Status: Completed

### Summary of Implementation:
- Created [`useHoldBackspace.js`](src/hooks/useHoldBackspace.js):
  - Pointer events (`onPointerDown`, `onPointerUp`, `onPointerLeave`, `onPointerCancel`, `onContextMenu`) with pointer capture.
  - Initial delay: 350ms before auto-repeat kicks in.
  - Repeat interval: 70ms per character tick.
  - Long-hold clear delay: 1100ms triggers `onClear` and stops timer.
  - Keyboard activation compatibility (`onClick` handles Space/Enter without double-firing for pointer clicks).
- Wired into:
  - [`KeypadNumberGrid.jsx`](src/components/keypad/KeypadNumberGrid.jsx): Register keypad backspace button (`⌫`).
  - [`ManualKeypad.jsx`](src/components/ManualKeypad.jsx): Inline backspace button beside amount display.
  - [`StockKeypadModal.jsx`](src/components/inventory/StockKeypadModal.jsx): Stock adjustment modal backspace button.
  - [`OpenPriceModal.jsx`](src/components/presets/OpenPriceModal.jsx): Open price modal inline and grid backspace buttons.
- Tests: [`useHoldBackspace.test.jsx`](src/__tests__/useHoldBackspace.test.jsx) with 5 test cases covering tap, repeat, clear all, keyboard click, and disabled state.
