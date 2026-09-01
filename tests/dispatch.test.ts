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
    const app = createScamGuard({
      now: () => now,
      getSettings: async () => ({ ...settings, moderationLogChannelId: null }),
      saveIncident: async () => {},
      notify: async () => {},
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
    const app = createScamGuard({
      now: () => new Date(0),
      getSettings: async () => ({
        ...settings,
        suspiciousScore: 20,
        deleteScore: 40,
        timeoutScore: 60,
      }),
      saveIncident: async () => {},
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
    expect((await assess("delete", 40)).assessment?.intention).toBe("delete");
    expect((await assess("timeout", 60)).assessment?.intention).toBe("timeout");
  });
});
