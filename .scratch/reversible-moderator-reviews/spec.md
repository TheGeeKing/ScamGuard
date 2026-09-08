# Reversible moderator reviews

Record moderator decisions as durable review events, announce them in the
configured moderation channel, and allow a moderator to reverse a review by
Incident ID without erasing history.

## Behavior

- False-positive and image-safe actions record actor, time, Incident, action,
  and affected image digests.
- Button actions receive an ephemeral acknowledgement and a separate public
  audit entry in the moderation channel.
- `/scam review-revert incident-id:<id>` reverses the latest unreversed review
  created from that Incident.
- Reversing a false-positive restores the Incident as confirmed.
- Reversing an image-safe review restores each fingerprint's prior record,
  including absence, known, or hot state, and restores the prior false-positive
  state of affected Incidents.
- A reversal never reapplies Discord deletion or timeout actions.
- A reversal must not replace a newer fingerprint decision. Such effects are
  reported as superseded and left unchanged.
- Reviews and reversals remain in the audit history.

## Privacy

Public audit messages show the moderator, action, Incident ID, and affected
image count. They do not show image digests or message content.
