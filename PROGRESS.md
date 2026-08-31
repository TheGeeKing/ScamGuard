# ScamGuard progress

## Current phase

Product clarification (`grill-with-docs`). No application code has been written yet.

## Confirmed constraints

- Use Bun and TypeScript instead of Python.
- Do not implement Python components.
- OCR is not required in the initial version.
- Preserve a deterministic, explainable fast path that works without optional services.
- Track specifications and tickets as local Markdown under `.scratch/`.
- Make one atomic Conventional Commit for each completed implementation step.

## Completed

- Configured the repository's agent workflow, issue tracker, triage vocabulary, and domain-doc layout.

## Next

- Resolve the initial product and architecture questions.
- Convert the agreed scope into a Bun-focused specification and implementation tickets.
- Implement tickets blocker-first with tests and an atomic commit per ticket.
