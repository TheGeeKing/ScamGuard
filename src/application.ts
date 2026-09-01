import { createDiscordBot, type DiscordBot } from "./bot/discord-adapter";
import { loadConfig } from "./config";
import { startHealthServer } from "./health/http";
import { openStorage } from "./storage/database";

export type HealthStatus = {
  process: "ok";
  database: "available" | "unavailable";
  discord: "not-connected" | "connected";
  moderationLog: "not-configured" | "configured";
};

export type Application = {
  health(): HealthStatus;
  start(): Promise<void>;
  serveHealth(): ReturnType<typeof Bun.serve>;
  close(): void;
};

export function createApplication(
  environment: Record<string, string | undefined>,
): Application {
  const config = loadConfig(environment);
  const storage = openStorage(config.databasePath, {
    moderationMode: config.moderationMode,
    suspiciousScore: config.suspiciousScore,
    deleteScore: config.deleteScore,
    timeoutScore: config.timeoutScore,
    timeoutMinutes: config.timeoutMinutes,
    incidentRetentionDays: config.incidentRetentionDays,
    moderationLogChannelId: null,
    ignoredChannelIds: [],
    trustedRoleIds: [],
  });
  let moderationLogConfigured = false;
  const refreshSettings = async (): Promise<void> => {
    const settings = await storage.guildSettings.get(config.guildId);
    moderationLogConfigured = settings.moderationLogChannelId !== null;
  };
  const discord: DiscordBot = createDiscordBot({
    token: config.discordToken,
    guildId: config.guildId,
    settings: storage.guildSettings,
    databaseAvailable: storage.isAvailable,
    onSettingsChanged: refreshSettings,
  });

  const health = (): HealthStatus => ({
    process: "ok",
    database: storage.isAvailable() ? "available" : "unavailable",
    discord: discord.isConnected() ? "connected" : "not-connected",
    moderationLog: moderationLogConfigured ? "configured" : "not-configured",
  });

  return {
    health,
    start: async () => {
      await refreshSettings();
      await discord.start();
    },
    serveHealth: () =>
      startHealthServer(
        { hostname: config.healthHost, port: config.healthPort },
        health,
      ),
    close: () => {
      discord.close();
      storage.close();
    },
  };
}
