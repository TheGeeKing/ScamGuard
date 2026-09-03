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
  notificationMessageId: text("notification_message_id"),
  userId: text("user_id").notNull(),
  isWebhook: integer("is_webhook", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  latencyMs: integer("latency_ms").notNull().default(0),
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
  actionOutcomes: text("action_outcomes", { mode: "json" })
    .notNull()
    .default([]),
  falsePositive: integer("false_positive", { mode: "boolean" })
    .notNull()
    .default(false),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
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

export const perceptualFingerprints = sqliteTable("perceptual_fingerprints", {
  id: text("id").primaryKey(),
  sourceSha256: text("source_sha256").notNull(),
  version: text("version").notNull(),
  classification: text("classification", { enum: ["known", "safe"] }).notNull(),
  guildId: text("guild_id"),
  pdq: text("pdq").notNull(),
  quality: integer("quality").notNull(),
  crops: text("crops", { mode: "json" }).$type<string[]>().notNull(),
});
