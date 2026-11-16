# #0007 F-012: lock screen and AdminPinModal accepted default PIN 1234 when backend unreachable; LockScreenModal PUK form crashed (pukValue undeclared)

- 2026-11-16T19:46:35Z `issue`: F-012: lock screen and AdminPinModal accepted default PIN 1234 when backend unreachable; LockScreenModal PUK form crashed (pukValue undeclared) [src/components/LockScreenModal.jsx; src/components/AdminPinModal.jsx]
- 2026-11-16T19:46:37Z `fix`: No local or default PIN when verify-pin returns valid:null: lock screen waits and retries with backoff (not a failed attempt), AdminPinModal shows server-unavailable; declared pukValue state. Tests: lock_screen.test.jsx. [src/components/LockScreenModal.jsx]
