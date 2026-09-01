import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guilds = sqliteTable("guilds", {
  guildId: text("guild_id").primaryKey(),
  onboardingCompletedAt: integer("onboarding_completed_at", {
    mode: "timestamp_ms",
  }),
});
