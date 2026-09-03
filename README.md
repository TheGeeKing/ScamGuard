# ScamGuard

ScamGuard is a lightweight, self-hosted Discord bot that detects image-based scam floods using explainable behavior Signals and exact SHA-256 image fingerprints. It runs as one Bun/TypeScript process with SQLite; Python, Redis, workers, and hosted AI services are not required.

## Quick start

1. Follow [Discord setup](docs/discord-setup.md) to create and invite the bot.
2. Copy `.env.example` to `.env` and set `DISCORD_TOKEN` and `GUILD_ID`.
3. Start a development process with `bun install && bun run dev`, or a production-like container with `docker compose up --build -d`.
4. Open `http://127.0.0.1:3000/health`, then run `/scam status` in Discord.

The container runs as the non-root `bun` user with a read-only application filesystem. Only the `/data` SQLite volume is persistent and writable.

## Configuration

Only `DISCORD_TOKEN` and `GUILD_ID` are required. Guild overrides set through `/scam` take precedence over these environment defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_PATH` | `data/scamguard.db` | SQLite database path |
| `MODERATION_MODE` | `dry-run` | `dry-run`, `delete`, or `enforce` |
| `SUSPICIOUS_SCORE` | `50` | Suspicious threshold |
| `DELETE_SCORE` | `70` | Message deletion threshold |
| `TIMEOUT_SCORE` | `100` | Member timeout threshold |
| `TIMEOUT_MINUTES` | `10` | Timeout and local-block duration |
| `INCIDENT_RETENTION_DAYS` | `30` | Durable Incident retention |
| `MAX_IMAGE_BYTES` | `10485760` | Maximum bytes per image |
| `IMAGE_DOWNLOAD_TIMEOUT_MS` | `10000` | Image download deadline |
| `EXTERNAL_IMAGE_FETCH_ENABLED` | `true` | Guarded external embed fetching |
| `PERCEPTUAL_QUEUE_MAX_JOBS` | `32` | Maximum active and queued analyses |
| `PERCEPTUAL_QUEUE_MAX_BYTES` | `67108864` | Maximum encoded bytes held by analyses |
| `PERCEPTUAL_MAX_JOBS_PER_USER` | `4` | Outstanding analyses per guild/user |
| `PERCEPTUAL_QUEUE_QUANTUM` | `2` | Jobs served before rotating users |
| `PERCEPTUAL_ANALYSIS_TIMEOUT_MS` | `5000` | Worker deadline before replacement/retry |
| `HEALTH_HOST` / `HEALTH_PORT` | `127.0.0.1` / `3000` | Health listener |

See [ScamGuard scoring](docs/scoring.md) for every Signal bucket, its weight,
and how the configurable decision thresholds affect alerts and enforcement.

`/scam` provides `status`, `mode`, `thresholds`, `timeout`, `retention`, `log-channel`, `ignore-channel`, `trusted-role`, and `false-positive`. Successful setting changes are visible in-channel; status and errors are ephemeral. Moderators can also use **Mark as scam** and **Mark as safe** from a message context menu.

Incident notifications use a Components V2 layout with **False positive** and **Mark images safe** actions and tag the flagged user.

## Modes and restart behavior

- `dry-run` records intended actions without changing Discord or creating local block state.
- `delete` deletes qualifying messages but never times out members.
- `enforce` locally blocks an active sender, attempts one timeout, deletes the triggering message, then removes observed messages from the preceding five minutes.

Rolling behavior windows, local blocked state, action deduplication, and low-score Assessments are intentionally in memory and reset on restart. Guild settings, Incidents, reviews, and fingerprints remain in SQLite.

## Curated evidence

Raw, non-private, redistributable scam images may be committed directly under `evidence/`. They are peer-reviewed through normal pull requests and hashed at boot. See [the evidence workflow](evidence/README.md).

## Backups and upgrades

Stop writes before a filesystem copy, or create a consistent SQLite backup in Compose:

```sh
docker compose exec scamguard bun -e "const {Database}=require('bun:sqlite');new Database('/data/scamguard.db').run(\"VACUUM INTO '/data/scamguard.backup.db'\")"
docker compose cp scamguard:/data/scamguard.backup.db ./scamguard.backup.db
```

Before upgrading, take a backup. Then update the checkout and run `docker compose up --build -d`. Committed Drizzle migrations run automatically at startup. Do not downgrade a database unless the matching backup is restored.

ScamGuard handles SIGINT/SIGTERM by stopping Discord intake, draining bounded in-flight work for up to 10 seconds, and closing SQLite. Compose allows a 15-second grace period.

## Future features

- `/scam stats` for useful moderator-facing Incident statistics
- Multi-guild operation from one ScamGuard process
- A centrally reviewed fingerprint corpus shared by guilds on that process, without synchronization between separately operated ScamGuard instances

## Current exclusions

ScamGuard has no OCR, QR decoding, custom ML/AI classification, or central reputation service. External image failures remain non-scoring diagnostics. Runtime image bytes are never persisted locally.

See [Discord setup and the manual smoke test](docs/discord-setup.md) before enabling enforcement.
