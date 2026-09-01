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

1. Start ScamGuard with `DISCORD_TOKEN` and that server's `GUILD_ID`.
2. Confirm the bot connects and `/scam` appears in that server, but not another.
3. Confirm setup instructions arrive in the system channel. If it is unavailable,
   confirm the server owner receives the DM; if both fail, run `/scam status`.
4. Run `/scam status` and confirm Discord and the database are available, the
   configured mode is shown, and the moderation log starts as not configured.
5. Set a text channel with `/scam log-channel`, then confirm `/health` reports
   `moderationLog` as `configured`.
6. Add one channel to the ignore list. Send one message there and one in a normal
   channel; application logs should show no error while only the latter reaches
   the eligible-message hook.
