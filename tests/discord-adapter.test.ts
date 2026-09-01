import { describe, expect, test } from "bun:test";
import { GatewayIntentBits } from "discord.js";
import {
  announceModerationLogChannel,
  discordGatewayIntents,
  moderationLogChannelNotice,
  runOnboarding,
  shouldAssessMessage,
} from "../src/bot/discord-adapter";

describe("Discord adapter", () => {
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
