# Frontend Core

React 19 single-page register application located in `/src`.

## Structure
- [main.jsx](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/main.jsx): React root renderer.
- [App.jsx](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/App.jsx): Main register container with lazy-loaded views via `React.lazy()` + `<Suspense>`, active tab switcher (`register`, `presets`, `inventory`, `history`, `settings`), and global modal controllers.
- [index.css](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/index.css): Comprehensive CSS design tokens (colors, typography, grid, buttons, animations) + touch UI rules (`user-select: none`, `-webkit-touch-callout: none`, `touch-action: manipulation`, `40px–44px` touch targets).
- [App.css](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/App.css): Layout grid and view-specific structural styles.

## Custom Hooks (`/src/hooks`)
- `useCart.js`: Cart state management, line additions, item discounts, cart-level discounts, 4s undo toasts, 8s clear cart recovery snapshots, parked carts.
- `useRegisterKeypad.js`: Numeric keypad buffer, decimal entry, multiplier state (+1x / -1x return mode), hotkey listeners (`0-9`, `-`, `ArrowUp/Down`, `*`, `Enter`, `Escape`).
- `usePosAudio.js`: Web Audio API synthesized sounds (scan chime, sale completed chime, mute state).
- `usePosConfig.js`: Store configuration synchronizer.

## Utilities (`/src/utils`)
- `tax.js`: Centralized financial calculation engine (`roundCZK`, `calculateItemLineGross`, `calculateCartTotals`, `calculateCashChange`).
- `audio.js`: Synthesized Web Audio manager (`SoundEffectsManager`).
- `csvExporter.js`: Sales ledger CSV export formatting.
- `presetIcons.js`: Dynamic Lucide icon mappings for product categories and tiles.

## API Client Layer (`/src/api/posApi.js`)
- Abstracted REST and WebSocket fetch functions connecting to `http://localhost:8000/api/v1`.
- Provides fallback local mode when backend API server is disconnected.

## Related Memories
- Component details: `mem:frontend/components`
- Tech stack & testing: `mem:tech_stack`