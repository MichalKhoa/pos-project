# #0014 Custom item ids custom-Date.now() repeat within one millisecond; backend matches refunds by item_id so refunds could count against the wrong line

- 2026-11-19T23:43:04Z `issue`: Custom item ids custom-Date.now() repeat within one millisecond; backend matches refunds by item_id so refunds could count against the wrong line [src/components/ManualKeypad.jsx]
- 2026-11-19T23:43:06Z `fix`: newCustomItemId() (custom-<time>-<counter>) used in ManualKeypad, CustomItemModal, usePosKeyboardShortcuts. customItemId.test.js: 1000 unique ids; nothing parses the old format (commit 3cb0807) [src/utils/customItemId.js]
