# ScamGuard

ScamGuard detects image-based scam floods in Discord servers and records why each moderation decision was reached.

## Language

**Assessment**:
The complete, explainable evaluation of one Discord message and its author, including evidence from every eligible attachment on that message.
_Avoid_: Scan, verdict

**Signal**:
A named, weighted piece of evidence in an Assessment. A Signal is idempotent: the same key contributes at most once.
_Avoid_: Score increment, point addition

**Fast path**:
The deterministic processing route that can reach a moderation decision without optional services or decoded-image analysis.
_Avoid_: Synchronous AI path, basic mode

**Known scam fingerprint**:
A moderator-confirmed digest representing malicious image content. A message may register several Known scam fingerprints when it contains several image attachments.
_Avoid_: Automatic blacklist entry

**Hot fingerprint**:
A temporary digest associated with a recent active scam campaign; it expires and is never promoted automatically into a Known scam fingerprint.
_Avoid_: Permanent fingerprint

**Moderation mode**:
The configured enforcement level: `dry-run` records intended actions, `delete` removes offending messages, and `enforce` may also timeout members.
_Avoid_: Environment, safety level

**Incident**:
The durable record of an Assessment that requested or applied moderation, including its Signals, desired actions, and actual outcomes.
_Avoid_: Alert, log entry

**False positive**:
An Incident that a moderator has explicitly reviewed and determined was legitimate.
_Avoid_: Error, safe fingerprint

**Cleanup window**:
The five minutes preceding an enforcement decision during which every tracked message from the affected member is eligible for deletion.
_Avoid_: History scan, channel purge

**Community report**:
An opt-in submission of flagged image evidence and the associated Discord user ID to ScamGuard's future central review service.
_Avoid_: Automatic global ban, telemetry

**Global reputation signal**:
Weak, expiring evidence that a Discord user ID was recently associated with similar scam behavior in another opted-in server.
_Avoid_: Global blacklist, ban list

**Global fingerprint feed**:
A future collection of centrally reviewed scam fingerprints that opted-in ScamGuard installations may consume.
_Avoid_: Automatic learning, raw report stream
