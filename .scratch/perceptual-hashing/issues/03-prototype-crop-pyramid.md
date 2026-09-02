# Prototype crop-resistant PDQ pyramid

Status: completed

## Outcome

- Normalize images to a maximum 512-pixel edge before pixel extraction.
- Hash the full image plus a 3-by-3 grid at 95%, 90%, and 80% scale.
- Store at most 28 PDQ hashes (896 raw bytes) per reference image.
- Reject content segmentation and 64-bit dHash after curated-image failures.
- Detect the 5%, 10%, and 20% center-crop fixtures at distances 12, 12, and 10.
- Keep numeric production thresholds blocked on the full transformation and
  negative-corpus benchmark.

## Verification

- `bun test benchmarks/perceptual`
- `docker build -f benchmarks/perceptual/Dockerfile -t scamguard-pdq-benchmark .`
- `docker run --rm scamguard-pdq-benchmark`
