# Tech Stack & Dependencies

- **Language**: Python 3.12+ / 3.14
- **Core Libraries**:
  - `discord.py` 2.3+: Discord bot framework, slash commands (`app_commands`), UI buttons/modals/views.
  - `curl_cffi` (optional/fallback `requests`): TLS fingerprint impersonation for Century Games API.
  - `aiohttp`: Async HTTP webhook delivery and fallback operations.
  - `aiosqlite` / `sqlite3`: Local SQLite database engine with WAL mode and schema auto-migration.
  - `PyNaCl`: Discord voice channel support.
- **Testing**: `unittest` with `unittest.IsolatedAsyncioTestCase` and `unittest.mock`.
- **Indexing**: `codegraph` for AST indexing and blast-radius exploration.