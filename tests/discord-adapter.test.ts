import { describe, expect, test } from "bun:test";
import { GatewayIntentBits } from "discord.js";
import {
  announceModerationLogChannel,
  discordGatewayIntents,
  incidentNotification,
  mergeIncidentNotifications,
  moderationLogChannelNotice,
  parseIncidentButton,
  runOnboarding,
  shouldAssessMessage,
} from "../src/bot/discord-adapter";

describe("Discord adapter", () => {
  test("links directly to the triggering Discord message in Incident notifications", () => {
    const incident: Parameters<typeof incidentNotification>[0] = {
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "123456789",
      userId: "user-1",
      score: 100,
      intention: "timeout",
      signals: [
        {
          key: `known-sha:${"abcdef0123456789".repeat(4)}`,
          group: "fingerprint",
          weight: 100,
        },
      ],
      intendedActions: ["timeout", "delete"],
      actionOutcomes: [],
      latencyMs: 143,
    };
    const notification = incidentNotification(incident);
    expect(notification).toMatchObject({
      flags: 32768,
      allowedMentions: { users: ["user-1"] },
    });
    const container = notification.components[0]?.toJSON();
    expect(container).toMatchObject({ accent_color: 15548997, type: 17 });
    expect(JSON.stringify(container)).toContain(
      "https://discord.com/channels/guild-1/channel-1/123456789",
    );
    expect(JSON.stringify(container)).toContain("<@user-1>");
    expect(JSON.stringify(container)).not.toContain("<#channel-1>");
    expect(JSON.stringify(container)).toContain("known-sha:abcdef0…");
    expect(JSON.stringify(container)).not.toContain(
      "abcdef0123456789".repeat(4),
    );
    expect(JSON.stringify(container)).not.toContain("Open flagged message");
    expect(JSON.stringify(container)).toContain(
      "scamguard:incident:false-positive:123456789",
    );
    expect(JSON.stringify(container)).toContain(
      "scamguard:incident:safe:123456789",
    );
    expect(parseIncidentButton("scamguard:incident:safe:123456789")).toEqual({
      action: "safe",
      messageId: "123456789",
    });
  });

  test("merges a user's messages and signals into one evolving Incident alert", () => {
    const first = mergeIncidentNotifications(undefined, {
      guildId: "guild-1",
      channelId: "channel-a",
      messageId: "message-a",
      userId: "user-1",
      score: 100,
      intention: "timeout",
      signals: [{ key: "known", group: "fingerprint", weight: 100 }],
      intendedActions: ["timeout", "delete"],
      actionOutcomes: [
        { action: "timeout", targetId: "user-1", status: "succeeded" },
      ],
      latencyMs: 400,
    });
    const merged = mergeIncidentNotifications(first, {
      ...first,
      channelId: "channel-b",
      messageId: "message-b",
      signals: [
        { key: "known", group: "fingerprint", weight: 100 },
        { key: "spread", group: "channel-spread", weight: 30 },
      ],
      actionOutcomes: [
        { action: "delete", targetId: "message-b", status: "succeeded" },
      ],
    });
    expect(merged.messages).toEqual([
      { channelId: "channel-a", messageId: "message-a" },
      { channelId: "channel-b", messageId: "message-b" },
    ]);
    expect(merged.signals.map((signal) => signal.key)).toEqual([
      "known",
      "spread",
    ]);
  });

  test("shows observation-only similarity as a simple signal", () => {
    const notification = incidentNotification({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "message-1",
      userId: "user-1",
      score: 0,
      intention: "allow",
      signals: [
        { key: "similar-image", group: "perceptual-observation", weight: 0 },
      ],
      intendedActions: [],
      actionOutcomes: [],
      latencyMs: 350,
    });
    const rendered = JSON.stringify(notification.components[0]?.toJSON());
    expect(rendered).toContain("similar-image");
    expect(rendered).not.toContain("similar-image (0)");
  });

  test("requests only the guild message intents ScamGuard needs", () => {
    expect(discordGatewayIntents).toEqual([
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]);
  });

  test("excludes messages outside the configured moderation scope", () => {
    const base = {
      guildId: "guild-1",
      channelId: "channel-1",
      authorId: "user-1",
      authorIsBot: false,
      memberRoleIds: ["member"],
    };
    const scope = {
      guildId: "guild-1",
      botUserId: "scamguard",
      ignoredChannelIds: ["ignored"],
      trustedRoleIds: ["trusted"],
    };

    expect(shouldAssessMessage(base, scope)).toBe(true);
    expect(shouldAssessMessage({ ...base, guildId: null }, scope)).toBe(false);
    expect(shouldAssessMessage({ ...base, guildId: "other" }, scope)).toBe(
      false,
    );
    expect(shouldAssessMessage({ ...base, authorIsBot: true }, scope)).toBe(
      false,
    );
    expect(shouldAssessMessage({ ...base, authorId: "scamguard" }, scope)).toBe(
      false,
    );
    expect(shouldAssessMessage({ ...base, channelId: "ignored" }, scope)).toBe(
      false,
    );
    expect(
      shouldAssessMessage({ ...base, memberRoleIds: ["trusted"] }, scope),
    ).toBe(false);
  });

  test("sends first-run instructions once using community updates then owner DM", async () => {
    const calls: string[] = [];
    let complete = false;
    const result = await runOnboarding({
      isComplete: async () => complete,
      sendPublicUpdatesChannel: async () => {
        calls.push("public-updates");
        return false;
      },
      sendOwnerDm: async () => {
        calls.push("owner");
        return true;
      },
      markComplete: async () => {
        complete = true;
        calls.push("complete");
      },
    });

    expect(result).toBe("owner-dm");
    expect(calls).toEqual(["public-updates", "owner", "complete"]);
    expect(
      await runOnboarding({
        isComplete: async () => complete,
        sendPublicUpdatesChannel: async () => true,
        sendOwnerDm: async () => true,
        markComplete: async () => {},
      }),
    ).toBe("already-complete");
  });

  test("announces the new moderation log channel when the setting is saved", async () => {
    const sent: string[] = [];
    expect(
      await announceModerationLogChannel({
        shouldAnnounce: false,
        send: async () => {
          sent.push("sent");
          return true;
        },
      }),
    ).toBe(false);
    expect(sent).toEqual([]);
    expect(
      await announceModerationLogChannel({
        shouldAnnounce: true,
        send: async () => {
          sent.push(moderationLogChannelNotice);
          return true;
        },
      }),
    ).toBe(true);
    expect(sent).toEqual(["This channel is now the ScamGuard moderation log."]);
  });
});
