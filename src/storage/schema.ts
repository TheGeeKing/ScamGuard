import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guilds = sqliteTable("guilds", {
  guildId: text("guild_id").primaryKey(),
  onboardingCompletedAt: integer("onboarding_completed_at", {
    mode: "timestamp_ms",
  }),
  moderationMode: text("moderation_mode", {
    enum: ["dry-run", "delete", "enforce"],
  }),
  suspiciousScore: integer("suspicious_score"),
  deleteScore: integer("delete_score"),
  timeoutScore: integer("timeout_score"),
  timeoutMinutes: integer("timeout_minutes"),
  incidentRetentionDays: integer("incident_retention_days"),
  moderationLogChannelId: text("moderation_log_channel_id"),
  ignoredChannelIds: text("ignored_channel_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  trustedRoleIds: text("trusted_role_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
});
