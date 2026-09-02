# Perceptual and crop-resistant hashing

Status: benchmark-approved

## Goal

Detect resized, recompressed, lightly edited, and cropped variants of trusted scam images without delaying ScamGuard's exact-SHA and behavioral fast path.

## Benchmark gate

Before production integration, benchmark `imagehash-web` with Bun on Windows and in the Linux Compose image.

- Exercise pHash and crop-resistant hashing against curated `evidence/` images.
- Generate deterministic resize, JPEG/WebP recompression, brightness/contrast, overlay, 5/10/20% crop, and crop-plus-recompression variants.
- Compare against a small committed redistributable negative set and permit a larger local corpus.
- Require deterministic repeated results, bounded execution, zero strong/very-strong matches in the committed negatives, and less than 0.1% strong matches in a larger corpus.
- Publish compatibility, latency, transformation recall, and false-positive results as Markdown.
- Require an explicit human go/no-go decision before production integration.

## Approved production design after a go decision

- Keep exact SHA-256 as the synchronous fast path.
- Compute pHash and crop-resistant hashes asynchronously in a bounded Bun worker-thread pool.
- Default to one worker, 32 queued jobs, 64 MiB queued bytes, four outstanding jobs per guild/user, and a scheduling quantum of two.
- Retry worker crashes, communication failures, and timeouts once in the same job slot.
- Skip perceptual work for exact known, curated, or safe SHA matches.
- Retain no downloaded bytes or decoded pixels.
- Cache curated hashes in SQLite by source SHA-256 and algorithm version.
- Load guild-scoped known and safe perceptual references into memory.
- Let an equally close or closer safe reference suppress a scam match.
- Group pHash and crop evidence into one non-linear Signal:
  - any weak-only matches: +30
  - one strong distinct trusted reference: +60
  - two strong distinct references: +85
  - three strong distinct references: +100
  - one very-strong reference: +85
  - two very-strong distinct references: +100
- Use the trusted source SHA-256 as reference identity; transformations of one source never multiply evidence.
- Start with perceptual enforcement disabled while still persisting and displaying a simple `similar-image` Signal.
- Keep technical match details in `/scam incident`; do not direct moderators to that command from alerts.
- Expose owner-only worker health through `/scam analysis-status`.
- Add Prometheus queue, latency, failure, match, and enforcement metrics in the next phase.

Numeric distance thresholds remain a later decision informed by benchmark distributions.
