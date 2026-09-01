# 01 — Boot a healthy Bun service

**What to build:** A typed ScamGuard process that validates required configuration, connects through Drizzle to Bun SQLite, applies committed migrations, exposes component health, and runs through both Bun and Compose.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Missing `DISCORD_TOKEN` or `GUILD_ID` fails startup with a clear, secret-free error.
- [x] Environment defaults are validated for thresholds, timeout, retention, image limits, external fetching, health bind, and moderation mode.
- [x] Drizzle uses the native `bun:sqlite` driver and committed generated migrations.
- [x] `/health` reports process and SQLite state without identifiers, secrets, or configuration values.
- [x] Local Bun and Compose workflows start the same application with persistent SQLite data.
- [x] `bun test`, TypeScript checking, Biome, and a health smoke check pass.
