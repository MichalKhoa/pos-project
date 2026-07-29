# Frontend Core

React 19 single-page register application located in `/src`.

## Structure
- [main.jsx](file:///home/misko/Documents/pos-eet-himmel/src/main.jsx): React root renderer.
- [App.jsx](file:///home/misko/Documents/pos-eet-himmel/src/App.jsx): Main state router, active tab switcher (`register`, `catalog`, `sales`, `settings`), cart state manager, global modal controllers.
- [index.css](file:///home/misko/Documents/pos-eet-himmel/src/index.css): Comprehensive CSS design tokens (colors, typography, grid, buttons, animations).
- [App.css](file:///home/misko/Documents/pos-eet-himmel/src/App.css): Layout grid and view-specific structural styles.

## API Client Layer (`/src/api/posApi.js`)
- Abstracted REST and WebSocket fetch functions connecting to `http://localhost:8000/api/v1`.
- Provides fallback local mode when backend API server is disconnected.

## Related Memories
- Component details: `mem:frontend/components`