# ScamGuard

ScamGuard detects scam messages in Discord servers and records why each moderation decision was reached.

## Language

**Assessment**:
The complete, explainable evaluation of one Discord message and its author, including eligible text and attachment evidence.
_Avoid_: Scan, verdict

**Signal**:
A named, weighted piece of evidence in an Assessment. A Signal is idempotent: the same key contributes at most once.
_Avoid_: Score increment, point addition

**Text rule**:
A named scam-phrase pattern with a stable ID that can produce a Signal when eligible message text matches it.
_Avoid_: AutoMod rule, text filter

**Fast path**:
The deterministic processing route that can reach a moderation decision without optional services or decoded-image analysis.
_Avoid_: Synchronous AI path, basic mode

**Known scam fingerprint**:
A moderator-confirmed digest representing malicious image content. Marking a message as scam registers every eligible attachment because apparently harmless panels may be campaign material or evasion variants.
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

**Shared fingerprint corpus**:
A centrally reviewed collection of scam fingerprints available to every opted-in guild served by the same multi-guild ScamGuard instance. Separately operated instances do not synchronize their corpora.
_Avoid_: Global feed, federated threat feed, instance synchronization

**Image source**:
An image attachment or rendered embed selected for fingerprinting, preferring Discord CDN/proxy bytes and falling back to a guarded external origin only when no safe Discord proxy exists.
_Avoid_: URL found in message text, arbitrary remote resource

**Evidence sample**:
A maintainer-supplied, non-private scam image committed under `evidence/` for peer review and fingerprinted when ScamGuard starts.
_Avoid_: Runtime capture, Community report
