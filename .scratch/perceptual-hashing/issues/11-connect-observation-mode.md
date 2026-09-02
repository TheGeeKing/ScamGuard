# Connect observation-only perceptual analysis

Status: completed

## Outcome

- Load curated perceptual references into memory at startup.
- Skip queued work for exact curated, known, and safe SHA matches.
- Admit analysis only after the fast-path Assessment exists.
- Persist and notify a simple zero-weight `similar-image` Signal when a trusted
  perceptual reference matches.
- Store proposed confidence and technical matches inside Image evidence for
  later incident inspection.
- Preserve the original score, intention, action outcomes, and enforcement
  behavior during the observation-only rollout.
- Update an existing evolving Incident alert when analysis completes late.

## Verification

- `bun test tests/application.test.ts tests/dispatch.test.ts tests/incidents.test.ts tests/discord-adapter.test.ts tests/perceptual-queue.test.ts tests/perceptual-worker.test.ts`
- `bun run typecheck`
- `bun run check`
