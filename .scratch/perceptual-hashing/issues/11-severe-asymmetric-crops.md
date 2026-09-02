# Match severe asymmetric crops

Status: completed

## Report

A Discord attachment cropped the left 24% and lower portion of curated Evidence
while changing the aspect ratio. The fast assessment correctly remained at zero,
but the asynchronous 20%-bounded PDQ crop pyramid also returned no match. Its
closest PDQ distance to the source was above the observation threshold.

## Outcome

- Keep whole-image PDQ and the bounded PDQ crop pyramid for resizing,
  recompression, overlays, and modest crops.
- Add at most 20 bright/dark connected regions and a 64-bit difference hash for
  severe crop matching. Region extraction is implemented over the existing
  bounded RGB buffer, without Canvas, Python, native dependencies, or image
  writes.
- Normalize segmented-hash distance onto the existing matcher scale and retain
  observation-only behavior.
- Version the combined representation as `pdq-crops-segments-v2`, causing old
  cached Evidence hashes to be superseded naturally at boot.
- The reported attachment matches `evidence/1.jpg` as one strong observation;
  the other curated images remain outside the segmented threshold.
- Log completion, latency, proposed score, match count, and safe suppression so
  an allowed fast assessment is visibly followed by its asynchronous result.

## Verification

- Production replay of the reported 873×688 Discord attachment
- Deterministic severe asymmetric-crop regression
- `bun test`
- `bun run typecheck`
- `bun run check`
