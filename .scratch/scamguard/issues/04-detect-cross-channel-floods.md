# 04 — Detect cross-channel message floods

**What to build:** ScamGuard recognizes rapid cross-channel image campaigns from rolling user behavior while ordinary bursts and new accounts remain below inappropriate enforcement thresholds.

**Blocked by:** 03 — Evaluate explainable Assessments.

**Status:** completed

- [x] Rolling windows track message count, image-message count, distinct channels, and observed message IDs by guild/user.
- [x] Message, image, and channel-spread Signals use the agreed weights and mutually exclusive severity buckets.
- [x] Account and guild-join age Signals remain weak and mutually exclusive.
- [x] One meme and four different holiday photos in one channel cause no timeout.
- [x] A classic multi-channel image flood reaches the expected policy threshold.
- [x] Every observed sender message remains eligible for the five-minute Cleanup window.
- [x] Restarting may reset ephemeral windows without corrupting durable state.
- [x] Deterministic clock-based behavior scenarios and quality gates pass.
