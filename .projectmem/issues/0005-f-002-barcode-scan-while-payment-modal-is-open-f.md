# #0005 F-002: barcode scan while payment modal is open fills cash amount; Enter completes sale (8.59 bn Kč tendered verified)

- 2026-11-16T19:13:14Z `issue`: F-002: barcode scan while payment modal is open fills cash amount; Enter completes sale (8.59 bn Kč tendered verified) [src/components/PaymentModal.jsx]
- 2026-11-16T20:01:56Z `fix`: F-002/F-005/F-022/F-008/F-004 fixed: scan bursts ignored in PaymentModal (scanBurst.js), Enter only finishes cash with explicit amount, 6-digit cap, modal locked during charge, manual card confirm step. Tests: payment_modal_safety.test.jsx (27), live replay in browser pane. [src/components/PaymentModal.jsx]
