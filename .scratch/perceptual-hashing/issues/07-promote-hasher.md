# Promote portable hasher to production

Status: completed

## Outcome

- Added the versioned `hashImageBytes` production interface.
- Normalized input with Bun's portable image backend and a 40-megapixel decode
  guard.
- Returned whole-image PDQ, quality, and the bounded 28-hash crop pyramid.
- Moved `pdq-wasm` and `pngjs` into runtime dependencies.
- Verified the production-only Alpine Docker install needs no Python or native
  compilation.

## Verification

- `bun test tests/perceptual-hash.test.ts`
- `bun run typecheck`
- `bun run check`
- `docker build -t scamguard-production-deps .`
