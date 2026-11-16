# #0004 F-014: sales made while backend is down are never resent (0 POSTs after restart); sync hook only handles EET-pending sales

- 2026-11-16T19:13:12Z `issue`: F-014: sales made while backend is down are never resent (0 POSTs after restart); sync hook only handles EET-pending sales [src/hooks/useOfflineSync.js:72]
- 2026-11-16T19:30:17Z `fix`: createSaleBackend returns ok/REJECTED/null; sales carry syncState (PENDING, STRANDED, REJECTED, SYNCED); useUnsentSales resends on pos:backend-online and every 30 s; badge and UnsentSalesModal; restart recovery via markStranded. Live repro: stop backend, sell, restart: one POST, row in DB, badge gone. [src/hooks/useUnsentSales.js; src/utils/saleSync.js; src/App.jsx]
