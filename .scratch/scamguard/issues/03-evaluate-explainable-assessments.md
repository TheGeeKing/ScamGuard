# 03 — Evaluate explainable Assessments

**What to build:** The approved dispatch seam evaluates typed events into deterministic, explainable outcomes with idempotent Signals, grouped score buckets, policy thresholds, and durable suspicious Incidents.

**Blocked by:** 02 — Connect and configure one Discord server.

**Status:** completed

- [x] One dispatch interface accepts message, admin, moderator-review, and scheduled-cleanup events.
- [x] One eligible Discord message produces one Assessment containing evidence from all of its Image sources.
- [x] Re-adding the same Signal key changes neither score nor actions.
- [x] Only the strongest active Signal in a group contributes to score.
- [x] Default and guild-overridden thresholds produce allow, suspicious, delete, and timeout intentions.
- [x] Dry-run records intended outcomes without blocking, deleting, or timing out.
- [x] `(guild_id, message_id)` deduplicates repeated Discord events.
- [x] Assessments below 50 expire from memory; Assessments at least 50 persist as Incidents and notify when configured.
- [x] High-level dispatch scenarios and focused scoring checks pass.
