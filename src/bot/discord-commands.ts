import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const scamCommand = new SlashCommandBuilder()
  .setName("scam")
  .setDescription("Configure and inspect ScamGuard")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((command) =>
    command.setName("status").setDescription("Show status"),
  )
  .addSubcommand((command) =>
    command
      .setName("mode")
      .setDescription("Set moderation mode")
      .addStringOption((option) =>
        option
          .setName("value")
          .setDescription("Moderation mode")
          .setRequired(true)
          .addChoices(
            { name: "Dry run", value: "dry-run" },
            { name: "Delete", value: "delete" },
            { name: "Enforce", value: "enforce" },
          ),
      ),
  )
  .addSubcommand((command) =>
    command
      .setName("thresholds")
      .setDescription("Set score thresholds")
      .addIntegerOption((option) =>
        option
          .setName("suspicious")
          .setDescription("Suspicious score")
          .setMinValue(1)
          .setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("delete")
          .setDescription("Delete score")
          .setMinValue(1)
          .setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("timeout")
          .setDescription("Timeout score")
          .setMinValue(1)
          .setRequired(true),
      ),
  )
  .addSubcommand((command) =>
    command
      .setName("timeout")
      .setDescription("Set timeout duration")
      .addIntegerOption((option) =>
        option
          .setName("minutes")
          .setDescription("Minutes")
          .setMinValue(1)
          .setRequired(true),
      ),
  )
  .addSubcommand((command) =>
    command
      .setName("retention")
      .setDescription("Set Incident retention")
      .addIntegerOption((option) =>
        option
          .setName("days")
          .setDescription("Days")
          .setMinValue(1)
          .setRequired(true),
      ),
  )
  .addSubcommand((command) =>
    command
      .setName("log-channel")
      .setDescription("Set moderation log channel")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel")
          .setRequired(true)
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
          ),
      ),
  )
  .addSubcommand((command) =>
    command
      .setName("ignore-channel")
      .setDescription("Add or remove an ignored channel")
      .addStringOption((option) =>
        option
          .setName("action")
          .setDescription("Action")
          .setRequired(true)
          .addChoices(
            { name: "Add", value: "add" },
            { name: "Remove", value: "remove" },
          ),
      )
      .addChannelOption((option) =>
        option.setName("channel").setDescription("Channel").setRequired(true),
      ),
  )
  .addSubcommand((command) =>
    command
      .setName("trusted-role")
      .setDescription("Add or remove a trusted role")
      .addStringOption((option) =>
        option
          .setName("action")
          .setDescription("Action")
          .setRequired(true)
          .addChoices(
            { name: "Add", value: "add" },
            { name: "Remove", value: "remove" },
          ),
      )
      .addRoleOption((option) =>
        option.setName("role").setDescription("Role").setRequired(true),
      ),
  );
