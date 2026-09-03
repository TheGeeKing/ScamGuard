# Text rules

ScamGuard checks the text authored in each eligible new or edited Discord
message. It does not scan embed text, attachment filenames, or the referenced
message behind a reply.

Before matching, text is normalized with Unicode NFKC and consecutive
whitespace is collapsed. All rules are case-insensitive. Any match produces a
single 100-point `scam-message-text` Signal; matching several rules does not
stack their scores.

| Rule ID | Name | Pattern |
| --- | --- | --- |
| `cash-for-steam` | Cash for Steam | `\b\d+\$\s+for\s+steam\b` |
| `steam-gift-cash` | Steam gift cash | `\bsteam\s+gift\s+\d+\$` |
| `everyone-mention` | Everyone mention | `@everyone` |
| `here-mention` | Here mention | `@here` |
| `steam-cash` | Steam and cash | `steam.*\d+\$\|\d+\$.*steam` |
| `cash-gift` | Cash gift | `\b\d+\$\s+gift\b` |
| `telegram-username` | Telegram username | `\btelegram\b\susername` |
| `north-american-phone` | North American phone number | `\+\s*1\s*\(\s*\d{3}\s*\)\s*\d{3}\s*-\s*\d{4}` |
| `ask-me-how` | Ask me how | `ask me\s*\(how\)` |
| `limited-people-offer` | Limited people offer | `the first\s+\d+\s+people` |
| `earnings-promise` | Earnings promise | `how to start earning\s*\$\d+k` |
| `remote-hiring` | Remote hiring | `hiring:\s*.*\(\s*remote\s*\)` |
| `cash-whatsapp` | Cash and WhatsApp | `\$\d+\s*.*whatsapp` |
| `cash-telegram` | Cash and Telegram | `\$\d+\s*.*telegram` |
| `hey-babe` | Hey babe | `hey babe` |

The maintainer-supplied true examples are regression fixtures in
`tests/text-rules.test.ts`. Text rule IDs are stable moderator-facing evidence;
rename a rule without changing its ID unless its meaning changes.

