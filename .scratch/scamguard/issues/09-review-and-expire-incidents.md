# 09 — Review and expire Incidents

**What to build:** Moderators can understand, correct, and retain ScamGuard decisions through durable, privacy-minimized Incident reports and scheduled expiration.

**Blocked by:** 03 — Evaluate explainable Assessments; 08 — Enforce moderation decisions idempotently.

**Status:** ready-for-agent

- [ ] Moderator reports show score, named Signals, desired actions, actual outcomes, removed-message count, and relevant latency.
- [ ] `/scam false-positive <incident-id>` records reviewer and review time.
- [ ] **Mark as safe** marks linked Incidents false-positive but never automatically reverses an existing timeout.
- [ ] Incident retention defaults to 30 days and honors environment or guild overrides.
- [ ] Scheduled cleanup removes expired Incidents without affecting configuration or fingerprints.
- [ ] Durable records and logs contain identifiers and evidence metadata but no message text, token, or runtime-captured image.
- [ ] Missing moderation-log configuration leaves the bot healthy and visible through status/local logs.
- [ ] Explanation, review, retention, privacy, and missing-channel scenarios pass.
