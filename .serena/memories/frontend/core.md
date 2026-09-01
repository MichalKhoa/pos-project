# Frontend Core

React 19 single-page register application located in `/src`.

## Structure
- [main.jsx](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/main.jsx): React root renderer wrapped in `ErrorBoundary`, `LanguageProvider`, and `StoreConfigProvider`.
- [App.jsx](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/App.jsx): Main register container with lazy-loaded views via `React.lazy()` + `<Suspense>`, active tab switcher (`register`, `presets`, `inventory`, `history`, `settings`), and global modal controllers.
- [index.css](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/index.css): Master stylesheet importing modular domain sheets from `src/styles/` (`tokens.css`, `layout.css`, `register.css`, `modals.css`, `history.css`, `settings.css`).

## Contexts & State Providers (`/src/context`)
- `StoreConfigContext.jsx`: Centralizes store configuration, live SQLite DB synchronization, `localStorage` caching, and cashier/manager `isAdminMode` gates without prop drilling (`useStoreConfig()`).

## Custom Hooks (`/src/hooks`)
- `useCart.js`: Cart state management, line additions, item discounts, cart-level discounts, 4s undo toasts, 8s clear cart recovery snapshots, parked carts.
- `useRegisterKeypad.js`: Numeric keypad buffer, decimal entry, multiplier state (+1x / -1x return mode), hotkey listeners (`0-9`, `-`, `ArrowUp/Down`, `*`, `Enter`, `Escape`).
- `usePosAudio.js`: Web Audio API synthesized sounds (scan chime, sale completed chime, mute state).

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