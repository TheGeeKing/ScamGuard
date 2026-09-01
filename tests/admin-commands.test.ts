import { describe, expect, test } from "bun:test";
import { MessageFlags } from "discord.js";
import {
  type EffectiveGuildSettings,
  handleAdminCommand,
} from "../src/bot/admin-commands";

describe("ScamGuard admin commands", () => {
  test("requires Manage Guild and persists mode overrides", async () => {
    const updates: unknown[] = [];
    const settings = {
      get: async () => {
        throw new Error("not used");
      },
      update: async (guildId: string, values: unknown) => {
        updates.push({ guildId, values });
      },
    };

    expect(
      await handleAdminCommand(
        { kind: "mode", mode: "enforce" },
        { guildId: "guild-1", canManageGuild: false },
        settings,
      ),
    ).toEqual({
      flags: MessageFlags.Ephemeral,
      content: "Manage Server permission is required.",
    });
    expect(updates).toEqual([]);

    expect(
      await handleAdminCommand(
        { kind: "mode", mode: "delete" },
        { guildId: "guild-1", canManageGuild: true },
        settings,
      ),
    ).toEqual({
      content: "Moderation mode set to delete.",
    });
    expect(updates).toEqual([
      { guildId: "guild-1", values: { moderationMode: "delete" } },
    ]);
  });

  test("reports status and persists operational overrides", async () => {
    const current: EffectiveGuildSettings = {
      moderationMode: "dry-run" as const,
      suspiciousScore: 50,
      deleteScore: 70,
      timeoutScore: 100,
      timeoutMinutes: 10,
      incidentRetentionDays: 30,
      moderationLogChannelId: null,
      ignoredChannelIds: ["old-channel"],
      trustedRoleIds: [],
    };
    const updates: unknown[] = [];
    const settings = {
      get: async () => current,
      update: async (guildId: string, values: unknown) => {
        updates.push({ guildId, values });
        Object.assign(current, values);
      },
    };
    const context = { guildId: "guild-1", canManageGuild: true };

    expect(
      await handleAdminCommand({ kind: "status" }, context, settings),
    ).toEqual({
      flags: MessageFlags.Ephemeral,
      content:
        "Discord: connected\nDatabase: available\nMode: dry-run\nModeration log: not configured",
    });
    current.moderationLogChannelId = "log-1";
    expect(
      await handleAdminCommand({ kind: "status" }, context, settings),
    ).toEqual({
      flags: MessageFlags.Ephemeral,
      content:
        "Discord: connected\nDatabase: available\nMode: dry-run\nModeration log: <#log-1>",
    });
    current.moderationLogChannelId = null;
    await handleAdminCommand(
      { kind: "thresholds", suspicious: 40, delete: 60, timeout: 90 },
      context,
      settings,
    );
    await handleAdminCommand(
      { kind: "ignore-channel", action: "add", channelId: "new-channel" },
      context,
      settings,
    );

    expect(updates).toEqual([
      {
        guildId: "guild-1",
        values: { suspiciousScore: 40, deleteScore: 60, timeoutScore: 90 },
      },
      {
        guildId: "guild-1",
        values: { ignoredChannelIds: ["old-channel", "new-channel"] },
      },
    ]);
  });

  test("records a false-positive review publicly", async () => {
    const reviewed: unknown[] = [];
    const reply = await handleAdminCommand(
      { kind: "false-positive", incidentId: "message-1" },
      {
        guildId: "guild-1",
        canManageGuild: true,
        reviewerId: "moderator-1",
      },
      { get: async () => settingsValue, update: async () => {} },
      {
        markFalsePositive: async (...review) => {
          reviewed.push(review);
          return true;
        },
      },
    );

    expect(reply).toEqual({
      content: "Incident message-1 marked false-positive.",
    });
    expect(reviewed[0]).toEqual([
      "guild-1",
      "message-1",
      "moderator-1",
      expect.any(Date),
    ]);
  });
});

const settingsValue: EffectiveGuildSettings = {
  moderationMode: "dry-run",
  suspiciousScore: 50,
  deleteScore: 70,
  timeoutScore: 100,
  timeoutMinutes: 10,
  incidentRetentionDays: 30,
  moderationLogChannelId: null,
  ignoredChannelIds: [],
  trustedRoleIds: [],
};
