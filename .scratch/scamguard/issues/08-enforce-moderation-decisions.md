# 08 — Enforce moderation decisions idempotently

**What to build:** ScamGuard safely converts policy outcomes into exactly-once Discord moderation, rapidly stops concurrent floods, and continues useful cleanup through partial failures.

**Blocked by:** 04 — Detect cross-channel message floods; 07 — Manage exact scam fingerprints.

**Status:** completed

- [x] Dry-run records and reports intended actions without local block, delete, or timeout.
- [x] Delete mode deletes qualifying messages without timing out members.
- [x] Enforce mode creates local blocked state before attempting one timeout per guild/user transition.
- [x] Newly observed messages from a locally blocked user skip expensive analysis and follow configured deletion behavior.
- [x] Triggering-message deletion precedes deletion of every observed sender message in the five-minute Cleanup window.
- [x] Timeout failure does not prevent deletion, cleanup, outcome persistence, or moderator alerting.
- [x] Webhooks receive deletion-only enforcement and never a timeout attempt.
- [x] Ten simultaneous scam messages produce one timeout attempt and idempotent deletions/notification.
- [x] Discord adapter tests verify ordering and partial outcomes without real credentials.
