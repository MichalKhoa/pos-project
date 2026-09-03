# Frontend Core Architecture & State Management

## Overview
- **Framework**: React 19, Vite, Vanilla CSS design tokens (no Tailwind).
- **Entry point**: `src/App.jsx` with code-split views (`RegisterView`, `InventoryView`, `PresetManagerView`, `HistoryView`, `AnalyticsView`, `SettingsView`).
- **Core Styles**: `src/styles/tokens.css`, `src/styles/layout.css`, `src/styles/register.css`.

## Theming & Navbar Architecture
- **Theme Mode**: `[data-theme='light|dark']` with root tokens.
- **Dynamic Accent Color**: `[data-accent='indigo|emerald|blue|amber|charcoal|rose|purple']` controlling `--accent-highlight`, `--accent-highlight-hover`, `--accent-highlight-text`, and `--shadow-highlight-glow`.
- **Navbar Layout**: 3-Island floating architecture matching modern Zenwood/Framer design:
  - **Left Island (`.nav-island-left`)**: Pulsing status indicator (`● Online • EET`) and pending sync badge.
  - **Center Island (`.nav-island-center`)**: Main hero capsule with embedded frameless 28px logo (`.nav-embedded-logo`), navigation tabs with silky Apple deceleration sliding pill indicator (`.nav-sliding-pill`) with zero bounce, bold primary text, and micro-scaling accent icons.
  - **Right Island (`.nav-island-right`)**: Unified hardware capsule containing borderless 32px circular tool buttons (`.nav-tool-btn`), compact language dropdown (`LanguageSelector`), hairline dividers, and localized live time/date chip (`.nav-clock-chip`) in `weekday DD/MM` format.
- **Navbar Style Variants**: `.navbar.style-floating` (default), `.navbar.style-standard`, `.navbar.style-slim`.
- **Category Chips**: Synchronized with elevated crisp card tile styling.
