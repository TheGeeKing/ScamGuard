# ScamGuard

ScamGuard detects image-based scam floods in Discord servers and records why each moderation decision was reached.

## Language

**Assessment**:
The complete, explainable evaluation of one Discord message and its author, identified independently from the message itself.
_Avoid_: Scan, verdict

**Signal**:
A named, weighted piece of evidence in an Assessment. A Signal is idempotent: the same key contributes at most once.
_Avoid_: Score increment, point addition

**Fast path**:
The deterministic processing route that can reach a moderation decision without optional services or decoded-image analysis.
_Avoid_: Synchronous AI path, basic mode

**Known scam fingerprint**:
A moderator-confirmed digest representing malicious image content.
_Avoid_: Automatic blacklist entry

**Hot fingerprint**:
A temporary digest associated with a recent active scam campaign; it expires and is never promoted automatically into a Known scam fingerprint.
_Avoid_: Permanent fingerprint

**Moderation mode**:
The configured enforcement level: `dry-run` records intended actions, `delete` removes offending messages, and `enforce` may also timeout members.
_Avoid_: Environment, safety level
