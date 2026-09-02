# Summarize repeated alert outcomes

Status: completed

## Report

Merged Incidents rendered repeated implementation-shaped outcomes such as
`delete succeeded, delete succeeded`, which did not clearly communicate how
many messages were removed.

## Outcome

- Group deletion outcomes into readable counts such as `Deleted 2 messages`,
  `Would delete 1 message`, and `Failed to delete 1 message`.
- Render timeout and timeout-reversal results as plain-language outcomes.
- Remove the redundant `Removed` counter because per-message statuses and the
  summarized Outcomes section now carry that information.

## Verification

- Two successful delete outcomes render as `Deleted 2 messages` with no raw
  `delete succeeded` text.
- `bun test tests/discord-adapter.test.ts`
- `bun run typecheck`
- `bun run check`
