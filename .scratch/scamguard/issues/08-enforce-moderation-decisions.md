# 08 — Enforce moderation decisions idempotently

**What to build:** ScamGuard safely converts policy outcomes into exactly-once Discord moderation, rapidly stops concurrent floods, and continues useful cleanup through partial failures.

**Blocked by:** 04 — Detect cross-channel message floods; 07 — Manage exact scam fingerprints.

**Status:** ready-for-agent

- [ ] Dry-run records and reports intended actions without local block, delete, or timeout.
- [ ] Delete mode deletes qualifying messages without timing out members.
- [ ] Enforce mode creates local blocked state before attempting one timeout per guild/user transition.
- [ ] Newly observed messages from a locally blocked user skip expensive analysis and follow configured deletion behavior.
- [ ] Triggering-message deletion precedes deletion of every observed sender message in the five-minute Cleanup window.
- [ ] Timeout failure does not prevent deletion, cleanup, outcome persistence, or moderator alerting.
- [ ] Webhooks receive deletion-only enforcement and never a timeout attempt.
- [ ] Ten simultaneous scam messages produce one timeout attempt and idempotent deletions/notification.
- [ ] Discord adapter tests verify ordering and partial outcomes without real credentials.
