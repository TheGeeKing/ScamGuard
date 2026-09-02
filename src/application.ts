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
import { writeLog } from "./logging";
import type { PerceptualReference } from "./perceptual/matcher";
import { matchPerceptual } from "./perceptual/matcher";
import { createPerceptualQueue } from "./perceptual/queue";
import { createPerceptualWorker } from "./perceptual/worker-client";
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
  close(): Promise<void>;
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
  let acceptingMessages = true;
  const perceptualWorker = createPerceptualWorker({
    timeoutMs: config.perceptualAnalysisTimeoutMs,
  });
  const perceptualQueue = createPerceptualQueue(
    {
      maxJobs: config.perceptualQueueMaxJobs,
      maxBytes: config.perceptualQueueMaxBytes,
      maxJobsPerUser: config.perceptualMaxJobsPerUser,
      quantum: config.perceptualQueueQuantum,
    },
    (job) => perceptualWorker.analyze(job.bytes),
  );
  const perceptualReferences: PerceptualReference[] = [];
  const perceptualCandidates = new Map<
    string,
    { sourceId: string; content: ArrayBuffer }[]
  >();
  const inFlight = new Set<Promise<unknown>>();
  const track = <T>(operation: () => Promise<T>): Promise<T> => {
    const pending = operation();
    inFlight.add(pending);
    void pending.then(
      () => inFlight.delete(pending),
      () => inFlight.delete(pending),
    );
    return pending;
  };
  let missingLogWarned = false;
  let retentionTimer: ReturnType<typeof setInterval> | undefined;
  let clearBlocked = (_guildId: string, _userId: string): void => {};
  const refreshSettings = async (): Promise<void> => {
    const settings = await storage.guildSettings.get(config.guildId);
    moderationLogConfigured = settings.moderationLogChannelId !== null;
    if (!moderationLogConfigured && !missingLogWarned) {
      writeLog("warn", "moderation-log.missing", { guildId: config.guildId });
      missingLogWarned = true;
    }
  };
  const expireIncidents = async (): Promise<void> => {
    const settings = await storage.guildSettings.get(config.guildId);
    await storage.incidents.deleteExpired(
      config.guildId,
      new Date(
        Date.now() - settings.incidentRetentionDays * 24 * 60 * 60 * 1000,
      ),
    );
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
    incidents: storage.incidents,
    databaseAvailable: storage.isAvailable,
    onSettingsChanged: refreshSettings,
    onEligibleMessage: (event) =>
      acceptingMessages ? track(() => dispatchMessage(event)) : undefined,
    onFingerprintReview: (review) =>
      track(async () => {
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
        if (review.action === "safe") {
          await storage.incidents.markFalsePositiveByHashes(
            review.guildId,
            fingerprints.flatMap((outcome) =>
              outcome.status === "fingerprinted" ? [outcome.sha256] : [],
            ),
            review.moderatorId,
            new Date(),
          );
        }
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
      }),
    onIncidentReview: (review) =>
      track(async () => {
        const incident = await storage.incidents.find(
          review.guildId,
          review.messageId,
        );
        if (!incident) return `Incident ${review.messageId} was not found.`;
        let message: string;
        if (review.action === "false-positive") {
          await storage.incidents.markFalsePositive(
            review.guildId,
            review.messageId,
            review.moderatorId,
            new Date(),
          );
          message = `Incident ${review.messageId} marked false-positive.`;
        } else {
          const sha256 = incident.imageEvidence.flatMap((evidence) =>
            evidence.sha256 ? [evidence.sha256] : [],
          );
          const result = await applyFingerprintReview(
            {
              action: "safe",
              guildId: review.guildId,
              moderatorId: review.moderatorId,
              sha256,
            },
            storage.fingerprints,
            new Date(),
          );
          await storage.incidents.markFalsePositiveByHashes(
            review.guildId,
            sha256,
            review.moderatorId,
            new Date(),
          );
          await storage.incidents.markFalsePositive(
            review.guildId,
            review.messageId,
            review.moderatorId,
            new Date(),
          );
          await scamGuard.dispatch({
            kind: "moderator-review",
            guildId: review.guildId,
            messageId: review.messageId,
            action: "safe",
            sha256,
          });
          message = result.message;
        }
        const timedOut = incident.actionOutcomes.some(
          (outcome) =>
            outcome.action === "timeout" && outcome.status === "succeeded",
        );
        const alreadyReversed = incident.actionOutcomes.some(
          (outcome) =>
            outcome.action === "timeout-reversal" &&
            outcome.status === "succeeded",
        );
        if (!timedOut || alreadyReversed) return message;
        try {
          await discord.removeTimeout(review.guildId, incident.userId);
          clearBlocked(review.guildId, incident.userId);
          await storage.incidents.appendActionOutcome(
            review.guildId,
            review.messageId,
            {
              action: "timeout-reversal",
              targetId: incident.userId,
              status: "succeeded",
            },
          );
          return `${message} ScamGuard timeout removed.`;
        } catch (error) {
          await storage.incidents.appendActionOutcome(
            review.guildId,
            review.messageId,
            {
              action: "timeout-reversal",
              targetId: incident.userId,
              status: "failed",
              detail: error instanceof Error ? error.message : "unknown error",
            },
          );
          return `${message} Could not remove the ScamGuard timeout; check the bot permissions and retry.`;
        }
      }),
  });
  const enforcer = createModerationEnforcer({
    timeoutMember: discord.timeoutMember,
    deleteMessage: discord.deleteMessage,
  });
  clearBlocked = enforcer.clearBlocked;
  const behavior = createBehaviorTracker(() => new Date());
  const evidenceHashes = new Set<string>();
  const scamGuard = createScamGuard({
    now: () => new Date(),
    getSettings: storage.guildSettings.get,
    saveIncident: async (incident) => {
      await storage.incidents.save(incident);
      writeLog("info", "incident.persisted", {
        guildId: incident.guildId,
        messageId: incident.messageId,
        score: incident.score,
      });
      for (const outcome of incident.actionOutcomes) {
        writeLog(
          outcome.status === "failed" ? "warn" : "info",
          "action.completed",
          {
            guildId: incident.guildId,
            messageId: incident.messageId,
            action: outcome.action,
            status: outcome.status,
          },
        );
      }
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
      perceptualCandidates.set(
        `${event.guildId}:${event.messageId}`,
        fingerprints.flatMap((outcome, index) =>
          outcome.status === "fingerprinted" &&
          classifications[index] !== "known" &&
          classifications[index] !== "safe" &&
          !evidenceHashes.has(outcome.sha256)
            ? [{ sourceId: outcome.sourceId, content: outcome.content }]
            : [],
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
    const outcome = await scamGuard.dispatch(event);
    if (outcome.kind === "assessed") {
      writeLog("info", "assessment.completed", {
        guildId: event.guildId,
        messageId: event.messageId,
        score: outcome.assessment.score,
        intention: outcome.assessment.intention,
      });
      const identity = `${event.guildId}:${event.messageId}`;
      const candidates = perceptualCandidates.get(identity) ?? [];
      perceptualCandidates.delete(identity);
      for (const candidate of candidates) {
        const admission = perceptualQueue.enqueue({
          id: `${identity}:${candidate.sourceId}`,
          guildId: event.guildId,
          userId: event.userId,
          bytes: candidate.content,
        });
        if (admission.status === "rejected") {
          writeLog("warn", "perceptual.queue-rejected", {
            guildId: event.guildId,
            messageId: event.messageId,
            reason: admission.reason,
          });
          continue;
        }
        void track(async () => {
          try {
            const startedAt = Date.now();
            const match = await matchPerceptual(
              await admission.result,
              perceptualReferences,
            );
            await scamGuard.dispatch({
              kind: "perceptual-observation",
              guildId: event.guildId,
              messageId: event.messageId,
              sourceId: candidate.sourceId,
              latencyMs: Date.now() - startedAt,
              proposedScore: match.proposedScore,
              matches: match.matches,
            });
          } catch (error) {
            writeLog("warn", "perceptual.analysis-failed", {
              guildId: event.guildId,
              messageId: event.messageId,
              detail: error instanceof Error ? error.message : "unknown error",
            });
          }
        });
      }
    }
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
        storage.perceptualFingerprints,
      );
      for (const evidence of evidenceFiles) {
        evidenceHashes.add(evidence.sha256);
        if (evidence.perceptual) {
          perceptualReferences.push({
            sourceSha256: evidence.sha256,
            classification: "known",
            hash: evidence.perceptual,
          });
        }
      }
      await refreshSettings();
      await expireIncidents();
      retentionTimer = setInterval(
        () => {
          void expireIncidents().catch(() =>
            writeLog("error", "incident-cleanup.failed", {
              guildId: config.guildId,
            }),
          );
        },
        60 * 60 * 1000,
      );
      retentionTimer.unref();
      await discord.start();
    },
    serveHealth: () =>
      startHealthServer(
        { hostname: config.healthHost, port: config.healthPort },
        health,
      ),
    close: async () => {
      acceptingMessages = false;
      if (retentionTimer) clearInterval(retentionTimer);
      discord.close();
      writeLog("info", "shutdown.started", { inFlight: inFlight.size });
      let deadline: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.allSettled([...inFlight]),
        new Promise((resolve) => {
          deadline = setTimeout(resolve, 10_000);
        }),
      ]);
      if (deadline) clearTimeout(deadline);
      await perceptualQueue.close();
      perceptualWorker.close();
      storage.close();
      writeLog("info", "shutdown.completed");
    },
  };
}
