# Enforce high-confidence late matches

Status: completed

## Policy

- Keep perceptual hashing asynchronous; never delay the exact-SHA and behavior
  fast path.
- Promote proposed scores of 85 or 100 into the active `similar-image` Signal.
- Apply guild thresholds and moderation mode, but cap a newly raised
  perceptual decision at message deletion. Perceptual evidence cannot initiate
  a member timeout in this phase.
- Keep proposed score 60 observation-only so one strong segmented match can
  update the Incident without deleting the message.
- Preserve earlier action outcomes when late enforcement updates an existing
  Incident.

## Result

The asynchronous result re-evaluates the recent Assessment, deletes the
triggering message in `delete` or `enforce` mode when confidence is high enough,
and updates the existing Incident notification with the final outcome. Dry-run
continues to record only intended actions.

## Verification

- Late score 85 deletes without timeout.
- Late score 60 stays alert-only.
- Incident upserts merge late deletion outcomes with existing outcomes.
- `bun test`
- `bun run typecheck`
- `bun run check`
