import { describe, expect, test } from "bun:test";
import { GatewayIntentBits } from "discord.js";
import {
  discordGatewayIntents,
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

  test("sends first-run instructions once using system channel then owner DM", async () => {
    const calls: string[] = [];
    let complete = false;
    const result = await runOnboarding({
      isComplete: async () => complete,
      sendSystemChannel: async () => {
        calls.push("system");
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
    expect(calls).toEqual(["system", "owner", "complete"]);
    expect(
      await runOnboarding({
        isComplete: async () => complete,
        sendSystemChannel: async () => true,
        sendOwnerDm: async () => true,
        markComplete: async () => {},
      }),
    ).toBe("already-complete");
  });
});
