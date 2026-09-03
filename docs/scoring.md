# ScamGuard scoring

ScamGuard calculates an Assessment score from named Signals. Signals in the
same group are mutually exclusive: only the strongest active Signal in each
group contributes to the total.

## Active Signals

| Group | Signal | Trigger | Score |
| --- | --- | --- | ---: |
| `message-burst` | `message-burst-5s` | At least 5 messages from the member within 5 seconds | 15 |
| `image-burst` | `image-burst-10s` | At least 5 image messages from the member within 10 seconds | 25 |
| `channel-spread` | `channel-spread-3` | Image messages in at least 3 distinct channels within 10 seconds | 30 |
| `channel-spread` | `channel-spread-5` | Image messages in at least 5 distinct channels within 15 seconds | 50 |
| `exact-repeat` | `exact-repeat-2-channels` | The same SHA-256 image appears in at least 2 channels within 15 seconds | 35 |
| `exact-repeat` | `exact-repeat-3-channels` | The same SHA-256 image appears in at least 3 channels within 15 seconds | 80 |
| `guild-age` | `recent-guild-join` | Member joined the server less than 10 minutes ago | 8 |
| `account-age` | `account-under-7d` | Discord account is less than 7 days old | 5 |
| `account-age` | `account-under-1d` | Discord account is less than 1 day old | 10 |
| `known-fingerprint` | `hot-sha:<digest>` | Exact match for a temporary fingerprint from a recent enforced campaign | 90 |
| `known-fingerprint` | `known-sha:<digest>` | Exact match for a moderator-confirmed or curated scam fingerprint | 100 |
| `perceptual-observation` | `similar-image` | High-confidence perceptual match with a proposed score of 85 or 100 | 85 or 100 |

For example, reaching both channel-spread conditions contributes 50, not
30 + 50. A Known scam fingerprint similarly replaces a Hot fingerprint in
the shared `known-fingerprint` group.

## Perceptual confidence

Perceptual analysis first calculates a proposed confidence score from distinct
trusted source images. Multiple transformations of the same source image count
once.

| Match evidence | Proposed score | Active score |
| --- | ---: | ---: |
| Any weak-only matches | 30 | 0 |
| One strong match | 60 | 0 |
| Two strong matches | 85 | 85 |
| One very-strong match | 85 | 85 |
| At least 3 strong matches | 100 | 100 |
| At least 2 very-strong matches | 100 | 100 |
| At least 1 very-strong and 1 strong match | 100 | 100 |

Proposed scores below 85 remain diagnostic. They do not increase the
Assessment score or create an Incident by themselves. An equally close or
closer safe perceptual reference suppresses the match entirely.

## Decision thresholds

The total active score is compared with the effective server settings:

| Setting | Default | Result |
| --- | ---: | --- |
| `SUSPICIOUS_SCORE` | 50 | Persist an Incident and notify the moderation log |
| `DELETE_SCORE` | 70 | Delete the triggering message in `delete` or `enforce` mode |
| `TIMEOUT_SCORE` | 100 | Timeout the member and clean up recent messages in `enforce` mode |

Scores below `SUSPICIOUS_SCORE` remain in memory for up to five minutes and do
not notify moderators. Server-level settings changed through `/scam thresholds`
override the environment defaults.

Moderation mode still controls which actions are applied: `dry-run` records
intentions, `delete` permits deletion, and `enforce` permits deletion and
timeouts.
