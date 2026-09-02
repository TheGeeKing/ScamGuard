# Add bounded perceptual analysis queue

Status: completed

## Outcome

- Admit work synchronously without delaying the exact-SHA/behavior fast path.
- Bound outstanding jobs, bytes, and jobs per guild/user.
- Rotate users after a configurable scheduling quantum.
- Retry a failed analysis once in the same queue slot.
- Use one persistent Bun worker that is replaced after a crash or timeout.
- Preserve the source byte buffer for the single retry while transferring a
  copy to the worker.

## Verification

- `bun test tests/perceptual-queue.test.ts tests/perceptual-worker.test.ts`
- `bun run typecheck`
- `bun run check`
