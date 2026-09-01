# 02 — Connect and configure one Discord server

**What to build:** A Discord-connected ScamGuard installation that registers commands in one configured server, guides the owner through setup, and persists administrator overrides while retaining environment fallbacks.

**Blocked by:** 01 — Boot a healthy Bun service.

**Status:** completed

- [x] discord.js connects with only the documented gateway intents and bot permissions.
- [x] Commands register only in the required configured guild.
- [x] `/scam status` reports connection, moderation mode, database readiness, and missing moderation-log configuration.
- [x] Manage Guild gates mode, thresholds, timeout, retention, log-channel, ignored-channel, and trusted-role commands.
- [x] Environment values remain defaults until a guild override is stored through Drizzle.
- [x] First-run instructions are sent once to the system channel, then owner DM, with `/scam status` as fallback.
- [x] ScamGuard, DMs, ignored channels, trusted roles, and other bots are excluded as specified.
- [x] Automated adapter tests and the required quality gates pass without real credentials.
