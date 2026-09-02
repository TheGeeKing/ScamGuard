# Discord setup

ScamGuard registers `/scam` only in the server identified by `GUILD_ID`.

Enable the privileged **Message Content Intent** for the application. The bot
requests only these gateway intents:

- Guilds
- Guild Messages
- Message Content

Invite the bot with the `bot` and `applications.commands` scopes and grant only:

- View Channels
- Send Messages
- Read Message History
- Manage Messages
- Moderate Members

ScamGuard does not need the Administrator permission. Administrators who use
`/scam` configuration commands need the Discord **Manage Server** permission.

## Manual smoke test

Use a disposable server and real credentials only for this manual check:

1. Create an application in the Discord Developer Portal, add a bot, copy its token into `DISCORD_TOKEN`, and enable **Message Content Intent**.
2. Invite it to a disposable server with the `bot` and `applications.commands` scopes and only the permissions listed above. Set that server ID as `GUILD_ID`.
3. Start ScamGuard and confirm `GET /health` returns HTTP 200.
4. Confirm the bot connects and `/scam` appears in that server, but not another.
5. Confirm setup instructions arrive in the system channel. If it is unavailable,
   confirm the server owner receives the DM; if both fail, run `/scam status`.
6. Run `/scam status` and confirm Discord and the database are available, the
   configured mode is shown, and the moderation log starts as not configured.
7. Set a text channel with `/scam log-channel`, then confirm `/health` reports
   `moderationLog` as `configured`.
8. In `dry-run`, use **Mark as scam** on a message with a test image. Confirm the Incident shows the known-SHA Signal and intended actions without deleting or timing out.
9. Post the same test image rapidly across at least three channels. Confirm the report names the flood Signals and includes every attachment.
10. Switch to `delete`; repeat and confirm qualifying messages are deleted without a timeout.
11. Switch to `enforce`; repeat and confirm one timeout attempt, triggering-message deletion, and five-minute observed-message cleanup.
12. Use **Mark as safe** on the test image. Confirm linked Incidents become false-positive, the ScamGuard-applied timeout is removed, and a new copy no longer receives the fingerprint Signal.
13. Run `/scam false-positive <incident-id>` on another Incident and confirm the public review acknowledgement and ScamGuard timeout reversal.
14. Restart ScamGuard. Confirm settings and Incidents remain, while rolling flood and local-block state start empty.
15. Stop with SIGTERM or `docker compose stop`; confirm structured shutdown events appear and the process exits within 15 seconds.
