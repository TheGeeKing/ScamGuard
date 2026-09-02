# Forward bounded image bytes to analysis

Status: completed

## Outcome

- Retain each already-downloaded, signature-validated image in memory long
  enough to transfer it to perceptual analysis.
- Keep the existing byte limit, timeout, and bounded download concurrency.
- Do not add image bytes to persisted Incident evidence.

## Verification

- `bun test tests/images.test.ts tests/application.test.ts tests/moderator-actions.test.ts`
- `bun run typecheck`
- `bun run check`
