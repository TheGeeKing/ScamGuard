import { fileURLToPath } from "node:url";
import { createDiscordBot, type DiscordBot } from "./bot/discord-adapter";
import { loadConfig } from "./config";
import { createBehaviorTracker } from "./domain/behavior";
import { createModerationEnforcer } from "./domain/enforcement";
import { createScamGuard, type ScamGuardEvent } from "./domain/scamguard";
import { loadEvidence } from "./fingerprints/evidence-loader";
import {
  applyFingerprintReview,
  fingerprintClassificationSignals,
  shouldPromoteHotFingerprint,
} from "./fingerprints/moderator-actions";
import { startHealthServer } from "./health/http";
import {
  canFetchImageSource,
  fingerprintImages,
  type ImageSource,
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
  const fingerprintSources = (sources: ImageSource[]) =>
    fingerprintImages(sources, {
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
  const discord: DiscordBot = createDiscordBot({
    token: config.discordToken,
    guildId: config.guildId,
    settings: storage.guildSettings,
    databaseAvailable: storage.isAvailable,
    onSettingsChanged: refreshSettings,
    onEligibleMessage: (event) => dispatchMessage(event),
    onFingerprintReview: async (review) => {
      const fingerprints = await fingerprintSources(review.imageSources);
      const result = await applyFingerprintReview(
        {
          action: review.action,
          guildId: review.guildId,
          moderatorId: review.moderatorId,
          sha256: fingerprints.flatMap((outcome) =>
            outcome.status === "fingerprinted" ? [outcome.sha256] : [],
          ),
        },
        storage.fingerprints,
        new Date(),
      );
      await scamGuard.dispatch({
        kind: "moderator-review",
        guildId: review.guildId,
        messageId: review.messageId,
        action: review.action,
        sha256: fingerprints.flatMap((outcome) =>
          outcome.status === "fingerprinted" ? [outcome.sha256] : [],
        ),
      });
      return result.message;
    },
  });
  const enforcer = createModerationEnforcer({
    timeoutMember: discord.timeoutMember,
    deleteMessage: discord.deleteMessage,
  });
  const behavior = createBehaviorTracker(() => new Date());
  const evidenceHashes = new Set<string>();
  const scamGuard = createScamGuard({
    now: () => new Date(),
    getSettings: storage.guildSettings.get,
    saveIncident: async (incident) => {
      await storage.incidents.save(incident);
      if (!shouldPromoteHotFingerprint(incident)) return;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      for (const sha256 of incident.imageEvidence.flatMap((evidence) =>
        evidence.sha256 ? [evidence.sha256] : [],
      )) {
        if (
          (await storage.fingerprints.classify(
            incident.guildId,
            sha256,
            new Date(),
          )) === "unknown"
        ) {
          await storage.fingerprints.markHot({
            guildId: incident.guildId,
            sha256,
            expiresAt,
          });
        }
      }
    },
    notify: discord.notify,
    enforce: (assessment, settings) =>
      assessment.channelId
        ? enforcer.enforce({
            guildId: assessment.guildId,
            userId: assessment.userId,
            trigger: {
              channelId: assessment.channelId,
              messageId: assessment.messageId,
            },
            cleanup: behavior.cleanupMessages(
              assessment.guildId,
              assessment.userId,
            ),
            intention: assessment.intention,
            moderationMode: settings.moderationMode,
            timeoutMinutes: settings.timeoutMinutes,
            isWebhook: assessment.isWebhook,
          })
        : Promise.resolve([]),
    prepareMessage: async (event) => {
      const fingerprints = await fingerprintSources(event.imageSources ?? []);
      const imageDigests = fingerprints.flatMap((outcome) =>
        outcome.status === "fingerprinted" ? [outcome.sha256] : [],
      );
      const classifications = await Promise.all(
        imageDigests.map((digest) =>
          storage.fingerprints.classify(event.guildId, digest, new Date()),
        ),
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
        signals: [
          ...fingerprintClassificationSignals(
            imageDigests,
            classifications,
            evidenceHashes,
          ),
          ...(event.channelId
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
            : []),
        ],
      };
    },
  });
  dispatchMessage = async (event) => {
    const settings = await storage.guildSettings.get(event.guildId);
    if (
      settings.moderationMode !== "dry-run" &&
      enforcer.isBlocked(event.guildId, event.userId)
    ) {
      if (event.channelId)
        await enforcer.deleteBlockedMessage(
          event.guildId,
          { channelId: event.channelId, messageId: event.messageId },
          settings.moderationMode,
        );
      return;
    }
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
      const evidenceFiles = await loadEvidence(
        fileURLToPath(new URL("../evidence", import.meta.url)),
      );
      for (const evidence of evidenceFiles) {
        evidenceHashes.add(evidence.sha256);
      }
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
