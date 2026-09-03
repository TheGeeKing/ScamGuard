import { describe, expect, test } from "bun:test";
import { createScamGuard, type IncidentRecord } from "../src/domain/scamguard";

const settings = {
  moderationMode: "dry-run" as const,
  suspiciousScore: 50,
  deleteScore: 70,
  timeoutScore: 100,
  timeoutMinutes: 10,
  incidentRetentionDays: 30,
  moderationLogChannelId: "logs",
  ignoredChannelIds: [],
  trustedRoleIds: [],
};

describe("ScamGuard dispatch", () => {
  test("creates one explainable Assessment and keeps only the strongest group Signal", async () => {
    const incidents: IncidentRecord[] = [];
    const notifications: string[] = [];
    const app = createScamGuard({
      now: () => new Date("2026-09-01T00:00:00Z"),
      getSettings: async () => settings,
      saveIncident: async (incident) => incidents.push(incident),
      notify: async (incident) => notifications.push(incident.messageId),
    });

    const outcome = await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      messageId: "message-1",
      userId: "user-1",
      imageEvidence: [
        { sourceId: "a" },
        { sourceId: "b" },
        { sourceId: "c" },
        { sourceId: "d" },
      ],
      signals: [
        { key: "spread-2", group: "channel-spread", weight: 30 },
        { key: "spread-3", group: "channel-spread", weight: 50 },
        { key: "recent-join", group: "account", weight: 8 },
        { key: "recent-join", group: "account", weight: 8 },
      ],
    });

    expect(outcome.kind).toBe("assessed");
    if (outcome.kind !== "assessed") throw new Error("expected Assessment");
    expect(outcome.assessment.imageEvidence).toHaveLength(4);
    expect(outcome.assessment.signals.map((signal) => signal.key)).toEqual([
      "recent-join",
      "spread-3",
    ]);
    expect(outcome.assessment.score).toBe(58);
    expect(outcome.assessment.intention).toBe("suspicious");
    expect(outcome.appliedActions).toEqual([]);
    expect(incidents).toHaveLength(1);
    expect(notifications).toEqual(["message-1"]);
  });

  test("deduplicates message events and expires low-score Assessments after five minutes", async () => {
    let now = new Date("2026-09-01T00:00:00Z");
    let preparations = 0;
    const app = createScamGuard({
      now: () => now,
      getSettings: async () => ({ ...settings, moderationLogChannelId: null }),
      saveIncident: async () => {},
      notify: async () => {},
      prepareMessage: async () => {
        preparations += 1;
        return { imageEvidence: [], signals: [] };
      },
    });
    const event = {
      kind: "message" as const,
      guildId: "guild-1",
      messageId: "message-1",
      userId: "user-1",
      imageEvidence: [],
      signals: [{ key: "burst", group: "burst", weight: 15 }],
    };

    expect((await app.dispatch(event)).kind).toBe("assessed");
    expect((await app.dispatch(event)).kind).toBe("duplicate");
    expect(preparations).toBe(1);
    now = new Date("2026-09-01T00:05:00Z");
    expect(app.activeAssessmentCount()).toBe(0);
  });

  test("keeps duplicate keys idempotent and resolves equal group weights stably", async () => {
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => settings,
      saveIncident: async () => {},
      notify: async () => {},
    });
    const outcome = await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      messageId: "stable",
      userId: "user-1",
      imageEvidence: [],
      signals: [
        { key: "z-key", group: "repeat", weight: 35 },
        { key: "a-key", group: "repeat", weight: 35 },
        { key: "z-key", group: "repeat", weight: 80 },
      ],
    });

    expect(outcome.assessment?.signals).toEqual([
      { key: "a-key", group: "repeat", weight: 35 },
    ]);
    expect(outcome.assessment?.score).toBe(35);
  });

  test("maps overridden thresholds to allow, delete, and timeout intentions", async () => {
    const incidents: IncidentRecord[] = [];
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => ({
        ...settings,
        suspiciousScore: 20,
        deleteScore: 40,
        timeoutScore: 60,
      }),
      saveIncident: async (incident) => incidents.push(incident),
      notify: async () => {},
    });

    const assess = async (id: string, weight: number) =>
      app.dispatch({
        kind: "message",
        guildId: "guild-1",
        messageId: id,
        userId: "user-1",
        imageEvidence: [],
        signals: [{ key: id, group: id, weight }],
      });
    expect((await assess("allow", 10)).assessment?.intention).toBe("allow");
    expect((await assess("suspicious", 20)).assessment?.intention).toBe(
      "suspicious",
    );
    expect((await assess("delete", 40)).assessment?.intention).toBe("delete");
    expect((await assess("timeout", 60)).assessment?.intention).toBe("timeout");
    expect(incidents.map((incident) => incident.messageId)).toEqual([
      "suspicious",
      "delete",
      "timeout",
    ]);
  });

  test("persists and reports enforcement outcomes", async () => {
    const incidents: IncidentRecord[] = [];
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => ({ ...settings, moderationMode: "enforce" }),
      saveIncident: async (incident) => incidents.push(incident),
      notify: async () => {},
      enforce: async () => [
        { action: "timeout", targetId: "user-1", status: "failed" },
        { action: "delete", targetId: "message-1", status: "succeeded" },
      ],
    });

    const outcome = await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "message-1",
      userId: "user-1",
      imageEvidence: [],
      signals: [{ key: "known", group: "fingerprint", weight: 100 }],
    });

    expect(outcome.kind === "assessed" && outcome.appliedActions).toEqual([
      "timeout:failed",
      "delete:succeeded",
    ]);
    expect(incidents[0]?.actionOutcomes).toHaveLength(2);
  });

  test("re-evaluates every recent Assessment sharing a reviewed image", async () => {
    const incidents: IncidentRecord[] = [];
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => settings,
      saveIncident: async (incident) => incidents.push(incident),
      notify: async () => {},
    });
    await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      messageId: "message-1",
      userId: "user-1",
      imageEvidence: [{ sourceId: "one", sha256: "a" }],
      signals: [],
    });
    await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      messageId: "message-2",
      userId: "user-2",
      imageEvidence: [{ sourceId: "two", sha256: "a" }],
      signals: [],
    });
    const review = {
      kind: "moderator-review" as const,
      guildId: "guild-1",
      messageId: "message-1",
      action: "scam" as const,
      sha256: ["a"],
    };

    expect((await app.dispatch(review)).assessment?.score).toBe(100);
    expect((await app.dispatch(review)).assessment?.score).toBe(100);
    expect(incidents.map((incident) => incident.messageId)).toEqual([
      "message-1",
      "message-2",
    ]);
  });

  test("removes matching fingerprint Signals after a safe review", async () => {
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => settings,
      saveIncident: async () => {},
      notify: async () => {},
    });
    await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      messageId: "message-1",
      userId: "user-1",
      imageEvidence: [{ sourceId: "one", sha256: "a" }],
      signals: [
        { key: "known-sha:a", group: "known-fingerprint", weight: 100 },
      ],
    });

    const outcome = await app.dispatch({
      kind: "moderator-review",
      guildId: "guild-1",
      messageId: "message-1",
      action: "safe",
      sha256: ["a"],
    });

    expect(outcome.assessment?.score).toBe(0);
    expect(outcome.assessment?.intention).toBe("allow");
  });

  test("deletes a late high-confidence perceptual match without timing out", async () => {
    const incidents: IncidentRecord[] = [];
    const intentions: string[] = [];
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => ({ ...settings, moderationMode: "enforce" }),
      saveIncident: async (incident) => incidents.push(incident),
      notify: async () => {},
      enforce: async (assessment) => {
        intentions.push(assessment.intention);
        return [
          {
            action: "delete",
            targetId: assessment.messageId,
            status: "succeeded",
          },
        ];
      },
    });
    await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      messageId: "message-1",
      userId: "user-1",
      imageEvidence: [{ sourceId: "image-1", sha256: "a" }],
      signals: [],
    });

    const outcome = await app.dispatch({
      kind: "perceptual-observation",
      guildId: "guild-1",
      messageId: "message-1",
      sourceId: "image-1",
      latencyMs: 350,
      proposedScore: 85,
      matches: [
        { sourceSha256: "known", distance: 12, strength: "very-strong" },
      ],
    });

    expect(outcome.assessment?.signals).toContainEqual({
      key: "similar-image",
      group: "perceptual-observation",
      weight: 85,
    });
    expect(outcome.assessment?.score).toBe(85);
    expect(outcome.assessment?.intention).toBe("delete");
    expect(
      outcome.assessment?.imageEvidence[0]?.perceptual?.proposedScore,
    ).toBe(85);
    expect(intentions).toEqual(["allow", "delete"]);
    if (outcome.kind !== "assessed") throw new Error("expected Assessment");
    expect(outcome.appliedActions).toEqual(["delete:succeeded"]);
    expect(incidents[0]?.intendedActions).toEqual(["delete"]);
    expect(incidents[0]?.actionOutcomes).toHaveLength(1);
    expect(incidents).toHaveLength(1);
  });

  test("keeps a late score-30 perceptual match below the alert threshold", async () => {
    let enforcementCalls = 0;
    let incidentSaves = 0;
    let notifications = 0;
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => ({ ...settings, moderationMode: "enforce" }),
      saveIncident: async () => {
        incidentSaves += 1;
      },
      notify: async () => {
        notifications += 1;
      },
      enforce: async () => {
        enforcementCalls += 1;
        return [];
      },
    });
    await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      messageId: "message-1",
      userId: "user-1",
      imageEvidence: [{ sourceId: "image-1", sha256: "a" }],
      signals: [],
    });

    const outcome = await app.dispatch({
      kind: "perceptual-observation",
      guildId: "guild-1",
      messageId: "message-1",
      sourceId: "image-1",
      latencyMs: 350,
      proposedScore: 30,
      matches: [{ sourceSha256: "known", distance: 40, strength: "weak" }],
    });

    expect(outcome.assessment?.score).toBe(30);
    expect(outcome.assessment?.intention).toBe("allow");
    expect(enforcementCalls).toBe(1);
    expect(incidentSaves).toBe(0);
    expect(notifications).toBe(0);
  });

  test("alerts for a late score-60 perceptual match without enforcement", async () => {
    const incidents: IncidentRecord[] = [];
    let notifications = 0;
    let enforcementCalls = 0;
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => ({ ...settings, moderationMode: "enforce" }),
      saveIncident: async (incident) => incidents.push(incident),
      notify: async () => {
        notifications += 1;
      },
      enforce: async () => {
        enforcementCalls += 1;
        return [];
      },
    });
    await app.dispatch({
      kind: "message",
      guildId: "guild-1",
      messageId: "message-1",
      userId: "user-1",
      imageEvidence: [{ sourceId: "image-1", sha256: "a" }],
      signals: [],
    });

    const outcome = await app.dispatch({
      kind: "perceptual-observation",
      guildId: "guild-1",
      messageId: "message-1",
      sourceId: "image-1",
      latencyMs: 350,
      proposedScore: 60,
      matches: [{ sourceSha256: "known", distance: 26, strength: "strong" }],
    });

    expect(outcome.assessment?.score).toBe(60);
    expect(outcome.assessment?.intention).toBe("suspicious");
    expect(enforcementCalls).toBe(1);
    expect(incidents).toHaveLength(1);
    expect(notifications).toBe(1);
  });
});
