# 03 — Evaluate explainable Assessments

**What to build:** The approved dispatch seam evaluates typed events into deterministic, explainable outcomes with idempotent Signals, grouped score buckets, policy thresholds, and durable suspicious Incidents.

**Blocked by:** 02 — Connect and configure one Discord server.

**Status:** ready-for-agent

- [ ] One dispatch interface accepts message, admin, moderator-review, and scheduled-cleanup events.
- [ ] One eligible Discord message produces one Assessment containing evidence from all of its Image sources.
- [ ] Re-adding the same Signal key changes neither score nor actions.
- [ ] Only the strongest active Signal in a group contributes to score.
- [ ] Default and guild-overridden thresholds produce allow, suspicious, delete, and timeout intentions.
- [ ] Dry-run records intended outcomes without blocking, deleting, or timing out.
- [ ] `(guild_id, message_id)` deduplicates repeated Discord events.
- [ ] Assessments below 50 expire from memory; Assessments at least 50 persist as Incidents and notify when configured.
- [ ] High-level dispatch scenarios and focused scoring checks pass.
