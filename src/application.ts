import { createDiscordBot, type DiscordBot } from "./bot/discord-adapter";
import { loadConfig } from "./config";
import { createBehaviorTracker } from "./domain/behavior";
import { createScamGuard, type ScamGuardEvent } from "./domain/scamguard";
import { startHealthServer } from "./health/http";
import {
  canFetchImageSource,
  fingerprintImages,
  isApprovedDiscordMediaUrl,
} from "./images/discord-images";
import { fetchExternalImage } from "./images/external-fetch";
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
  let dispatchMessage = async (
    _event: Extract<ScamGuardEvent, { kind: "message" }>,
  ): Promise<void> => {};
  const discord: DiscordBot = createDiscordBot({
    token: config.discordToken,
    guildId: config.guildId,
    settings: storage.guildSettings,
    databaseAvailable: storage.isAvailable,
    onSettingsChanged: refreshSettings,
    onEligibleMessage: (event) => dispatchMessage(event),
  });
  const behavior = createBehaviorTracker(() => new Date());
  const scamGuard = createScamGuard({
    now: () => new Date(),
    getSettings: storage.guildSettings.get,
    saveIncident: storage.incidents.save,
    notify: discord.notify,
    prepareMessage: async (event) => {
      const fingerprints = await fingerprintImages(event.imageSources ?? [], {
        concurrency: 4,
        maxBytes: config.maxImageBytes,
        timeoutMs: config.imageDownloadTimeoutMs,
        validateSource: (source) =>
          canFetchImageSource(source, config.externalImageFetchEnabled),
        fetch: (url, signal) =>
          isApprovedDiscordMediaUrl(url)
            ? fetch(url, { signal, redirect: "error" })
            : fetchExternalImage(url, signal),
      });
      const imageDigests = fingerprints.flatMap((outcome) =>
        outcome.status === "fingerprinted" ? [outcome.sha256] : [],
      );
      return {
        imageEvidence: fingerprints.map((outcome) =>
          outcome.status === "fingerprinted"
            ? {
                sourceId: outcome.sourceId,
                sha256: outcome.sha256,
                format: outcome.format,
                bytes: outcome.bytes,
              }
            : { sourceId: outcome.sourceId, diagnostics: [outcome.diagnostic] },
        ),
        signals: event.channelId
          ? behavior.observe({
              guildId: event.guildId,
              userId: event.userId,
              messageId: event.messageId,
              channelId: event.channelId,
              imageCount: event.imageCount ?? 0,
              imageDigests,
              accountCreatedAt: event.accountCreatedAt ?? new Date(0),
              guildJoinedAt: event.guildJoinedAt ?? null,
            })
          : [],
      };
    },
  });
  dispatchMessage = async (event) => {
    await scamGuard.dispatch(event);
  };

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
