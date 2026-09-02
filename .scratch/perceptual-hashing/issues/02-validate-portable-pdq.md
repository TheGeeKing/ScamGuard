# Validate portable PDQ pipeline

Status: completed

## Outcome

- Bun's portable image backend, `pngjs@7.0.0`, and `pdq-wasm@0.3.9` install
  without Python or native compilation.
- The same curated JPEG produces the same 256-bit hash and quality on Windows
  and `oven/bun:1.4.0-alpine`.
- Whole-image PDQ is deterministic but not crop-resistant: 5%, 10%, and 20%
  center crops measure 52, 90, and 128 bits from the original.
- Keep PDQ for whole-image similarity and benchmark a separate region multihash.

## Verification

- `bun test benchmarks/perceptual/pdq-benchmark.test.ts`
- `docker build -f benchmarks/perceptual/Dockerfile -t scamguard-pdq-benchmark .`
- `docker run --rm scamguard-pdq-benchmark`
