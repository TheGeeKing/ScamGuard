# Benchmark transformations and negatives

Status: completed

## Outcome

- JPEG/WebP quality 65, resize, brightness, and contrast stay within the
  whole-image PDQ strong starting threshold of 31.
- A lower-right overlay moves whole-image PDQ to distance 66, while the crop
  pyramid retains a distance-2 match.
- A 20% crop plus JPEG recompression remains within the crop prototype's
  distance-15 bound.
- Twelve deterministic, redistributable generated negatives produce no match
  at distance 31 or lower against the tested Evidence image.
- Windows and Alpine return the same expected distances.

## Decision

Proceed to observation-only production integration. Treat distance 15 as the
initial very-strong candidate and 31 as the initial strong candidate. Do not
enable perceptual enforcement until results from real traffic and a larger
ordinary-image corpus have been reviewed.

## Verification

- `bun test benchmarks/perceptual`
- `docker build -f benchmarks/perceptual/Dockerfile -t scamguard-pdq-benchmark .`
- `docker run --rm scamguard-pdq-benchmark`
