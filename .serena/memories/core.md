# Discord Game Utility Bot - Core Architecture

Modular Discord utility bot for Kingshot / Whiteout Survival game community, built with `discord.py`.

## Directory Structure
- [main.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/main.py): Bot initialization, cog loader, slash command sync.
- `cogs/`: Cog modules extending bot functionality.
  - [cogs/code_redeem.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/cogs/code_redeem.py): Gift code batch & single redemption, live progress bar, modal confirmation, abort support, watched channel scans.
  - [cogs/player_manager.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/cogs/player_manager.py): Player CRUD, CSV batch import/export, filtering, strike/warning flags.
  - [cogs/backup_sync.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/cogs/backup_sync.py): Automatic periodic database backups and Discord channel sync.
  - [cogs/rally_countdown.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/cogs/rally_countdown.py): Interactive voice channel countdowns for war rallies.
  - [cogs/battle_tactics.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/cogs/battle_tactics.py): Castle defense & reinforcement march calculation calculators.
  - [cogs/menu.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/cogs/menu.py): Interactive Discord UI main menu panels.
  - [cogs/wyr.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/cogs/wyr.py), [cogs/roast.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/cogs/roast.py): Community minigames.
- `databases/`: SQLite database managers.
  - [databases/player_database.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/databases/player_database.py): SQLite storage for player registry, alliance mapping, strikes, redeemed code logs.
  - [databases/wyr_database.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/databases/wyr_database.py): Would-You-Rather question bank.
- `utils/`: Core utilities and business logic.
  - [utils/redeem_code.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/utils/redeem_code.py): MD5 signature generation, proxy pool rotation, Century Games API client, rate-limit backoff, interruptible cancellation.
  - [utils/code_detector.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/utils/code_detector.py): Regex gift code parser and auto-detection alert in announcement channels.
  - [utils/views.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/utils/views.py), [utils/modals.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/utils/modals.py): Discord UI Views and Modals.
  - [utils/countdown.py](file:///c:/Users/micha/Documents/GitHub/discord-game-utility-bot/utils/countdown.py): Voice channel audio playback and timer handling.
- `data/`: Local storage (`players.db`, `wyr.db`, `proxies.txt`, backups).
- `tests/`: Automated unit tests covering all components (`test_all.py`, `test_backup_sync.py`).