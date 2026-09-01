# Code Redemption Subsystem (`cogs/code_redeem.py` & `utils/redeem_code.py`)

## Architecture
- **Worker**: `utils.redeem_code.redeem_for_all` runs inside `asyncio.to_thread` to prevent blocking the Discord event loop during HTTP requests.
- **Dynamic Live UI**: Live progress embed with unicode progress bar, elapsed time, ETA calculation, and counters updated every ~4s.
- **Cancellation & Abort**:
  - `threading.Event` passed to `redeem_for_all`.
  - Sub-second interruptible sleeps between requests, retries, and burst pauses.
  - Interactive `🛑 Stop Redemption` button (`BatchProgressView`) on progress embed.
  - Modal confirmation (`ConfirmAbortModal`) requiring typing `ABORT` and optional reason.
  - `/redeem-stop` slash command for channel/admin abort.
- **Error Resilience**:
  - Catches `discord.Forbidden` (error 50001) if bot lacks channel write permissions.
  - Uses `interaction.followup.send(wait=True)` to leverage interaction webhook tokens.
  - Falls back to user DM on channel failure so batch redemption never crashes without processing player accounts.
  - Logs partial results to database even when stopped early.