# 07 — Manage exact scam fingerprints

**What to build:** Moderators and peer-reviewed repository evidence maintain trustworthy exact-image fingerprints that immediately improve local campaign detection and remain reversible.

**Blocked by:** 02 — Connect and configure one Discord server; 03 — Evaluate explainable Assessments; 05 — Fingerprint Discord-hosted images safely.

**Status:** completed

- [x] Drizzle persists local known fingerprints, safe overrides, provenance, moderator identity, and hot-fingerprint expiry.
- [x] Same SHA in a second and at least three channels applies only the strongest agreed repeat bucket.
- [x] Exact hot fingerprints accelerate detection of a second attacker and expire automatically.
- [x] **Mark as scam** registers every eligible image on the selected message and reports the count ephemerally.
- [x] **Mark as safe** removes the selected local known hashes and establishes local precedence over future feed data.
- [x] Moderator actions re-evaluate relevant recent Assessments without duplicating Signals or actions.
- [x] Curated raw Evidence images are transparent and loaded directly from `evidence/` at startup.
- [x] Non-image files in `evidence/` never affect detection.
- [x] Provenance, multi-image moderator actions, repetition, hot expiry, and safe override scenarios pass.
