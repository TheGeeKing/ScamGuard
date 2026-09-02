import type { EffectiveGuildSettings } from "../bot/admin-commands";
import type { ImageSource } from "../images/discord-images";
import type { ActionOutcome } from "./enforcement";

export type Signal = {
  key: string;
  group: string;
  weight: number;
};

export type ImageEvidence = {
  sourceId: string;
  sha256?: string;
  format?: "png" | "jpeg" | "gif" | "webp";
  bytes?: number;
  diagnostics?: string[];
};

export type Intention = "allow" | "suspicious" | "delete" | "timeout";

export type Assessment = {
  guildId: string;
  channelId: string | null;
  messageId: string;
  userId: string;
  isWebhook: boolean;
  createdAt: Date;
  latencyMs: number;
  imageEvidence: ImageEvidence[];
  signals: Signal[];
  score: number;
  intention: Intention;
};

export type IncidentRecord = Assessment & {
  moderationMode: EffectiveGuildSettings["moderationMode"];
  intendedActions: ("delete" | "timeout")[];
  actionOutcomes: ActionOutcome[];
  falsePositive: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | null;
};

export type ScamGuardEvent =
  | {
      kind: "message";
      guildId: string;
      messageId: string;
      userId: string;
      channelId?: string;
      imageCount?: number;
      imageSources?: ImageSource[];
      imageDigests?: string[];
      accountCreatedAt?: Date;
      guildJoinedAt?: Date | null;
      isWebhook?: boolean;
      imageEvidence: ImageEvidence[];
      signals: Signal[];
    }
  | { kind: "admin"; guildId: string }
  | {
      kind: "moderator-review";
      guildId: string;
      messageId: string;
      action: "scam" | "safe";
      sha256: string[];
    }
  | { kind: "scheduled-cleanup"; guildId: string };

export type DispatchOutcome =
  | { kind: "assessed"; assessment: Assessment; appliedActions: string[] }
  | { kind: "duplicate"; assessment?: undefined }
  | { kind: "accepted"; assessment?: undefined };

type Ports = {
  now(): Date;
  getSettings(guildId: string): Promise<EffectiveGuildSettings>;
  saveIncident(incident: IncidentRecord): Promise<unknown>;
  notify(incident: IncidentRecord): Promise<unknown>;
  prepareMessage?(
    event: Extract<ScamGuardEvent, { kind: "message" }>,
  ): Promise<{ imageEvidence: ImageEvidence[]; signals: Signal[] }>;
  enforce?(
    assessment: Assessment,
    settings: EffectiveGuildSettings,
  ): Promise<ActionOutcome[]>;
};

const fiveMinutes = 5 * 60 * 1000;

function activeSignals(signals: Signal[]): Signal[] {
  const byKey = new Map<string, Signal>();
  for (const signal of signals) {
    if (!byKey.has(signal.key)) byKey.set(signal.key, signal);
  }
  const byGroup = new Map<string, Signal>();
  for (const signal of byKey.values()) {
    const existing = byGroup.get(signal.group);
    if (
      !existing ||
      signal.weight > existing.weight ||
      (signal.weight === existing.weight && signal.key < existing.key)
    ) {
      byGroup.set(signal.group, signal);
    }
  }
  return [...byGroup.values()].sort(
    (left, right) =>
      left.group.localeCompare(right.group) ||
      left.key.localeCompare(right.key),
  );
}

function intentionFor(
  score: number,
  settings: EffectiveGuildSettings,
): Intention {
  if (score >= settings.timeoutScore) return "timeout";
  if (score >= settings.deleteScore) return "delete";
  if (score >= settings.suspiciousScore) return "suspicious";
  return "allow";
}

function intendedActions(intention: Intention): ("delete" | "timeout")[] {
  if (intention === "timeout") return ["timeout", "delete"];
  if (intention === "delete") return ["delete"];
  return [];
}

export function createScamGuard(ports: Ports): {
  dispatch(event: ScamGuardEvent): Promise<DispatchOutcome>;
  activeAssessmentCount(): number;
} {
  const handledMessages = new Set<string>();
  const persistedMessages = new Set<string>();
  const recent = new Map<string, Assessment>();

  const expire = (): void => {
    const cutoff = ports.now().getTime() - fiveMinutes;
    for (const [key, assessment] of recent) {
      if (assessment.createdAt.getTime() <= cutoff) recent.delete(key);
    }
  };

  const persist = async (
    identity: string,
    assessment: Assessment,
    settings: EffectiveGuildSettings,
    actionOutcomes: ActionOutcome[],
  ): Promise<void> => {
    if (persistedMessages.has(identity)) return;
    persistedMessages.add(identity);
    const incident: IncidentRecord = {
      ...assessment,
      moderationMode: settings.moderationMode,
      intendedActions: intendedActions(assessment.intention),
      actionOutcomes,
      falsePositive: false,
      reviewedBy: null,
      reviewedAt: null,
    };
    await ports.saveIncident(incident);
    if (settings.moderationLogChannelId) await ports.notify(incident);
  };

  return {
    dispatch: async (event) => {
      expire();
      if (event.kind === "moderator-review") {
        const settings = await ports.getSettings(event.guildId);
        const reviewed = new Set(event.sha256);
        let selected: Assessment | undefined;
        for (const [identity, current] of recent) {
          const matches = current.imageEvidence.some(
            (evidence) => evidence.sha256 && reviewed.has(evidence.sha256),
          );
          if (current.guildId !== event.guildId || !matches) continue;
          const retained = current.signals.filter(
            (signal) =>
              ![...reviewed].some(
                (sha256) =>
                  signal.key === `known-sha:${sha256}` ||
                  signal.key === `hot-sha:${sha256}`,
              ),
          );
          const signals = activeSignals([
            ...retained,
            ...(event.action === "scam"
              ? [...reviewed].map((sha256) => ({
                  key: `known-sha:${sha256}`,
                  group: "known-fingerprint",
                  weight: 100,
                }))
              : []),
          ]);
          const score = signals.reduce(
            (total, signal) => total + signal.weight,
            0,
          );
          const assessment: Assessment = {
            ...current,
            signals,
            score,
            intention: intentionFor(score, settings),
          };
          recent.set(identity, assessment);
          const actionOutcomes =
            (await ports.enforce?.(assessment, settings)) ?? [];
          if (score >= 50)
            await persist(identity, assessment, settings, actionOutcomes);
          if (current.messageId === event.messageId) selected = assessment;
        }
        return selected
          ? { kind: "assessed", assessment: selected, appliedActions: [] }
          : { kind: "accepted" };
      }
      if (event.kind !== "message") return { kind: "accepted" };

      const identity = `${event.guildId}:${event.messageId}`;
      if (handledMessages.has(identity)) return { kind: "duplicate" };
      handledMessages.add(identity);

      const startedAt = ports.now();
      const settings = await ports.getSettings(event.guildId);
      const prepared = await ports.prepareMessage?.(event);
      const signals = activeSignals([
        ...event.signals,
        ...(prepared?.signals ?? []),
      ]);
      const score = signals.reduce((total, signal) => total + signal.weight, 0);
      const assessment: Assessment = {
        guildId: event.guildId,
        channelId: event.channelId ?? null,
        messageId: event.messageId,
        userId: event.userId,
        isWebhook: event.isWebhook ?? false,
        createdAt: ports.now(),
        latencyMs: ports.now().getTime() - startedAt.getTime(),
        imageEvidence: [
          ...event.imageEvidence,
          ...(prepared?.imageEvidence ?? []),
        ],
        signals,
        score,
        intention: intentionFor(score, settings),
      };

      recent.set(identity, assessment);
      const actionOutcomes =
        (await ports.enforce?.(assessment, settings)) ?? [];
      if (score >= 50)
        await persist(identity, assessment, settings, actionOutcomes);

      return {
        kind: "assessed",
        assessment,
        appliedActions: actionOutcomes.map(
          (outcome) => `${outcome.action}:${outcome.status}`,
        ),
      };
    },
    activeAssessmentCount: () => {
      expire();
      return recent.size;
    },
  };
}
