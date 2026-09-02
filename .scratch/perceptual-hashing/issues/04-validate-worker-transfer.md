# Validate transferable worker hashing

Status: completed

## Outcome

- Transfer encoded image bytes into a Bun worker without writing runtime files.
- Return the deterministic whole-image PDQ hash, quality, and crop pyramid.
- Terminate and replace a worker successfully.
- Produce the same golden hash on Windows and Alpine.

## Verification

- `bun test benchmarks/perceptual`
- `docker build -f benchmarks/perceptual/Dockerfile -t scamguard-pdq-benchmark .`
- `docker run --rm scamguard-pdq-benchmark`
