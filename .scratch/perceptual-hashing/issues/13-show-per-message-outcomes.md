# Show per-message outcomes in merged alerts

Status: completed

## Report

An observation-only score-60 message and a deleted score-85 message were merged
into one user Incident. The alert listed both under `Affected messages`, then
showed one aggregate successful deletion. This was accurate in storage but
visually implied that both messages had been removed.

## Outcome

- Rename the section to `Messages`.
- Derive a status from action outcomes for each message: `Observed`,
  `Would delete`, `Deleted`, or `Delete failed`.
- Preserve direct Discord jump links and the aggregate outcome summary.

## Verification

- A two-message merged alert renders the first as observed and the second as
  deleted.
- `bun test tests/discord-adapter.test.ts`
- `bun run typecheck`
- `bun run check`
