# 01 — Benchmark imagehash-web

**What to build:** A repeatable compatibility and accuracy harness decides whether `imagehash-web` is suitable for ScamGuard's Bun-only pHash and crop-resistant pipeline.

**Blocked by:** none

**Status:** in-progress

- [ ] Runs with the repository's Bun version on Windows.
- [ ] Runs inside the Linux production image.
- [ ] Repeated runs produce stable hashes.
- [ ] Deterministic positive transformations measure pHash and crop-resistant recall.
- [ ] Unrelated images measure false-positive behavior.
- [ ] Per-image latency and failures are reported.
- [ ] Results are committed as Markdown with a clear go/no-go recommendation.
- [ ] Production detection, scoring, and Discord behavior remain unchanged.
- [ ] Tests, TypeScript, and Biome pass.
