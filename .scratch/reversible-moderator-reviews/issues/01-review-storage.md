# Persist moderator review history

Type: task
Status: resolved

Add the review-event repository and migration, including effect snapshots
needed for safe, non-destructive reversal.

## Comments

## Answer

Added the `moderator_reviews` append-only table and repository. Each event stores
its Incident, actor, action, timestamp, optional reversed review, and an opaque
effect snapshot for the service layer. The repository can retrieve the latest
decision that has not been reversed.
