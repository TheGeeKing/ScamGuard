# 01 — Benchmark imagehash-web

**What to build:** A repeatable compatibility and accuracy harness decides whether `imagehash-web` is suitable for ScamGuard's Bun-only pHash and crop-resistant pipeline.

**Blocked by:** none

**Status:** wontfix

- [x] Windows compatibility attempt is documented; installation fails at `canvas@2.11.2`.
- [x] Linux production-image compatibility attempt is documented; installation fails at `canvas@2.11.2`.
- [x] Stability, accuracy, false-positive, and latency gates are explicitly marked not measurable after the prerequisite failure.
- [x] Results are committed as Markdown with a clear no-go recommendation.
- [x] Production dependencies, detection, scoring, and Discord behavior remain unchanged.
- [x] Tests, TypeScript, and Biome pass.

## Result

Evaluation completed with a no-go decision for this candidate.

See [`benchmarks/perceptual/imagehash-web-3.1.1.md`](../../../benchmarks/perceptual/imagehash-web-3.1.1.md).
