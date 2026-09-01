import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type {
  EffectiveGuildSettings,
  GuildSettingsRepository,
} from "../bot/admin-commands";
import { guilds } from "./schema";

export type StoredGuildSettings = GuildSettingsRepository & {
  isOnboardingComplete(guildId: string): Promise<boolean>;
  completeOnboarding(guildId: string, completedAt: Date): Promise<void>;
};

export function createGuildSettingsRepository(
  database: BunSQLiteDatabase,
  defaults: EffectiveGuildSettings,
): StoredGuildSettings {
  return {
    get: async (guildId) => {
      const row = await database
        .select()
        .from(guilds)
        .where(eq(guilds.guildId, guildId))
        .get();
      return {
        moderationMode: row?.moderationMode ?? defaults.moderationMode,
        suspiciousScore: row?.suspiciousScore ?? defaults.suspiciousScore,
        deleteScore: row?.deleteScore ?? defaults.deleteScore,
        timeoutScore: row?.timeoutScore ?? defaults.timeoutScore,
        timeoutMinutes: row?.timeoutMinutes ?? defaults.timeoutMinutes,
        incidentRetentionDays:
          row?.incidentRetentionDays ?? defaults.incidentRetentionDays,
        moderationLogChannelId: row?.moderationLogChannelId ?? null,
        ignoredChannelIds: row?.ignoredChannelIds ?? defaults.ignoredChannelIds,
        trustedRoleIds: row?.trustedRoleIds ?? defaults.trustedRoleIds,
      };
    },
    update: async (guildId, values) => {
      await database
        .insert(guilds)
        .values({ guildId, ...values })
        .onConflictDoUpdate({ target: guilds.guildId, set: values })
        .run();
    },
    isOnboardingComplete: async (guildId) => {
      const row = await database
        .select({ completedAt: guilds.onboardingCompletedAt })
        .from(guilds)
        .where(eq(guilds.guildId, guildId))
        .get();
      return row?.completedAt !== null && row?.completedAt !== undefined;
    },
    completeOnboarding: async (guildId, completedAt) => {
      await database
        .insert(guilds)
        .values({ guildId, onboardingCompletedAt: completedAt })
        .onConflictDoUpdate({
          target: guilds.guildId,
          set: { onboardingCompletedAt: completedAt },
        })
        .run();
    },
  };
}
