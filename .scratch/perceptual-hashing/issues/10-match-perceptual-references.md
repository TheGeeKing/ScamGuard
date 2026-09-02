# Match perceptual references safely

Status: completed

## Outcome

- Match whole-image and crop-pyramid hashes by their closest PDQ distance.
- Ignore query and reference hashes with PDQ quality 49 or lower.
- Deduplicate evidence by trusted source SHA before scoring.
- Apply the approved non-linear weak, strong, and very-strong confidence rules.
- Suppress known-image matches when a safe reference is equally close or
  closer.
- Return proposed confidence separately from active ScamGuard scoring.

## Verification

- `bun test tests/perceptual-matcher.test.ts`
- `bun run typecheck`
- `bun run check`
