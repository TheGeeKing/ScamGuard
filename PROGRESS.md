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
- Track specifications and tickets as local Markdown under `.scratch/`.
- Make one atomic Conventional Commit for each completed implementation step.

## Completed

- Configured the repository's agent workflow, issue tracker, triage vocabulary, and domain-doc layout.
- Selected the initial deployable slice and runtime architecture.

## Next

- Resolve the initial product and architecture questions.
- Convert the agreed scope into a Bun-focused specification and implementation tickets.
- Implement tickets blocker-first with tests and an atomic commit per ticket.
