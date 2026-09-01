# 09 — Review and expire Incidents

**What to build:** Moderators can understand, correct, and retain ScamGuard decisions through durable, privacy-minimized Incident reports and scheduled expiration.

**Blocked by:** 03 — Evaluate explainable Assessments; 08 — Enforce moderation decisions idempotently.

**Status:** completed

- [x] Moderator reports show score, named Signals, desired actions, actual outcomes, removed-message count, and relevant latency.
- [x] `/scam false-positive <incident-id>` records reviewer and review time.
- [x] **Mark as safe** marks linked Incidents false-positive but never automatically reverses an existing timeout.
- [x] Incident retention defaults to 30 days and honors environment or guild overrides.
- [x] Scheduled cleanup removes expired Incidents without affecting configuration or fingerprints.
- [x] Durable records and logs contain identifiers and evidence metadata but no message text, token, or runtime-captured image.
- [x] Missing moderation-log configuration leaves the bot healthy and visible through status/local logs.
- [x] Explanation, review, retention, privacy, and missing-channel scenarios pass.
