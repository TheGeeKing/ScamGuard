# ScamGuard — Discord Image Scam Detection Bot

## 1. Goal

Build a self-hosted Discord moderation bot focused on stopping compromised accounts that rapidly spam scam images across a server.

The primary objectives are:

1. Detect obvious scam campaigns as quickly as possible.
2. Timeout the offending member as soon as the confidence threshold is reached.
3. Delete offending messages.
4. Avoid blocking the real-time decision path on OCR, AI, or other expensive processing.
5. Allow slower detectors to return evidence asynchronously and cause the moderation decision to be re-evaluated.
6. Keep every moderation decision explainable through individual weighted signals.
7. Minimize false positives.
8. Never depend on an LLM for the bot to function.

The bot should remain effective with:

* OCR disabled
* Ollama unavailable
* Valkey unavailable
* asynchronous workers unavailable

The fast deterministic path is the core product.

---

# 2. Technology choices

Use:

* Bun and TypeScript
* discord.js
* Drizzle ORM with Bun's built-in SQLite driver for persistent configuration, fingerprint and moderation data
* in-memory rolling state for the initial release
* bun:test
* Biome for formatting and linting
* Docker / Docker Compose

Later candidates, only after the initial release:

* imagehash-web for perceptual and crop-resistant hashing, after Bun/Linux compatibility and accuracy benchmarks
* Valkey for asynchronous job/result queues and shared ephemeral state
* an optional OCR provider that does not put Python in the bot runtime
* Ollama for asynchronous VLM analysis
* prom-client for Prometheus metrics

Use Bun for dependency management, scripts, tests and execution.

Do not introduce a heavyweight web framework unless it becomes necessary.

---

# 3. Fundamental architecture

The initial release uses one Bun process. Preserve a seam for a later analysis worker:

```text
                         Discord
                            │
                            ▼
                    ┌──────────────┐
                    │ BOT PROCESS  │
                    └──────┬───────┘
                           │
              REAL-TIME / FAST PATH
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
       ▼                   ▼                    ▼
 behaviour/rate       image hashes          QR/URL
 detection            SHA256/pHash          analysis
       │                   │                    │
       └───────────────────┼────────────────────┘
                           ▼
                    SIGNAL LEDGER
                           │
                           ▼
                    SCORE / POLICY
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
              allow              delete/timeout
                │
                │
                ▼
          enqueue optional
          enrichment jobs
                │
                ▼
             Valkey
                │
                ▼
       ┌──────────────────┐
       │ ANALYSIS WORKER  │
       └────────┬─────────┘
                │
       ┌────────┼───────────┐
       ▼        ▼           ▼
 crop hash     OCR      optional VLM
       │        │           │
       └────────┼───────────┘
                ▼
          result stream
                │
                ▼
           BOT PROCESS
                │
                ▼
        ADD NEW SIGNALS
                │
                ▼
          RE-EVALUATE
                │
       ┌────────┴────────┐
       ▼                 ▼
    no action       delete/timeout
```

Only the bot process may perform Discord moderation actions. Valkey, workers, OCR, perceptual hashing, QR analysis and Ollama are later roadmap work, not initial-release dependencies.

The worker must never receive the Discord token and must never directly:

* delete messages
* timeout members
* ban members
* modify guild state

Workers only produce evidence.

---

# 4. Critical design rule: asynchronous evidence

Every Discord message with at least one eligible Image source gets one `Assessment`. The Assessment includes evidence from every eligible attachment and rendered embed image on that message; there is no per-message attachment-count limit.

An assessment is not simply a numeric mutable score.

It contains a ledger of signals:

```text
Assessment(
    id=...,
    guild_id=...,
    channel_id=...,
    message_id=...,
    user_id=...,
    created_at=...,
    signals={
        "known_sha256": Signal(...),
        "same_image_three_channels": Signal(...),
        "qr_suspicious_domain": Signal(...),
    },
)
```

Calculate:

```text
score = sum(active signal weights)
```

Do NOT implement:

```text
assessment.score += 30
```

Instead:

```text
assessment.add_signal(
    key="ocr_suspicious_gift_phrase",
    weight=20,
    source="ocr",
)
```

This provides:

* idempotency
* auditability
* easy tuning
* protection against duplicate worker results
* clear moderator explanations

A detector result must have a deterministic signal key.

Adding the same signal twice must have no effect.

---

# 5. Re-evaluation model

Every time a signal is added:

```text
add signal
   ↓
recalculate score
   ↓
evaluate policy
   ↓
compare desired action against actions already applied
   ↓
apply only newly-required actions
```

Example:

```text
t=0

Behaviour                   +20
pHash                       +25
QR                           +5

score = 50

No action.
OCR is queued.
```

Later:

```text
t=700ms

OCR:
"CLAIM 3 MONTHS FREE NITRO" +25
suspicious URL              +30

new score = 105
```

Immediately:

```text
TIMEOUT member
DELETE message
CLEAN UP related recent messages
NOTIFY moderators
```

Nothing waited for OCR.

OCR merely caused a later escalation.

---

# 6. Enforcement levels

Make thresholds configurable per guild.

Initial defaults:

```text
score < 50
    no moderation

50–69
    suspicious
    retain assessment
    enqueue asynchronous enrichment

70–99
    delete offending message
    alert moderation log

>= 100
    timeout member
    delete offending message
    clean up related recent messages
    alert moderation log
```

Do NOT automatically ban users in v1.

Default timeout duration:

```text
10 minutes
```

Make it configurable.

A timeout is intended to immediately stop a potentially compromised account and give moderators time to inspect it.

---

# 7. Order of moderation actions

If timeout threshold is crossed:

```text
1. mark user locally as blocked
2. issue Discord timeout
3. delete current offending message
4. clean up every tracked message from the user in the Cleanup window
5. persist each action outcome
6. emit moderator notification
```

Do not perform cleanup before attempting the timeout.

As soon as the local blocked state is created, newly received messages from that user should skip expensive analysis and be deleted immediately where appropriate.

Maintain:

```text
blocked_users[(guild_id, user_id)] = blocked_until
```

This avoids waiting for Discord API state propagation.

---

# 8. Tiered detector system

The complete roadmap has four tiers. The initial release implements Tier 0 plus the exact-SHA subset of Tier 1.

## Tier 0 — immediate behavioural analysis

No image processing.

Should complete effectively immediately.

Signals include:

* messages within rolling time window
* image messages within rolling time window
* distinct channels posted to
* same attachment metadata repeated
* user guild join age
* Discord account age
* whether user is already suspicious
* whether user is locally blocked
* whether fingerprint was recently involved in another incident

This tier runs before downloading the image.

It can independently trigger enforcement.

Example:

```text
same user
6 image messages
5 different channels
within 4 seconds
```

This may already be enough to timeout the user.

---

# 9. Tier 1 — fast deterministic image analysis

This runs synchronously, but must have a strict processing budget.

Detectors:

1. raw SHA256
2. known malicious exact-fingerprint matching
3. recent/campaign exact-fingerprint matching

Later roadmap additions are pHash, QR detection and decoded QR URL analysis.

Do not run OCR here.

Do not run crop-resistant hashing here initially.

Do not run an LLM here.

CPU-heavy image-processing operations added later must not execute directly on the Discord event path.

Use a bounded executor.

If the executor is saturated or analysis exceeds the fast-path budget:

```text
skip remaining Tier 1 work
enqueue it for asynchronous processing
continue
```

Never let image processing create event-loop backpressure.

---

# 10. Image downloading

Download each Image source only once. Image sources are attachments plus Discord embed `image` and `thumbnail` fields; ignore decorative author/footer icons and non-image media.

Prefer Discord CDN/proxy URLs. When Discord renders an external image without a proxy and `EXTERNAL_IMAGE_FETCH_ENABLED=true`, use the guarded origin fallback:

* allow HTTP port 80 and HTTPS port 443 only
* reject URL credentials and custom ports
* resolve DNS and reject private, loopback, link-local, multicast, reserved and metadata-service addresses
* pin the request to a validated public IP while preserving hostname verification
* follow at most two redirects, fully revalidating each destination
* send no cookies, authorization or referrer
* apply the same byte, timeout and file-signature limits

Never fetch an ordinary URL merely because it appears in message text.

Flow:

```text
Discord attachment
      ↓
validate metadata
      ↓
download bytes
      ↓
SHA256 while reading
      ↓
file-signature validation
      ↓
fast analysis
```

Limits must be configurable:

```text
MAX_IMAGE_BYTES
SUPPORTED_IMAGE_FORMATS
DOWNLOAD_TIMEOUT
```

Do not trust:

* filename extension
* MIME type
* declared dimensions

Validate actual image contents.

Do not decode image pixels in the initial release. Future decoded-image detectors must add decompression-bomb and malformed-image protections.

Ignore files exceeding configured limits rather than risking bot stability.

---

# 11. Exact SHA256 detection

Store SHA256 for known malicious images.

An exact known malicious hash is extremely strong evidence.

Suggested starting signal:

```text
known malicious SHA256 = +100
```

This allows immediate timeout without further processing.

Also maintain a short-lived campaign SHA cache.

Example:

```text
scam image seen during active attack
          ↓
fingerprint becomes "hot"
          ↓
same exact file arrives from another account
          ↓
very high immediate score
```

---

# 12. Later roadmap — perceptual hashing

Calculate a normal pHash on every supported image in Tier 1.

Store known scam pHashes.

Calculate Hamming distance against known scam hashes.

Do not permanently hardcode similarity thresholds without testing.

Start experimentally with ranges similar to:

```text
distance <= 3
    extremely similar

distance <= 6
    strong similarity

distance <= 10
    weak similarity
```

Tune these against a real dataset.

Only apply the strongest applicable pHash signal.

Do not stack:

```text
distance <= 3  +80
distance <= 6  +50
distance <=10  +20
```

for the same comparison.

Instead select one bucket.

Example defaults:

```text
known pHash <= 3       +85
known pHash <= 6       +60
known pHash <= 10      +30
```

---

# 13. Recent fingerprint matching

Track recent fingerprints per user and per guild.

For each image store temporarily:

```text
RecentImage(
    user_id,
    channel_id,
    message_id,
    timestamp,
    sha256,
    phash,
)
```

Maintain sliding windows.

Important signals:

```text
same exact image in second channel / 15 s      +35
same exact image in >=3 channels / 15 s        +80

near-identical pHash in second channel         +30
near-identical pHash in >=3 channels           +70
```

This is one of the highest-value detectors.

A normal user posting an image once should produce no behavioural penalty.

A compromised user spraying effectively the same image across many channels should escalate extremely quickly.

---

# 14. Cross-user campaign detection

Also track fingerprints globally within each guild.

Example:

```text
User A posts scam image
User A gets timed out

30 seconds later:

User B posts visually identical image
```

User B should receive immediate additional evidence.

Introduce an ephemeral:

```text
HotFingerprint
```

with:

```text
fingerprint
type
reason
created_at
expires_at
confidence
```

Hot fingerprints should expire automatically, e.g. after 30–60 minutes.

Possible score:

```text
exact hot SHA           +90
very close hot pHash    +70
```

This allows the bot to adapt automatically during an active campaign.

Do NOT automatically promote hot fingerprints into the permanent known-scam database.

Permanent fingerprints require moderator confirmation.

---

# 15. Later roadmap — QR detection

Use OpenCV QR detection.

Tier 1 should attempt:

```text
detect QR
decode QR
```

Signals could include:

```text
QR present                         +5
QR points to unusual domain       +15
QR points to suspicious domain    +30
QR points to known malicious      +100
```

A QR code by itself is not malicious.

Never make QR presence sufficient for moderation.

---

# 16. Later roadmap — URL analysis

Implement a deterministic URL/domain analyzer.

Sources:

* normal Discord message text
* decoded QR content
* OCR output later

Normalize hostnames before evaluating them.

Detect:

* IP-literal hosts
* IDN/punycode
* suspicious brand impersonation
* suspicious subdomains
* malformed/obfuscated URLs
* URL shorteners
* known malicious domains
* configured trusted domains

Maintain:

```text
domain allowlist
domain blocklist
```

CRITICAL:

Never automatically request/fetch a URL found:

* in a message
* in OCR
* inside a QR code

The bot should parse it only.

This avoids SSRF and interaction with malicious infrastructure.

---

# 17. Behaviour detector

Maintain recent user activity in memory initially. Valkey is a later shared-state option.

Suggested windows:

```text
5 seconds
15 seconds
60 seconds
5 minutes
```

Track:

```text
message count
image count
distinct channels
identical SHA count
similar pHash count
URL count
QR count
previous suspicious assessments
```

Example signals:

```text
>=5 messages / 5 s                 +15
>=5 image messages / 10 s          +25
images across >=3 channels / 10 s  +30
images across >=5 channels / 15 s  +50
```

Avoid double-counting highly correlated signals excessively.

For example, represent spam severity as mutually exclusive buckets where appropriate.

---

# 18. Account trust signals

Account/guild age may contribute small amounts of evidence.

Examples:

```text
joined guild <10 min ago      +8
account age <24 h             +10
account age <7 days            +5
```

These must remain weak signals.

Never punish someone merely for having a new account.

Do not stack overlapping account-age buckets.

---

# 19. Tier 2 — asynchronous deterministic analysis

This tier is future roadmap work. A later worker may perform heavier deterministic analysis without changing the bot's Bun runtime.

Initial detectors:

```text
crop-resistant hashing
OCR
additional image transformations if useful
```

The worker receives a job.

Example:

```json
{
  "job_id": "...",
  "assessment_id": "...",
  "guild_id": "...",
  "user_id": "...",
  "message_id": "...",
  "sha256": "...",
  "image_path": "...",
  "detectors": [
    "crop_hash",
    "ocr"
  ]
}
```

Workers return evidence, NOT moderation scores/actions.

Example:

```json
{
  "job_id": "...",
  "assessment_id": "...",
  "results": {
    "crop_hash": "...",
    "ocr": {
      "text": "...",
      "detected_urls": []
    }
  }
}
```

The bot converts those results into configured signals.

---

# 20. Crop-resistant hashing

Evaluate `imagehash-web` crop-resistant hashes asynchronously after a Bun/Linux compatibility and accuracy benchmark.

The worker simply returns the hash.

The bot owns known fingerprint indexes and performs matching.

Example:

```text
worker:
image -> crop-resistant hash

bot:
crop hash -> known scam index -> signal
```

Suggested signal:

```text
strong known crop-resistant match +60
```

Tune thresholds through benchmarks.

This detector exists primarily for modifications such as:

* cropping
* borders
* screenshots
* layout shifts
* added surrounding content

---

# 21. OCR

OCR is not part of the initial release. If later evidence shows it is useful, integrate an optional asynchronous provider without adding Python to the bot runtime.

OCR MUST NOT block the Discord handler.

Optimize it for this use case:

* use a lightweight recognition path
* keep infrastructure and acceleration optional
* process only normal images, not documents/PDFs initially

Extract:

```text
recognized text
recognized URLs/domains
selected scam-related concepts
```

Scoring should be deterministic.

Do not ask OCR itself whether something is a scam.

Example rule groups:

```text
gift:
    "free nitro"
    "nitro gift"
    "3 months nitro"
    "free steam"
    "gift card"

urgency:
    "expires"
    "limited time"
    "claim now"

QR CTA:
    "scan"
    "scan qr"
    "scan the code"

authentication:
    "login"
    "verify"
    "authenticate"
```

Individual keywords should generally be weak.

Combinations can be stronger:

```text
"free nitro"                       +15
"scan QR"                          +10
"free nitro" + "scan QR"           +15 combo
OCR suspicious external domain     +25
OCR known malicious domain         +100
```

Use normalized case-insensitive matching.

Keep OCR rules in configuration/data files rather than hardcoding everything into detector code.

---

# 22. OCR deduplication

OCR may be expensive.

Cache OCR results by exact SHA256.

If the same image is posted 20 times:

```text
first occurrence:
    perform OCR

remaining occurrences:
    reuse cached OCR result
```

Cache results in Valkey.

Suggested TTL:

```text
24 hours
```

Persistent cache can be considered later.

If several assessments are waiting for the same SHA:

```text
1 OCR job
      ↓
1 result
      ↓
fan result out to every relevant assessment
```

Avoid twenty identical OCR jobs.

---

# 23. Tier 3 — optional Ollama/VLM

Implement Ollama support, but:

```text
LLM_ENABLED=false
```

by default.

The entire bot must work without it.

Only enqueue VLM analysis when:

```text
LLM_ENABLED=true
AND
assessment lies in a configurable suspicious range
```

For example:

```text
base score >= 40
base score < 100
```

Do not waste VLM inference on:

```text
score = 0
```

or:

```text
score = 150
```

The latter has already been handled.

Require structured output.

Example:

```json
{
  "scam_probability": 0.94,
  "contains_gift_offer": true,
  "contains_qr_call_to_action": true,
  "impersonated_brand": "Discord",
  "requests_external_authentication": true,
  "reason_codes": [
    "gift_offer",
    "qr_authentication"
  ]
}
```

AI contribution must be capped.

Initial maximum:

```text
+15 points
```

AI must never be sufficient by itself to timeout someone.

The AI is enrichment, not the authority.

---

# 24. Async queue

Use Valkey Streams.

Create:

```text
scamguard:analysis:jobs
scamguard:analysis:results
```

Use consumer groups.

Benefits:

* worker restart resilience
* multiple workers later
* result acknowledgment
* backpressure visibility
* bot/worker isolation

Create a queue abstraction:

```ts
interface AnalysisQueue {
  enqueue(job: AnalysisJob): Promise<void>;
  consumeResults(): AsyncIterable<AnalysisResult>;
}
```

Implement:

```text
ValkeyAnalysisQueue
FakeAnalysisQueue
```

The fake implementation is used in tests.

---

# 25. Graceful degradation

Valkey must not be required for immediate moderation.

If Valkey is unavailable:

```text
FAST PATH STILL RUNS

SHA256 works
pHash works
behaviour works
QR works
timeouts work
deletions work
```

Only async enrichments become unavailable.

Expose this clearly in health/metrics.

Do not fail the bot because the worker infrastructure is down.

---

# 26. Async backpressure

Never allow an overloaded OCR/VLM worker to hurt real-time moderation.

Configure:

```text
MAX_PENDING_JOBS
MAX_JOB_AGE
```

When overloaded:

1. exact duplicate OCR jobs are deduplicated
2. already-actioned/high-confidence assessments can skip expensive jobs
3. low-score enrichment jobs can be dropped
4. old jobs expire

Priority:

```text
1. suspicious but undecided assessments
2. deleted but not timed-out assessments
3. already timed-out users
```

Do not spend VLM resources analyzing obvious known scams.

---

# 27. Temporary image storage

This section applies only if a future asynchronous detector requires image bytes. The initial release never writes downloaded images to disk.

Do not place binary images inside Valkey streams.

The bot already downloaded the image.

If future asynchronous analysis is needed:

```text
write image to shared temporary volume

/data/jobs/<random-assessment-id>.img
```

Docker services:

```text
bot:
    /data/jobs read/write

worker:
    /data/jobs read-only
```

Delete temporary files:

* after all required jobs finish
* or after TTL expiry

Run a periodic cleanup sweep.

Default temporary retention should be short, around several minutes.

Do not persist user images permanently by default.

---

# 28. Worker security

Treat every image as attacker-controlled input.

Worker should have:

* no Discord token
* no Docker socket
* no unnecessary host mounts
* non-root user
* memory limit
* CPU limit
* temporary filesystem limits
* no need for inbound network access

If Ollama is enabled, allow only the necessary connection to the Ollama endpoint.

The worker must never follow URLs extracted from images.

---

# 29. Moderation engine

Create a pure domain service:

```ts
interface ModerationPolicy {
  evaluate(
    assessment: Assessment,
    userState: UserState,
    guildConfig: GuildConfig,
  ): DesiredAction;
}
```

Return:

```text
NONE
LOG
DELETE
TIMEOUT_AND_DELETE
```

This module must know nothing about discord.js.

It should be completely unit testable.

---

# 30. Discord action executor

Create:

```ts
interface DiscordModerationExecutor {
  apply(decision: ModerationDecision): Promise<ModerationOutcome>;
}
```

Responsibilities:

* timeout user
* delete offending message
* clean recent scam messages
* send moderator notification

Actions must be idempotent.

Maintain action state:

```text
ModerationState(
    deleted_message_ids=set(),
    timeout_until=None,
    notified_incidents=set(),
)
```

Multiple assessments arriving simultaneously for one user must not produce ten identical timeout requests.

Use an async per-user lock:

```text
(guild_id, user_id)
```

around enforcement transitions.

---

# 31. Cleanup after timeout

Track every recent message ID for each user in the configured server.

After timeout:

```text
delete:
    current offending message
    every tracked message from the same user in the Cleanup window
```

Do not perform expensive server-wide history searches. Cleanup covers messages observed by the current process.

Default cleanup window:

```text
5 minutes
```

If the timeout request fails, continue deletion and cleanup, record every outcome separately and alert moderators.

Make configurable.

---

# 32. Async result after message deletion

Do not discard an asynchronous result merely because its original message has already been deleted.

Example:

```text
message score 75
message deleted

OCR later returns +40
new score 115
```

The result is still relevant.

It should cause:

```text
member timeout
related cleanup
moderator update
```

Assessment expiration should therefore be longer than message lifetime.

Suggested assessment TTL:

```text
5–15 minutes
```

---

# 33. Async result after user already timed out

Still record the signal for:

* auditability
* campaign fingerprint promotion
* future tuning
* moderator explanation

But don't issue another identical timeout.

If configured timeout duration should now be longer than the existing timeout, policy may extend it.

Otherwise do nothing.

---

# 34. Known scam fingerprint database

SQLite table:

```text
known_fingerprints

id
guild_id nullable
algorithm
value
label
notes
source
created_by
created_at
enabled
```

Algorithms initially:

```text
sha256
phash
crop_hash
```

`guild_id = NULL` can later represent globally trusted scam fingerprints.

Initially prefer guild-specific fingerprints.

Load active fingerprint indexes into memory when the bot starts.

Updates should update the in-memory index immediately.

---

# 35. Do not automatically permanently learn

There are three levels:

```text
recent fingerprint
    short rolling state

hot campaign fingerprint
    automatic
    expires

known scam fingerprint
    persistent
    moderator-approved
```

Do not let an automatic false positive permanently poison the scam database.

---

# 36. Moderator commands

Use Discord application commands.

Implement:

```text
/scam status
/scam mode <dry-run|delete|enforce>
/scam thresholds <suspicious> <delete> <timeout>
/scam timeout <minutes>
/scam retention <days>
/scam log-channel <channel>
/scam ignore-channel <add|remove> <channel>
/scam trusted-role <add|remove> <role>
/scam false-positive <incident-id>
```

Also add message context-menu actions:

```text
Mark as scam
Mark as safe
```

When a moderator marks a message as scam:

1. calculate/store SHA256 for every eligible Image source
2. label each fingerprint with the moderator ID
3. create a moderator-confirmed Incident
4. apply the configured moderation mode to the selected message and sender
5. optionally re-evaluate matching recent assessments

**Mark as safe** should:

* remove every selected-image hash from the local known-scam set
* mark linked Incidents false-positive
* expose which signals caused the incorrect action
* never automatically reverse an existing Discord timeout

Do not automatically remove broad rules solely because of one false positive.

---

# 37. Explanation output

Every moderator action must be explainable.

Example:

```text
ScamGuard timeout

User: @example
Score: 118
Action: 10-minute timeout

Signals:
+80 Same exact image posted in 4 channels / 9s
+25 At least 5 image messages / 10s
+10 New guild member
+ 8 New Discord account

Messages removed: 4
Assessment latency to timeout: 143ms
```

When future asynchronous evidence arrives later:

```text
Additional evidence:

+25 OCR detected gift/claim language
+20 OCR detected suspicious external URL

Updated score: 163
```

Do not expose unnecessary raw OCR text publicly.

Moderator log only.

---

# 38. False-positive workflow

Store moderation incidents.

Table:

```text
moderation_incidents

id
guild_id
user_id
created_at
initial_score
final_score
action
signals_json
false_positive
reviewed_by
reviewed_at
```

This allows tuning from real results instead of guessing.

Provide a command/context control to mark:

```text
confirmed scam
false positive
unknown
```

---

# 39. Score configuration

Do not scatter numeric constants through code.

Create declarative configuration.

Example:

```yaml
signals:
  known_sha256: 100
  known_phash_very_close: 85
  known_phash_close: 60

  repeated_image_two_channels: 35
  repeated_image_three_channels: 80

  hot_sha256: 90
  hot_phash: 70

  qr_present: 5
  qr_suspicious_domain: 30
  qr_malicious_domain: 100

  new_guild_member: 8
  new_discord_account: 10

  ocr_gift_offer: 15
  ocr_scan_qr: 10
  ocr_suspicious_domain: 25

thresholds:
  suspicious: 50
  delete: 70
  timeout: 100
```

Environment variables provide defaults. Guild configuration overrides them when an administrator uses a configuration command.

---

# 40. Prevent correlated signal inflation

Signals representing essentially the same fact should belong to groups.

Example:

```text
phash_match:
    weak
    medium
    strong
```

Only one may apply.

Likewise:

```text
cross_channel_spam:
    2 channels
    3 channels
    5 channels
```

Use only the strongest state.

Do not accidentally score:

```text
+20 for >=2
+40 for >=3
+80 for >=5
```

simultaneously.

Represent these as replaceable signals/groups.

---

# 41. Project structure

Use a structure approximately like:

```text
scamguard/
├── package.json
├── bun.lock
├── tsconfig.json
├── biome.json
├── drizzle.config.ts
├── drizzle/
├── README.md
├── compose.yaml
├── Dockerfile
├── .env.example
│
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── bot/
│   ├── domain/
│   ├── detectors/
│   ├── state/
│   ├── storage/
│   └── health/
│
├── evidence/
│   ├── pending/
│   ├── approved/
│   └── fingerprints.json
│
├── tests/
│   ├── fixtures/
│   │   ├── scam/
│   │   └── legitimate/
│   └── perturbations/
│
└── scripts/
    └── benchmark-detector.ts
```

Keep domain logic free from Discord, Valkey and SQLite dependencies.

---

# 42. Discord intents and permissions

Document required setup clearly.

Gateway intents:

```text
Guilds
Guild Messages
Message Content
```

Enable the Message Content privileged intent because image attachments on normal guild messages require it.

Potentially enable Guild Members if implementation later needs member events/cache beyond what message events expose.

Bot permissions:

```text
View Channels
Read Message History
Manage Messages
Moderate Members
Send Messages
Embed Links
```

Do not request Administrator.

Require the invoking member to have `Manage Guild` for configuration and review commands.

On first connection, send setup instructions once to the server system channel. If that is unavailable, DM the server owner once. Persist completion so reconnects do not repeat onboarding; `/scam status` remains the fallback.

---

# 43. Ignore rules

Never analyze:

```text
messages sent by ScamGuard itself
DMs
messages in configured ignored channels
members with configured trusted roles
```

Ignore other bots by default. Analyze webhooks, but limit their enforcement to message deletion because they cannot be timed out.

---

# 44. Observability

Structured logs are required in the initial release. Prometheus metrics are later roadmap work.

At minimum:

```text
scamguard_messages_total
scamguard_images_total

scamguard_detector_duration_seconds{detector=...}
scamguard_detector_errors_total{detector=...}

scamguard_assessments_total
scamguard_assessment_score

scamguard_deletions_total
scamguard_timeouts_total

scamguard_async_jobs_total{detector=...}
scamguard_async_job_duration_seconds{detector=...}
scamguard_async_queue_depth

scamguard_ocr_cache_hits_total
scamguard_ocr_cache_misses_total

scamguard_false_positives_total
```

Add structured logs.

Every assessment/moderation log should contain identifiers such as:

```text
guild_id
channel_id
message_id
user_id
assessment_id
score
action
```

Never log the Discord token.

---

# 45. Performance measurements

Build a benchmark tool.

Measure separately:

```text
SHA256
image decode
pHash
QR detect/decode
crop-resistant hash
OCR
```

Report:

```text
min
median
p95
p99
```

for multiple image resolutions.

The fast path should have a configurable processing budget.

Initial goal:

```text
Tier 0 + Tier 1 CPU work:
p95 < 100 ms after image bytes are available
```

Do not artificially optimize to this target at the expense of correctness.

Measure first.

Any detector consistently exceeding the desired budget should move to asynchronous Tier 2.

---

# 46. Image similarity evaluation suite

Create a corpus layout:

```text
tests/fixtures/scam/
tests/fixtures/legitimate/
```

Do not commit real sensitive/private Discord content without permission.

Create transformed versions automatically:

```text
resize
JPEG recompression
PNG conversion
5% crop
10% crop
border addition
brightness change
contrast change
small rotation
screenshot-like padding
minor noise
```

Run known-scam images against their transformations.

Measure:

```text
true positive rate
false positive rate
pHash distance distribution
crop-hash distance distribution
```

Use the data to choose thresholds.

Do not choose pHash thresholds solely by intuition.

---

# 47. Behaviour simulation tests

Build deterministic tests for scenarios such as:

## Normal

```text
user posts one meme
```

Expected:

```text
no action
```

## Legitimate burst

```text
user uploads 4 different holiday photos to one channel
```

Expected:

```text
no timeout
```

## Classic scam flood

```text
same image
5 channels
within 3 seconds
new account
```

Expected:

```text
timeout
delete tracked scam messages
```

## Slightly modified flood

```text
same scam
different JPEG compression per channel
```

Expected:

```text
pHash identifies similarity
timeout
```

## Async escalation

Initial:

```text
score 55
```

OCR later:

```text
+50
```

Expected:

```text
initially no action
later timeout + delete
```

## Duplicate worker result

Worker sends same result twice.

Expected:

```text
score unchanged after first result
one timeout only
```

## Valkey outage

Expected:

```text
fast detection continues
no crash
async enrichment marked unavailable
```

---

# 48. Concurrency tests

Explicitly test:

```text
10 scam messages from one account arrive almost simultaneously
```

Expected:

```text
one timeout API request
messages cleaned up
no race causing duplicate actions
```

Also test:

```text
OCR result arrives while initial moderation evaluation is running
```

and:

```text
message deletion and timeout results arrive out of order
```

Policy/action processing must remain idempotent.

---

# 49. Persistence strategy

Persist:

```text
guild configuration
known scam fingerprints
domain allow/block lists
moderation incidents
moderator reviews
```

Use Drizzle ORM with the native `bun:sqlite` driver and committed generated migrations.

Maintainers may commit non-private Evidence samples for peer review. Pending samples never affect detection. A checked script derives the general seed fingerprint manifest only from approved samples. The runtime never writes into the evidence directories.

Keep ephemeral:

```text
recent user windows
recent image windows
hot campaign fingerprints
temporary blocked-user cache
analysis job coordination
OCR cache
```

Use in-memory ephemeral state initially. Add Valkey only when a later asynchronous detector or multi-process deployment requires shared state.

The application should rebuild reasonable ephemeral state after restart instead of requiring it to be permanent.

---

# 50. Docker deployment

Create:

```text
compose.yaml

services:
    scamguard-bot
```

SQLite database lives on a persistent volume owned by the bot.

Compose is required even though the initial release has one service because it provides a production-like local workflow, persistent storage and a health check. Add worker and Valkey services only when a later detector requires them.

---

# 51. Optional Ollama deployment

Do not add Ollama itself to the project Compose file.

Connect to an existing endpoint using:

```text
OLLAMA_BASE_URL
OLLAMA_MODEL
OLLAMA_ENABLED
```

Use short request deadlines.

Failure cases:

```text
connection refused
timeout
invalid JSON
model missing
OOM
```

must merely fail that enrichment job.

They must never affect Discord processing.

---

# 52. Configuration

Provide `.env.example`.

At minimum:

```text
DISCORD_TOKEN=
GUILD_ID=

DATABASE_PATH=/data/scamguard.db

SUSPICIOUS_SCORE=50
DELETE_SCORE=70
TIMEOUT_SCORE=100
TIMEOUT_MINUTES=10
INCIDENT_RETENTION_DAYS=30

MAX_IMAGE_BYTES=10485760
IMAGE_DOWNLOAD_TIMEOUT_MS=10000
EXTERNAL_IMAGE_FETCH_ENABLED=true
FAST_ANALYSIS_BUDGET_MS=100

HEALTH_HOST=0.0.0.0
HEALTH_PORT=3000
MODERATION_MODE=dry-run
```

Environment variables provide defaults. Persist a guild value in SQLite only after an administrator overrides that default through a command. The moderation-log channel is configured through Discord and is optional at startup.

Validate configuration at startup.

Fail clearly for mandatory configuration errors.

Optional components should degrade gracefully.

---

# 53. Health checks

Expose:

```text
/health
```

Health status should distinguish:

```text
Discord connected
database available
moderation log configured
```

Return component states only, never identifiers, secrets or configuration values. Metrics are later roadmap work.

---

# 54. Development mode

Support one configured guild for rapid application-command synchronization.

Never hardcode production guild IDs.

Provide:

```text
GUILD_ID
```

`GUILD_ID` is required in the initial release. Global command registration arrives with later multi-server support.

---

# 55. Initial rollout mode

In `dry-run` mode:

* calculate scores
* run all detectors
* log intended deletes
* log intended timeouts
* send moderation reports

but do not actually moderate users.

Use real server traffic to tune thresholds.

Then enable:

```text
delete only
```

before enabling:

```text
timeouts
```

Configuration:

```text
MODERATION_MODE=dry-run
MODERATION_MODE=delete
MODERATION_MODE=enforce
```

---

# 56. Phase 1 — project foundation

Implement:

* Bun and TypeScript project
* configuration
* logging
* tests
* Biome formatting and linting
* discord.js bot connection
* Docker image
* Compose workflow
* `/scam status`
* health endpoint

Acceptance:

```text
bot connects
slash command works
tests run
container runs
```

Suggested atomic commit:

```text
chore: scaffold scamguard project
```

Then:

```text
feat: connect discord bot
```

---

# 57. Phase 2 — pure scoring domain

Implement:

* Signal
* Assessment
* grouped signals
* ModerationPolicy
* DesiredAction
* score thresholds

No Discord moderation yet.

Acceptance:

```text
pure unit tests fully describe score transitions
duplicate signals are idempotent
grouped signals replace weaker variants
```

Commit:

```text
feat: add deterministic assessment scoring
```

---

# 58. Phase 3 — behaviour detector

Implement:

* rolling user state
* message counts
* channel counts
* attachment frequency
* recent image metadata

Acceptance:

Simulated cross-channel spam reaches expected score while ordinary usage does not.

Commit:

```text
feat: detect cross-channel message bursts
```

---

# 59. Phase 4 — image fast path

Implement:

* safe attachment and displayed-embed ingestion
* SHA256
* Discord CDN/proxy preference
* guarded HTTP/HTTPS origin fallback with DNS/IP pinning and redirect revalidation
* file-signature validation
* bounded streaming
* processing budget

Acceptance:

```text
known images can be fingerprinted
event loop remains responsive
invalid images do not crash bot
private or reserved network destinations are never contacted
```

Commit:

```text
feat: add safe image ingestion
```

---

# 60. Phase 5 — fingerprint intelligence

Implement:

* SQLite known fingerprints
* recent fingerprint matching
* cross-channel comparison
* hot fingerprints
* TTL expiration
* moderator **Mark as scam** and **Mark as safe** commands

Acceptance:

```text
same image across channels escalates
hot campaign fingerprint affects second attacker
moderator fingerprint changes take effect without restart
```

Commits:

```text
feat: persist known scam fingerprints
```

```text
feat: detect repeated scam image campaigns
```

---

# 61. Later roadmap — QR and URLs

Implement:

* QR detector
* QR decoding
* URL parser
* allow/block lists
* deterministic URL heuristics

Acceptance:

```text
legitimate QR alone does not trigger action
known malicious QR domain does
no discovered URL is fetched
```

Commit:

```text
feat: analyze qr codes and suspicious domains
```

---

# 62. Phase 7 — moderation

Implement:

* local blocked-user cache
* DiscordModerationExecutor
* deletion
* timeout
* recent-message cleanup
* moderator log
* per-user enforcement locking

Acceptance:

A simulated score transition:

```text
40 -> 110
```

causes exactly:

```text
one timeout
appropriate deletions
one moderation incident
```

Commit:

```text
feat: enforce scam moderation decisions
```

---

# 63. Phase 8 — Valkey worker architecture

Later roadmap; not part of the initial release.

Implement:

* queue abstraction
* Valkey Streams
* bot result consumer
* worker service
* temp image sharing
* deduplication
* retry/error handling
* cleanup

Initially worker can implement a trivial test detector.

Acceptance:

```text
bot queues job
worker receives job
worker produces result
bot adds signal
assessment gets reevaluated
```

Commit:

```text
feat: add asynchronous analysis worker
```

---

# 64. Phase 9 — crop-resistant hashing

First run a Bun/Linux compatibility and accuracy benchmark for `imagehash-web`. Add crop-resistant hashing to a worker only if the benchmark supports it.

Acceptance:

Cropped/modified scam fixtures missed by normal pHash where applicable can still gain asynchronous evidence.

Commit:

```text
feat: add asynchronous crop-resistant matching
```

---

# 65. Phase 10 — OCR

Later optional roadmap. Add an OCR provider only if local deployment evidence shows it is necessary, and do not add Python to the bot runtime.

Implement:

* OCR result cache
* text normalization
* URL extraction
* deterministic OCR rules
* async score update

Acceptance:

```text
message initially below threshold
OCR result pushes score over threshold
moderation happens after OCR completes
```

Commit:

```text
feat: enrich scam assessments with ocr
```

---

# 66. Phase 11 — optional Ollama

Implement:

* feature flag
* structured response schema
* image analysis
* capped evidence contribution
* strict timeout/error handling

Acceptance:

Disabling/stopping Ollama has zero impact on normal moderation.

Commit:

```text
feat: add optional ollama scam enrichment
```

---

# 67. Phase 12 — moderator learning tools

Implement:

* Mark as scam
* Mark as safe
* Mark false positive
* Explain assessment
* incident review
* permanent fingerprint management

Acceptance:

Moderator can add a fingerprint without restarting the bot.

Commit:

```text
feat: add moderator scam review tools
```

---

# 68. Phase 13 — metrics and benchmark suite

Implement:

* Prometheus metrics
* detector timings
* queue timings
* score/action metrics
* benchmark CLI
* fixture transformation suite

Commits:

```text
feat: expose scam detection metrics
```

```text
test: add image similarity benchmark suite
```

---

# 69. Phase 14 — production hardening

Implement:

* rate-limit-aware cleanup
* graceful shutdown
* queue draining
* stale temp-file cleanup
* database backup documentation
* worker resource limits
* health checks
* restart policies
* dry-run/enforcement modes
* guarded external image fetching

Commit:

```text
chore: harden scamguard deployment
```

---

# 70. Coding rules for Codex

Follow these rules throughout implementation.

## Architecture

Do not mix:

```text
detector
scoring
Discord moderation
```

Detectors produce evidence.

Policy converts evidence into desired actions.

Discord adapter performs actions.

## Async

Never await:

```text
OCR
crop-resistant analysis
Ollama
```

inside the Discord message processing decision.

## Reliability

Never require:

```text
Valkey
OCR
Ollama
```

for the fast moderation path.

## Security

Never fetch ordinary URLs discovered in message text, QR data or OCR. A Discord-rendered embed image may use its guarded origin fallback only when Discord provides no proxy.

Never give the worker the Discord token.

Never persist raw images by default.

## Explainability

Every score contribution must have a named signal.

## Idempotency

Duplicate events/results must not duplicate:

```text
scores
timeouts
moderator incidents
```

## Testing

Every bug discovered during development should receive a regression test.

---

# 71. Git workflow

Use atomic conventional commits.

Do not produce one giant implementation commit.

Each commit should:

1. represent one coherent change
2. compile/run independently
3. have its tests passing
4. use Conventional Commit syntax

Examples:

```text
chore: scaffold scamguard project

feat: add deterministic assessment scoring

feat: detect cross-channel image spam

feat: add perceptual image matching

feat: enforce member timeout decisions

feat: add asynchronous analysis worker

feat: enrich assessments with ocr

test: cover asynchronous score escalation
```

Avoid committing unrelated refactors together with functional changes.

---

# 72. Definition of initial release complete

The POC is complete when all of the following work:

### Normal traffic

A legitimate user can post ordinary images without moderation.

### Exact known scam

A known malicious SHA256 causes immediate action.

### Scam flood

One account posts the same image into several channels rapidly.

The bot:

```text
detects repetition
reaches timeout threshold
timeouts account
deletes related spam
```

without OCR or AI.

### Campaign

A second account posting the same active scam benefits from a hot fingerprint and is detected faster.

### Displayed external image

A link rendered by Discord as an image is fingerprinted through Discord's proxy or the guarded origin fallback without permitting access to local, private, reserved or metadata-service addresses.

### Moderator workflow

An administrator can configure operational settings, mark every image in a message as scam, reverse fingerprints with **Mark as safe**, review an explanation and mark an Incident false-positive without restarting the bot.

### Failure

The initial release requires no worker, Valkey, OCR or Ollama. Losing the moderation-log channel does not stop detection or health reporting.

### Explainability

Moderators can see exactly why a message/user received a score.

### Tests

Automated tests cover:

```text
signal idempotency
score thresholds
behaviour windows
concurrent spam
moderation idempotency
external image SSRF defenses
moderator correction paths
```

---

# 73. Features deliberately out of scope for the initial release

Do not implement these until the core detector has real-world validation:

* automatic permanent bans
* cloud AI APIs
* fetching/checking ordinary URLs found in message text, QR or OCR data
* complex ML training
* custom neural image classifier
* full web administration dashboard
* automatic permanent fingerprint learning
* video scam recognition
* PDF/document scam analysis
* large external threat-intelligence feeds
* perceptual and crop-resistant hashing before compatibility and accuracy benchmarks
* QR analysis
* OCR
* Ollama/VLM enrichment
* Valkey and a separate analysis worker
* Prometheus metrics and image benchmark tooling
* opt-in Community reports, Global reputation signals and the signed Global fingerprint feed

Build the fast, deterministic anti-spam/image-fingerprinting system first.

---

# 74. Overall principle

Optimize for this scenario:

```text
compromised Discord account
        ↓
scam image sent to #general
        ↓
same image sent to #gaming
        ↓
same/slightly modified image sent to #help
        ↓
bot recognizes behavioural + visual pattern
        ↓
TIMEOUT
        ↓
DELETE
```

This should happen before OCR or an LLM is necessary.

Slow analysis exists to improve uncertain decisions:

```text
FAST PATH
    decides as much as it can immediately

ASYNC PATH
    adds evidence later
    reruns exactly the same policy
    escalates if necessary
```

The fast path must always remain authoritative, deterministic, lightweight and independently operational.
