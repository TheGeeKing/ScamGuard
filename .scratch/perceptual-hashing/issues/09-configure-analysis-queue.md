# Configure perceptual analysis queue

Status: completed

## Outcome

- Added environment and Compose settings for the queue job cap, byte cap,
  per-guild/user cap, scheduling quantum, and worker timeout.
- Kept one worker as the documented initial architecture.
- Preserved the approved defaults: 32 jobs, 64 MiB, four jobs per guild/user,
  quantum two, and a five-second worker deadline.

## Verification

- `bun test tests/config.test.ts`
- `bun run typecheck`
- `bun run check`
