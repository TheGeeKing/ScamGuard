# ScamGuard progress

## Current phase

Tickets 01–02 complete; ticket 03 is the blocker frontier.

## Confirmed constraints

- Use Bun and TypeScript instead of Python.
- Use `discord.js` for the Discord client.
- Use Drizzle ORM with Bun SQLite and committed Drizzle migrations.
- Do not implement Python components.
- Do not implement OCR, AI, perceptual hashing, QR analysis, or decoded-image analysis in the first release.
- Retain exact SHA-256 image fingerprinting in the first release.
- Preserve a deterministic, explainable fast path that works without optional services.
- Use one Bun process, Bun SQLite for durable data, and in-memory rolling state initially.
- Do not require Valkey or a worker in the first release.
- Default to `MODERATION_MODE=dry-run`, with `delete` and `enforce` modes available.
- Support both `bun run dev` and a production-like local Compose workflow.
- Validate Discord integration with mocked tests and a documented manual smoke test.
- Preserve the feature intent in `plan.md` while minimally translating Python-specific choices to Bun.
- Target one configured Discord server initially while retaining guild IDs in domain records.
- Let authorized moderators register every image attachment in a selected message as a Known scam fingerprint.
- Provide moderator correction paths for safe fingerprints and false-positive Incidents.
- Clean up a timed-out member's recent messages within a five-minute window.
- Manage operational configuration through admin slash commands backed by SQLite.
- Expose a small framework-free `/health` endpoint for Compose health checks.
- Treat `imagehash-web` as a candidate pending a Bun/Linux compatibility spike and fixture benchmark.
- Delete every tracked message from an enforced member during the preceding five-minute Cleanup window.
- Create one Assessment per Discord message and include evidence from every eligible attachment.
- Provide admin commands for status, moderation mode, thresholds, timeout duration, log channel, ignored channels, trusted roles, and false-positive review.
- Require `Manage Guild` for configuration and review commands; never require Administrator.
- Analyze every eligible attachment without a per-message count limit, using bounded processing to control resource use.
- Default to 10 MiB per attachment and a 10-second download timeout.
- Recognize PNG, JPEG, GIF, and WebP by file signature.
- Hash an entire GIF file without decoding frames.
- Ignore ScamGuard and other bots by default; analyze webhooks with deletion-only enforcement.
- Do not record an ADR for the Bun baseline; the earlier Python choice was provisional and no code depends on it.
- Use mutually exclusive scoring buckets within a Signal group so only its strongest satisfied condition contributes.
- Persist Incidents scoring at least 50, notify moderators, and discard lower-scoring Assessments after five minutes.
- In dry-run mode, record intended actions without creating local blocked state or applying Discord actions.
- **Mark as scam** stores every eligible attachment hash and applies mode-appropriate moderation to the selected message and sender.
- **Mark as safe** removes selected-image hashes and marks linked Incidents false-positive without automatically reversing timeouts.
- Permit in-memory burst, cleanup, and blocked-user state to reset on process restart in v1.
- Retain Incidents for 30 days by default and expose `/scam retention <days>`.
- Plan community reporting as a later, explicit opt-in feature rather than part of the first release.
- A Community report may contain flagged image bytes, hashes, Signals, timestamp, pseudonymous installation ID, and flagged Discord user ID.
- Treat cross-server user reputation as a weak, expiring Signal that can never enforce by itself.
- Promote Community reports into a signed Global fingerprint feed only after manual review; consuming installations opt in and retain local disable/override controls.
- Register all eligible images from a moderator-marked scam message, including low-variation or apparently harmless campaign panels.
- Keep moderator-added fingerprints scoped to the configured server initially.
- Enforce in this order: local block, timeout attempt, triggering-message deletion, Cleanup-window deletion, outcome persistence, moderator notification.
- Serialize enforcement per user so concurrent messages produce one timeout attempt.
- Continue deletion and cleanup when a timeout fails, recording each action outcome separately.
- Continue processing remaining attachments when one fails; processing diagnostics are explainable but non-scoring.
- Let local safe overrides take precedence over the future Global fingerprint feed.
- Gate implementation commits with `bun test`, TypeScript type-checking, Biome formatting/linting, and the smallest relevant smoke check.
- Deduplicate message processing by `(guild_id, message_id)` and keep Signals and moderation actions idempotent.
- Register application commands only in the configured `GUILD_ID` for v1.
- Require only `DISCORD_TOKEN` and `GUILD_ID` at startup.
- Read operational defaults from environment variables; persist a guild value only when an administrator overrides that default.
- Remain healthy without a moderation-log channel while surfacing the missing setup in local logs and `/scam status`.
- Bind the minimal `/health` endpoint to configurable `HEALTH_HOST`/`HEALTH_PORT`, defaulting to `0.0.0.0:3000` in the container.
- Analyze attachment and rendered-embed Image sources, preferring approved Discord CDN/proxy URLs and using a guarded external-origin fallback when no proxy exists.
- Send first-run setup instructions once: server system channel first, server-owner DM second, then rely on `/scam status`.
- Persist no raw images in the local v1 bot.
- For future opted-in Community reports, use encrypted central review storage; expire unreviewed images after 30 days, delete rejected images, and distribute signed hashes rather than raw images.
- Treat Discord embed `image` and `thumbnail` fields as Image sources; ignore decorative author/footer icons and non-image embed media.
- Enable guarded external Image source fetching by default with `EXTERNAL_IMAGE_FETCH_ENABLED` as an operator override.
- Permit external HTTP on port 80 and HTTPS on port 443 only, with no URL credentials or custom ports.
- Resolve and pin public destination IPs, reject local/private/reserved destinations, revalidate at most two redirects, and send no ambient credentials.
- Apply the standard byte, timeout, and file-signature limits to external Image sources.
- Treat external fetch failures as non-scoring diagnostics and continue behavioral analysis.
- Keep peer-reviewed Evidence samples in pending/approved repository folders and derive the general seed fingerprint manifest only from approved samples.
- Track specifications and tickets as local Markdown under `.scratch/`.
- Make one atomic Conventional Commit for each completed implementation step.

## Completed

- Configured the repository's agent workflow, issue tracker, triage vocabulary, and domain-doc layout.
- Selected the initial deployable slice and runtime architecture.
- Selected the initial moderator workflow and operational boundaries.
- Defined message cleanup, attachment handling, and the initial admin command surface.
- Defined initial scoring persistence, moderator corrections, and future community-reporting boundaries.
- Defined enforcement ordering, partial-failure behavior, and quality gates.
- Defined command registration, configuration fallback, event deduplication, and health behavior.
- Defined image-source priority, onboarding fallback, and future central review retention.
- Defined the SSRF-resistant external image-fetch policy.
- Rewrote `plan.md` around the Bun runtime while preserving the broader feature roadmap.
- Published the initial-release specification as ready for agent implementation.
- Published ten approved, dependency-ordered implementation tickets.
- Completed ticket 01: bootable Bun service, validated configuration, Drizzle migrations, SQLite health, and production-like Compose workflow.
- Completed ticket 02: guild-scoped Discord connection, admin configuration, Drizzle-backed overrides, onboarding, and message filtering.

## Next

- Implement ticket 03: evaluate explainable message assessments.
