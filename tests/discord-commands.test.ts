import { describe, expect, test } from "bun:test";
import { ApplicationCommandOptionType, ChannelType } from "discord.js";
import { applicationCommands, scamCommand } from "../src/bot/discord-commands";

describe("Discord command registration", () => {
  test("registers moderator message actions", () => {
    expect(applicationCommands.map((command) => command.toJSON().name)).toEqual(
      ["scam", "Mark as scam", "Mark as safe"],
    );
  });

  test("defines the complete guild-scoped scam command", () => {
    const definition = scamCommand.toJSON();

    expect(definition.name).toBe("scam");
    expect(definition.options?.map((option) => option.name)).toEqual([
      "status",
      "mode",
      "thresholds",
      "timeout",
      "retention",
      "log-channel",
      "ignore-channel",
      "trusted-role",
    ]);
    const logChannel = definition.options?.find(
      (option) => option.name === "log-channel",
    );
    expect(logChannel?.type).toBe(ApplicationCommandOptionType.Subcommand);
    expect(
      logChannel && "options" in logChannel
        ? (logChannel.options?.[0] as { channel_types?: number[] })
            ?.channel_types
        : undefined,
    ).toEqual([ChannelType.GuildText, ChannelType.GuildAnnouncement]);
  });
});
