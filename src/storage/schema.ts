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

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id"),
  messageId: text("message_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  imageEvidence: text("image_evidence", { mode: "json" }).notNull(),
  signals: text("signals", { mode: "json" }).notNull(),
  score: integer("score").notNull(),
  intention: text("intention", {
    enum: ["allow", "suspicious", "delete", "timeout"],
  }).notNull(),
  moderationMode: text("moderation_mode", {
    enum: ["dry-run", "delete", "enforce"],
  }).notNull(),
  intendedActions: text("intended_actions", { mode: "json" }).notNull(),
});

export const fingerprints = sqliteTable("fingerprints", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  sha256: text("sha256").notNull(),
  classification: text("classification", {
    enum: ["known", "safe", "hot"],
  }).notNull(),
  source: text("source"),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
});
