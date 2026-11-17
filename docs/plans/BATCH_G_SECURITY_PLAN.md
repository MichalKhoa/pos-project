# Batch G plan: PIN locks that can be switched on and off, and no built-in default or master keys

Status: Phase 1 done and committed (section 9). Phase 2 done and committed (section 10). Phase 3 done, not committed (section 11). Phases 1 and 2 must land together: Phase 1 alone leaves Admin mode unreachable after the migration.
Branch: `fix/batch-g-security`, cut from `origin/master` (PRs 11, 12 and 13 are merged).

## 1. Goal

The owner decides whether the shop uses PIN protection at all. There are two switches in Settings: **Lock screen** and **Admin PIN**. When a switch is off, nothing asks for that PIN. When it is on, the PIN is a real secret chosen by the owner. No PIN, PUK or master key is built into the program or can be derived from data printed on a receipt.

## 2. What exists today (checked in code)

- Two PINs: cashier PIN (lock screen, `verify-pin`) and admin PIN (Admin mode, `verify-admin-pin`). Both default to `1234` in `backend/models.py:102-103` and `backend/migrations.py:20-21`.
- Lock screen: `useAutoLock` locks after `autoLockMinutes` (default 15) and the navbar has a lock button. It is always on; the only way to stop it is to set the minutes to 0.
- Admin mode: client state in `StoreConfigContext` (10 minute session). The PIN modal (`AdminPinModal`) first tries `verify-admin-pin`, then falls back to `verify-pin`, so **the cashier PIN opens Admin mode**.
- The "Change Admin PIN" button in `SettingsView.handleOpenPinChange` saves the result into `cashierPin`, not `adminPin`. The Admin PIN is never actually changed from the UI.
- `SecuritySection` shows the cashier PIN in a password field with the fallback value `'1234'` and saves it on blur with no confirmation.
- `verify-puk` (`config.py:381`) accepts `VOLTFLOW-<IČO>-MASTER` (the IČO is printed on every receipt), the fixed `VOLTFLOW-RECOVERY-99` and the legacy `HIMMEL-*` variants, with no rate limit. It resets the cashier PIN to `1234`.
- A master key with a default value in the source (`POS_MASTER_ADMIN_KEY`, default `VOLTFLOW-ADMIN-MASTER-RECOVERY`) is accepted by `verify_admin_pin` and by `verify_technician_auth` (`system.py:63`).
- `verify_technician_auth` already guards the technician endpoints on the server (diagnostics, database download and restore, cloud backup, log viewer). It accepts the admin PIN **or the cashier PIN**, falls back to `1234` when no PIN rows exist, and has no rate limit. It also checks loopback and origin.
- `POST /config` accepts `cashierPin` and `adminPin` from any caller without the current PIN. Sale delete, purge and reset are localhost-only. Nothing else on the API is authenticated (audit item C1).
- F-012 (lock screen default-PIN fallback when the backend is offline) was fixed in Batch A.

## 3. Decisions (answered by the owner)

1. **Two separate switches**: lock screen on/off, Admin PIN on/off.
2. **Off until the owner turns it on.** To switch either one off or on, the Admin PIN is asked for (when the Admin PIN switch is on). New installs start with both off and a hint in Settings recommends turning them on. No `1234` exists.
3. **Recovery**: a random recovery code shown once, plus an optional master key that works only if the machine's environment sets `POS_MASTER_ADMIN_KEY` (no default value).
4. **Enforcement depth: UI only.** I will not add admin tokens to the API and I will not retrofit "current PIN required" on `POST /config`. Audit item C1 stays open and is written down as such.

Consequences of decision 4 that I handle by default (tell me if you disagree):
- Two new server calls are unavoidable and small: issuing a recovery code and redeeming one. A recovery code must not be issuable by anyone, otherwise any caller could mint a code and use it to wipe the PINs. So issuing needs the current Admin PIN, or happens only at first PIN setup when no code exists yet. Redeeming is rate limited.
- The technician endpoints already check a PIN on the server. With the Admin PIN switch **off** there is no PIN to send, so the server skips the PIN check on them (the loopback and origin checks stay). With the switch **on** they keep requiring the Admin PIN. The cashier PIN stops being accepted there.

## 4. Design

### 4.1 Stored settings (backend)

- New nullable columns on `store_config`: `lock_screen_enabled`, `admin_pin_enabled` (booleans) and `recovery_code_hash` (string). Add them in `migrations.py` and `models.py`.
- PIN columns lose the `'1234'` default. A stored value equal to `1234` (plaintext or its hash) is treated as "no PIN set".
- Existing installs (null switches): `lock_screen_enabled` is true only if the cashier PIN is set to something other than `1234`; `admin_pin_enabled` likewise for the admin PIN. A shop still on the default `1234` therefore ends up with locks off. That is a visible change; it is honest because `1234` protected nothing.
- Because the old button wrote the "admin" PIN into `cashierPin`: if the admin PIN is unset but the cashier PIN is set, the migration copies the cashier hash into `admin_pin`, so the owner's one known PIN keeps working for both. This is reported in the release notes.
- `GET /config` returns `lockScreenEnabled`, `adminPinEnabled`, `hasPin`, `hasAdminPin`, `hasRecoveryCode`. It never returns a PIN or hash.
- `POST /config` accepts `lockScreenEnabled` and `adminPinEnabled`. A switch cannot be set to true while its PIN is unset (400).

### 4.2 Verification

- `verify-pin` (lock screen): returns `valid: false` when no PIN is set; accepts the cashier PIN or the admin PIN (so a forgotten cashier PIN does not need the recovery code).
- `verify-admin-pin`: admin PIN only. The cashier PIN fallback is removed here, in `AdminPinModal` and in `verify_technician_auth`.
- Master key: only when `POS_MASTER_ADMIN_KEY` is set and at least 16 characters. Compared with `hmac.compare_digest`. No default.
- `verify_technician_auth` gets the same rate limiter as the verify endpoints.

### 4.3 Recovery code

- Format `XXXX-XXXX-XXXX-XXXX` from a random base32 alphabet (80 bits), generated on the server with `secrets`. Stored only as a hash.
- Issued in the response when a PIN is first set and no code exists, and by `POST /config/recovery-code` with the current Admin PIN. The UI shows it once, with a copy button and a required "I saved it" tick before closing.
- `POST /config/verify-recovery` replaces `verify-puk`. On a correct code it clears both PINs, switches both locks off and clears the code. The owner then sets new PINs and gets a new code. Rate limited (5 per minute) like the PIN endpoints.
- Removed: IČO-based and fixed PUKs, the `HIMMEL-*` variants and the built-in master key default.

### 4.4 Frontend behaviour

- `useAutoLock` and the navbar lock button obey `lockScreenEnabled`. Off means no auto-lock and no lock button.
- Admin mode with the switch off: one tap enters Admin mode without a PIN (the dangerous actions stay behind a deliberate step and the 10 minute session still ends). With the switch on: Admin PIN as today.
- `SecuritySection`: two cards with a switch each. Switching on with no PIN set opens a set-PIN flow (new, confirm, recovery code). Switching off asks for the Admin PIN. The cashier PIN password field and its `'1234'` fallback are removed; the cashier PIN is set and changed with the same dialog as the admin one. "Change Admin PIN" writes `adminPin`.
- `AdminPinModal` and the lock screen texts move to `t()` keys in cs, vi and en (they contain hard-coded Czech today). The translation guard test covers the new keys.

## 5. Phases

**Phase 1: backend, tests first.** New `backend/tests/test_security_locks.py`: defaults are null; migration derivation rules (default `1234` stays off, custom PIN stays on, cashier-to-admin copy); switch cannot be enabled without a PIN; `verify-pin` rejects when unset and accepts admin PIN; `verify-admin-pin` rejects the cashier PIN; master key works only from the environment and only at 16+ characters; recovery code issue-once, redeem, rate limit; technician endpoint skips the PIN only when the switch is off and rejects the cashier PIN when on. Then implement. Gates: backend suite, `/code-review` at `high` (auth path).

**Phase 2: frontend toggles and gating.** Tests: lock never triggers when off, triggers when on; navbar lock button hidden when off; Admin mode enters without PIN when off; switching off asks for the Admin PIN; switching on without a PIN opens the set-PIN flow; the cashier PIN does not open Admin mode. Then implement `useAutoLock`, `StoreConfigContext`, `SecuritySection`, `SettingsView`, `AdminPinModal`, Navbar. Gates: vitest, lint, build.

**Phase 3: recovery code UI and texts.** Show-once dialog, lock screen "forgot PIN" entry using the code, removal of the PUK text, three languages. Gates: full test suites, translation guard.

**Phase 4: live check and docs.** Throwaway data folder (`POS_DATA_DIR`), browser pane: fresh install has both off; turn the Admin PIN on and set a PIN; recovery code appears once; lock screen on and unlocks with both PINs; recovery wipes the PINs; an upgraded copy of an old database behaves as in 4.1. Update `docs/guides/SECURITY_AUDIT.md` (H2 note, C1 still open), `docs/audit/FINDINGS.md`, `docs/audit/FIX_RECOMMENDATIONS.md`, CLAUDE.md test counts. Final `/code-review` at `high`.

## 6. Risks

- Upgrade behaviour: shops still on `1234` lose a lock that gave no protection. Shops that have set a PIN keep their locks.
- Losing the PIN and the recovery code and having no master key leaves one fix: clear the PIN columns in the database file. This gets one paragraph in the guide.
- With the Admin PIN switch off, anyone at the counter can open Admin mode and, on the same machine, the technician tools (database restore). This is the owner's explicit choice and is stated in the switch description.
- Hashing stays unsalted SHA-256 (a 4 digit PIN is guessable offline if the database file leaks). Not changed here.
- Dev mode binds the backend to `0.0.0.0` (`main.py:321`); only the packaged build binds to 127.0.0.1. Not changed here.

## 7. Out of scope

Admin tokens or a login system for the API (audit C1), salted or slow PIN hashing, per-cashier accounts and roles, an audit log of who unlocked or deleted, hardware tests.

## 8. Effort and model

Phase 1 and the Phase 4 final review touch authentication, so those two are worth Opus 5.5 on high. Phases 2 and 3 are UI work and fit Sonnet 5.5 at medium. Given the limited usage left, run Phase 1 and the final review in a fresh usage window.

## 9. Phase 1 result

Backend done, tests first. New `backend/services/pin_auth.py` holds every PIN, master-key and recovery-code check. `config.py`, `system.py` (technician endpoints), `sales.py` (sale delete and purge) and `settings_gui.py` now use it, so the three copies of "admin or cashier PIN, else 1234, plus built-in master key" are gone.

- Model: PIN columns have no default. New columns `lock_screen_enabled`, `admin_pin_enabled`, `recovery_code_hash` and `pin_policy_version`.
- `migrations.migrate_pin_settings` runs at startup on rows with `pin_policy_version` 0 or NULL, as section 4.1 describes. `pin_policy_version` gets its value from a callable default on purpose: when an old database gains the column through ALTER TABLE, the column starts as 0 or NULL, which marks those rows for migration.
- Config API: `GET` returns `lockScreenEnabled`, `adminPinEnabled`, `hasPin`, `hasAdminPin`, `hasRecoveryCode`. `POST` refuses `1234` as a new PIN and refuses a switch without its PIN. The first PIN set returns `recoveryCode`.
- `POST /config/recovery-code` (needs the Admin PIN, or the cashier PIN when no Admin PIN is set) and `POST /config/verify-recovery` replace `verify-puk`.
- All PIN checks share the existing 5-per-minute rate limiter, now also on technician and sale-delete endpoints.
- Frontend stopgaps so a Phase-1 build cannot lock anyone out: auto-lock and the lock button only work when `lockScreenEnabled` is true, `verifyPukBackend` calls `verify-recovery`, and a successful recovery unlocks.
- Tests: `backend/tests/test_security_locks.py` (25 tests). Old tests that relied on `1234` or the built-in master key now use `tests/pin_fixture.py`. Gates: 237 backend tests pass, 402 frontend tests pass, lint clean.
- Side effect: the backend test run migrated `backend/data/pos_store.db` (the dev database those tests already use); its PINs were the default, so both PINs are now empty and both switches are off.

The `/code-review` at `high` found ten items. One cleanup was fixed: `pin_fixture` now uses `enterContext`. The rest belong to later phases:
- Phase 2: Admin mode must open without a PIN when the switch is off (otherwise it is unreachable after the migration). `AdminPinModal` must drop the cashier-PIN fallback. The `SecuritySection` cashier PIN field and its `'1234'` fallback must go, because the server now rejects `1234` and that fails the whole config save. The generic config save must stop sending PINs and the switch flags, because today it re-posts the whole `storeConfig` and could restore a wiped PIN. The lock button must be hidden when the lock screen is off.
- Phase 3: show the recovery code returned by `POST /config`, because today the first code is lost. Fix the recovery success text, which still says "reset to 1234". Decide where a support master key can be typed in, because the keypads take only digits and at most 8 of them.
- Open, not planned: the standalone `settings_gui.py` still sets only the cashier PIN, does not touch the switches or the recovery code, and still returns the cashier PIN hash in `get_settings`.

## 10. Phase 2 result

Frontend toggles and gating, tests first (`src/__tests__/security_toggles.test.jsx`, 11 tests).

- The Security tab has two switches. Turning one on without a stored PIN opens the set-PIN dialog and saves PIN and switch together; with a PIN already stored it only flips the switch. The old cashier PIN input and its `'1234'` fallback are gone, and its text keys were removed from all three languages. Each switch needs no extra PIN prompt: the Security tab is already behind Admin mode.
- `AdminPinModal` accepts only the Admin PIN (or a support master key) and has a `SET_PIN` mode and a `kind` (admin or cashier) for its titles. It refuses `1234` as a new PIN.
- `SettingsView.requireAdminPin` opens Admin mode without a PIN when the Admin PIN switch is off, and the locked tabs and the unlock button now share it. After the Admin PIN is set or changed, the open Admin session takes the new PIN.
- `saveStoreConfigBackend` removes PINs, switches and status flags from every whole-config save. PINs and switches travel only through `saveSecuritySettingsBackend`, exposed as `saveSecuritySettings` in `StoreConfigContext`, which also updates the status flags. `App.handleSaveStoreConfig` keeps the live flags instead of the settings form's older copy.
- The navbar lock button shows only when the lock screen is on. The auto-lock select is disabled when it is off.

Gates: 412 frontend tests, lint clean, build ok. Review at high found two issues, both fixed (failed save kept a success message; the Admin session kept a stale PIN).

Open for Phase 3: the PIN dialogs and the lock screen submit automatically after 4 digits, so a 5 to 8 digit PIN is checked too early and counts toward the rate limit. This predates Batch G because the server never returns the PIN length. Fix with an explicit confirm button or by storing the length. The first recovery code from `POST /config` is still not shown anywhere (Phase 3).

## 11. Phase 3 result

Recovery code UI and texts, tests first (`lock_screen.test.jsx`, `security_toggles.test.jsx`).

- New `RecoveryCodeModal` shows a code once. It opens when a save returns `recoveryCode` (the first PIN) and after "Issue a new recovery code" in the Security tab. The new-code button needs the Admin PIN and calls `POST /config/recovery-code`; it appears only when an Admin PIN is set.
- The lock screen form is now a recovery code form: no PUK or IČO text, placeholder `XXXX-XXXX-XXXX-XXXX`, success text without "1234". All of its text and the new Settings text exist in Czech, Vietnamese and English. `verifyPukBackend` is renamed `verifyRecoveryCodeBackend`.
- A successful recovery calls `onRecovered`, and `App` switches both locks and all status flags off in its state, so the lock screen does not come back with no PIN to open it.
- New PINs set in the UI must have exactly 4 digits, because the dialogs and the lock screen submit after 4 digits (the server never returns the PIN length). The server still accepts 4 to 8, so a 5 to 8 digit PIN set earlier still fails on the early submit; changing this needs the PIN length stored or an explicit confirm button.
- Decision: the support master key is not typed on any keypad. It works for the technician and sale endpoints as a header value and in the standalone settings app, which is what support needs.
- Open: a shop with only a cashier PIN cannot issue a new recovery code from the UI (the button needs an Admin PIN).

Gates: 418 frontend tests, 25 security backend tests, lint clean, build ok.
