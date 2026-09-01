import type { EffectiveGuildSettings } from "../bot/admin-commands";

export type Signal = {
  key: string;
  group: string;
  weight: number;
};

export type ImageEvidence = {
  sourceId: string;
  diagnostics?: string[];
};

export type Intention = "allow" | "suspicious" | "delete" | "timeout";

export type Assessment = {
  guildId: string;
  messageId: string;
  userId: string;
  createdAt: Date;
  imageEvidence: ImageEvidence[];
  signals: Signal[];
  score: number;
  intention: Intention;
};

export type IncidentRecord = Assessment & {
  moderationMode: EffectiveGuildSettings["moderationMode"];
  intendedActions: ("delete" | "timeout")[];
};

export type ScamGuardEvent =
  | {
      kind: "message";
      guildId: string;
      messageId: string;
      userId: string;
      channelId?: string;
      imageCount?: number;
      imageDigests?: string[];
      accountCreatedAt?: Date;
      guildJoinedAt?: Date | null;
      imageEvidence: ImageEvidence[];
      signals: Signal[];
    }
  | { kind: "admin"; guildId: string }
  | { kind: "moderator-review"; guildId: string; incidentId: string }
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
  const recent = new Map<string, Assessment>();

  const expire = (): void => {
    const cutoff = ports.now().getTime() - fiveMinutes;
    for (const [key, assessment] of recent) {
      if (assessment.createdAt.getTime() <= cutoff) recent.delete(key);
    }
  };

  return {
    dispatch: async (event) => {
      expire();
      if (event.kind !== "message") return { kind: "accepted" };

      const identity = `${event.guildId}:${event.messageId}`;
      if (handledMessages.has(identity)) return { kind: "duplicate" };
      handledMessages.add(identity);

      const settings = await ports.getSettings(event.guildId);
      const signals = activeSignals(event.signals);
      const score = signals.reduce((total, signal) => total + signal.weight, 0);
      const assessment: Assessment = {
        guildId: event.guildId,
        messageId: event.messageId,
        userId: event.userId,
        createdAt: ports.now(),
        imageEvidence: event.imageEvidence,
        signals,
        score,
        intention: intentionFor(score, settings),
      };

      if (score >= 50) {
        const incident: IncidentRecord = {
          ...assessment,
          moderationMode: settings.moderationMode,
          intendedActions: intendedActions(assessment.intention),
        };
        await ports.saveIncident(incident);
        if (settings.moderationLogChannelId) await ports.notify(incident);
      } else {
        recent.set(identity, assessment);
      }

      return { kind: "assessed", assessment, appliedActions: [] };
    },
    activeAssessmentCount: () => {
      expire();
      return recent.size;
    },
  };
}
