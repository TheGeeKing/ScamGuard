# ScamGuard initial release

Status: ready-for-agent

## Problem Statement

Discord servers are vulnerable to compromised accounts that rapidly post the same scam campaign across several channels. Human moderators cannot reliably react before the campaign reaches many members, while slow or opaque image-classification systems add latency, operational weight, and false-positive risk. A self-hosted operator needs a lightweight bot that can recognize deterministic behavior and exact image reuse, explain every decision, stop an active flood, and remain safe when image sources are attacker-controlled.

## Solution

Build a single-server ScamGuard release on Bun, TypeScript, discord.js, and Drizzle ORM over Bun SQLite. The bot evaluates each eligible Discord message through a deterministic Signal ledger, applies grouped scoring rules, persists meaningful Incidents and moderator-confirmed fingerprints, and enforces configurable dry-run, delete, or timeout behavior. It analyzes every attachment and visible embed image without writing runtime captures to disk, prefers Discord-hosted media, and uses a guarded external-origin fallback when Discord supplies no proxy.

Administrators configure the bot through Discord commands, review explainable Incidents, register all images in a selected scam message, and reverse local fingerprint mistakes. The release runs directly with Bun and through a production-like Compose workflow. It does not require Python, OCR, perceptual hashing, QR analysis, Valkey, Ollama, or a separate worker.

## User Stories

1. As a server owner, I want ScamGuard to connect to one configured server, so that its initial operating scope is explicit.
2. As a server owner, I want first-run instructions in the system channel, so that setup is discoverable.
3. As a server owner without a usable system channel, I want setup instructions by DM, so that I can still finish configuration.
4. As an administrator, I want `/scam status`, so that I can see readiness, moderation mode, and missing configuration.
5. As an administrator, I want to select dry-run, delete, or enforce mode, so that rollout can become progressively safer and stronger.
6. As an administrator, I want to change suspicious, delete, and timeout thresholds, so that policy can be tuned from observed traffic.
7. As an administrator, I want to configure timeout duration, so that enforcement matches server policy.
8. As an administrator, I want to configure Incident retention, so that review data follows local expectations.
9. As an administrator, I want to select the moderation-log channel, so that staff receive explainable reports.
10. As an administrator, I want to ignore channels, so that known high-noise areas can be excluded.
11. As an administrator, I want to trust roles, so that approved members are excluded from automatic analysis.
12. As an operator, I want environment variables to provide defaults, so that deployments are reproducible.
13. As an administrator, I want Discord command overrides stored in SQLite, so that live configuration survives restarts.
14. As a moderator, I want one Assessment per message, so that evidence from a multi-image campaign is reviewed together.
15. As a moderator, I want every eligible image in a message analyzed, so that four-panel campaigns cannot hide behind an attachment-count limit.
16. As a moderator, I want every score contribution named, so that decisions are explainable.
17. As a moderator, I want duplicate Signals to be idempotent, so that reconnects and repeated processing do not inflate scores.
18. As a moderator, I want overlapping severity buckets to contribute only their strongest value, so that correlated evidence is not double-counted.
19. As a moderator, I want known malicious SHA-256 fingerprints to contribute decisive evidence, so that confirmed campaigns are stopped immediately.
20. As a moderator, I want exact-image reuse across channels detected, so that a compromised account is stopped during a flood.
21. As a moderator, I want message rate, image rate, and channel spread detected, so that behavior can stop attacks before advanced image analysis exists.
22. As a legitimate new member, I want account and join age to remain weak evidence, so that youth alone never triggers moderation.
23. As a legitimate user, I want ordinary image posting to remain below action thresholds, so that normal server activity is unaffected.
24. As an operator, I want low-scoring Assessments discarded after five minutes, so that unnecessary user activity is not retained.
25. As a moderator, I want suspicious Assessments persisted and reported, so that borderline behavior can be reviewed.
26. As a moderator, I want each applied or intended action recorded in an Incident, so that outcomes are auditable.
27. As an operator, I want Incidents removed after the configured retention period, so that data does not accumulate indefinitely.
28. As an operator, I want no message text or runtime-captured raw image stored in v1, so that local persistence is minimal.
29. As a moderator, I want **Mark as scam** to register every eligible image on the selected message, so that complete campaigns enter the local fingerprint set.
30. As a moderator, I want **Mark as scam** to act according to the current moderation mode, so that review and enforcement agree.
31. As a moderator, I want **Mark as safe** to remove selected-image fingerprints, so that mistakes can be corrected.
32. As a moderator, I want linked Incidents marked false-positive, so that tuning data reflects review outcomes.
33. As a moderator, I want an existing timeout left for manual reversal, so that automated correction does not overreach.
34. As a moderator, I want only members with Manage Guild to use configuration and review commands, so that Administrator is unnecessary.
35. As an operator, I want ScamGuard and other bots ignored by default, so that automation does not create loops.
36. As a moderator, I want webhook scam messages analyzed and deleted, so that compromised webhooks are not a bypass.
37. As a webhook author, I want timeout actions excluded, so that impossible enforcement is not attempted.
38. As a moderator, I want the sender locally blocked before a timeout request, so that concurrent flood messages stop expensive processing immediately.
39. As a moderator, I want one timeout attempt per user transition, so that simultaneous messages do not duplicate Discord actions.
40. As a moderator, I want cleanup to cover every observed message from the sender in the preceding five minutes, so that bait and image fragments are removed together.
41. As an operator, I want cleanup limited to messages observed by the current process, so that enforcement does not trigger expensive history scans.
42. As a moderator, I want deletion to continue when timeout fails, so that partial Discord failure still reduces harm.
43. As a moderator, I want each action outcome recorded separately, so that partial failures are visible.
44. As an operator, I want dry-run to create no local block, deletion, or timeout, so that trial operation cannot silently enforce.
45. As an operator, I want duplicate Discord message events to be no-ops, so that reconnect behavior is safe.
46. As a user posting an attachment, I want it downloaded once and streamed through SHA-256, so that analysis is efficient.
47. As a user posting several images, I want bounded processing rather than a message-level attachment cutoff, so that all visible campaign material is covered safely.
48. As an operator, I want byte and time limits enforced independently per image, so that oversized or stalled downloads cannot exhaust the bot.
49. As an operator, I want actual PNG, JPEG, GIF, or WebP signatures validated, so that filenames and MIME declarations are not trusted.
50. As an operator, I want complete GIF files hashed without frame decoding, so that animated media remains lightweight in v1.
51. As a Discord user viewing an embedded external image, I want the visible image assessed, so that posting a rendered link is not a bypass.
52. As an operator, I want Discord CDN and proxy media preferred, so that arbitrary origin access is minimized.
53. As an operator, I want guarded origin fallback limited to rendered image and thumbnail fields, so that ordinary message URLs are never fetched.
54. As an operator, I want external HTTP limited to port 80 and HTTPS to port 443, so that unusual services are not contacted.
55. As an operator, I want private, local, reserved, multicast, link-local, and metadata destinations rejected, so that image fetching cannot become SSRF.
56. As an operator, I want resolved public IPs pinned during requests, so that DNS rebinding cannot redirect a validated request.
57. As an operator, I want redirects capped and fully revalidated, so that redirects cannot bypass destination policy.
58. As an operator, I want external requests stripped of credentials, cookies, authorization, and referrers, so that no ambient secrets leak.
59. As a legitimate user, I want an image-fetch failure to remain non-scoring, so that infrastructure failure is not treated as guilt.
60. As an operator, I want external-origin fetching configurable, so that deployments can prohibit all non-Discord egress.
61. As an operator, I want `/health` to report Discord, SQLite, and notification readiness without secrets, so that Compose can monitor the process safely.
62. As a developer, I want the bot to run with `bun run dev`, so that local iteration is fast.
63. As a developer, I want a Compose workflow with persistent SQLite storage, so that local testing resembles production.
64. As a developer, I want tests, type-checking, and Biome checks to gate every commit, so that each atomic step remains independently usable.
65. As a future multi-server operator, I want guild IDs retained in durable records, so that the model can expand without rewriting existing evidence.
66. As a future community participant, I want Community reporting to be explicit opt-in, so that local detection never silently uploads data.
67. As a future reviewer, I want Community reports to include flagged images, hashes, Signals, time, installation identity, and flagged Discord user ID, so that reports can be evaluated.
68. As a future server operator, I want cross-server user reputation to be weak and expiring, so that it can accelerate detection without becoming a global ban.
69. As a future multi-guild operator, I want manually reviewed fingerprints shared among opted-in guilds on my ScamGuard instance, without synchronizing data with separately operated instances.
70. As a server operator, I want my guild's safe fingerprints to override the Shared fingerprint corpus, so that shared data never removes local control.
71. As a maintainer, I want to commit non-private candidate Evidence samples for peer review, so that general scam fingerprints have visible provenance.
72. As an operator, I want only approved Evidence samples to seed detection, so that pending review cannot change moderation behavior.

## Implementation Decisions

- Use Bun, TypeScript, discord.js, Drizzle ORM with the native `bun:sqlite` driver, Drizzle Kit migrations, bun:test, Biome, Docker, and Compose.
- Target one required guild and register commands in that guild. Retain guild identifiers in all durable domain records.
- Require only the Discord token and guild ID at startup. Other environment values are defaults; guild overrides exist only after an administrator changes them.
- Use one Bun process and in-memory rolling state. Restarting may reset recent windows, cleanup history, and the local blocked cache; Discord timeouts and SQLite data remain.
- Make the primary deep module expose one dispatch interface accepting typed ScamGuard events and returning outcomes. Discord, health HTTP, storage, clock, image transport, and moderation behavior sit behind adapters.
- Use one Assessment per eligible message and a deterministic, idempotent Signal ledger.
- Calculate score from active Signals. Group overlapping severity Signals and keep only the strongest active member per group.
- Start with thresholds 50 suspicious, 70 delete, and 100 timeout. Start with a ten-minute timeout.
- Use the confirmed initial weights from the product plan: known SHA 100; message burst 15; image burst 25; channel spread 30/50; exact repeat across channels 35/80; recent join 8; young account 5/10.
- Persist Incidents at score 50 or above and retain them for 30 days by default. Lower-scoring Assessments remain in memory for five minutes.
- Enforce in this order: local block, timeout attempt, triggering-message deletion, five-minute observed-message cleanup, outcome persistence, moderator notification.
- Serialize enforcement per guild/user. Continue deletion when timeout fails.
- Use Discord attachment URLs and embed image/thumbnail media. Prefer approved Discord CDN/proxy hosts.
- External fallback accepts only HTTP port 80 or HTTPS port 443, rejects credentials and disallowed IP ranges, pins a validated address, revalidates at most two redirects, and carries no ambient credentials.
- Default image limits are 10 MiB per image and ten seconds per download. Process every eligible image with bounded concurrency and continue after individual failures.
- Validate PNG, JPEG, GIF, and WebP signatures. Do not decode pixels or persist runtime-captured raw image bytes in the initial release.
- Make fetch/processing failures diagnostic, named, and non-scoring.
- Ignore ScamGuard and other bots by default. Analyze webhooks with deletion-only enforcement.
- Require Manage Guild for operational commands. Do not request Administrator or View Audit Log.
- Send first-run setup once to the system channel, then the server owner by DM, then rely on the status command.
- Expose a framework-free health endpoint, defaulting to `0.0.0.0:3000` in the container, with component states only.
- Keep structured logs free of tokens, raw images, and message text.
- Keep candidate Evidence samples separate from approved samples. Generate a reviewed seed fingerprint manifest only from approved samples; the runtime never writes to either evidence directory.
- Keep perceptual hashing, QR/URL analysis, OCR, Valkey workers, Ollama, Prometheus metrics, benchmarks, multi-server operation, and community reporting as later roadmap phases.
- Treat `imagehash-web` as the leading perceptual/crop-resistant candidate only after Bun/Linux compatibility, hash-stability, performance, and fixture accuracy evaluation.
- Future Community reports use encrypted central review storage. Unreviewed images expire after 30 days; rejected images are deleted; accepted retention follows an explicit review policy. Consumers receive signed hashes, not raw images.

## Testing Decisions

- Test external behavior through the dispatch seam with deterministic events and in-memory adapters for time, persistence, image transport, and Discord actions.
- Prefer high-level scenarios that exercise input through Signals, policy, persistence, and outcomes rather than testing internal helpers.
- Add focused pure scoring tests for Signal idempotency, grouped-bucket replacement, threshold transitions, and correlated evidence.
- Cover normal image traffic, legitimate bursts, classic same-image cross-channel floods, known SHA enforcement, and weak account-age evidence.
- Cover four-image messages, unlimited eligible attachment counts under bounded processing, individual attachment failure, full-file GIF hashing, and file-signature rejection.
- Cover Discord proxy preference, guarded HTTP and HTTPS fallback, IP-range rejection, DNS pinning, redirect revalidation, byte/time limits, and credential stripping.
- Cover dry-run, delete, enforce, webhook deletion-only behavior, timeout failure with continued cleanup, per-user concurrency, and action idempotency.
- Cover moderator fingerprint registration/removal, false-positive review, environment fallback, guild overrides, Incident retention, and onboarding idempotency.
- Cover duplicate Discord events and process restart assumptions without asserting implementation details.
- Use mocked Discord integration tests plus a documented manual smoke test with user-provided development credentials.
- Run `bun test`, TypeScript type-checking, Biome checks, and the smallest relevant smoke check before each implementation commit.
- There is no prior application code or test precedent in this repository.

## Out of Scope

- Python in the bot runtime
- Decoded-image analysis in the initial release
- Perceptual or crop-resistant hashing before compatibility and accuracy benchmarks
- QR decoding and deterministic URL intelligence
- OCR and Ollama/VLM enrichment
- Valkey, a separate analysis worker, and durable rolling windows
- Prometheus metrics and detector benchmark tooling
- Multi-server operation and per-server command registration
- Community report transport, central review infrastructure, cross-server reputation, and the per-instance Shared fingerprint corpus
- Automatic bans, automatic permanent fingerprint learning, and automatic timeout reversal
- Fetching ordinary URLs found in message text or future QR/OCR output
- Video, PDF, and document analysis
- A web administration dashboard

## Further Notes

- The fast path is authoritative and remains deterministic.
- Community reporting is deliberately documented for later design but creates no v1 storage or network behavior.
- `plan.md` remains the broader product roadmap; this specification defines the narrower initial release.
