# ScamGuard progress

## Current phase

Product clarification (`grill-with-docs`). No application code has been written yet.

## Confirmed constraints

- Use Bun and TypeScript instead of Python.
- Use `discord.js` for the Discord client.
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
- Track specifications and tickets as local Markdown under `.scratch/`.
- Make one atomic Conventional Commit for each completed implementation step.

## Completed

- Configured the repository's agent workflow, issue tracker, triage vocabulary, and domain-doc layout.
- Selected the initial deployable slice and runtime architecture.
- Selected the initial moderator workflow and operational boundaries.
- Defined message cleanup, attachment handling, and the initial admin command surface.

## Next

- Resolve the initial product and architecture questions.
- Convert the agreed scope into a Bun-focused specification and implementation tickets.
- Implement tickets blocker-first with tests and an atomic commit per ticket.
