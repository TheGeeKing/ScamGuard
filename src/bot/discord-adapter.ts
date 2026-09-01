import {
  ChannelType,
  type ChatInputCommandInteraction,
  Client,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import type { IncidentRecord, ScamGuardEvent } from "../domain/scamguard";
import type { StoredGuildSettings } from "../storage/guild-settings";
import { type AdminCommand, handleAdminCommand } from "./admin-commands";
import { scamCommand } from "./discord-commands";

export const discordGatewayIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
];

export type MessageScope = {
  guildId: string;
  botUserId: string;
  ignoredChannelIds: string[];
  trustedRoleIds: string[];
};

export type MessageIdentity = {
  guildId: string | null;
  channelId: string;
  authorId: string;
  authorIsBot: boolean;
  memberRoleIds: string[];
};

export function shouldAssessMessage(
  message: MessageIdentity,
  scope: MessageScope,
): boolean {
  return (
    message.guildId === scope.guildId &&
    !message.authorIsBot &&
    message.authorId !== scope.botUserId &&
    !scope.ignoredChannelIds.includes(message.channelId) &&
    !message.memberRoleIds.some((role) => scope.trustedRoleIds.includes(role))
  );
}

type OnboardingPort = {
  isComplete(): Promise<boolean>;
  sendSystemChannel(): Promise<boolean>;
  sendOwnerDm(): Promise<boolean>;
  markComplete(): Promise<void>;
};

export const moderationLogChannelNotice =
  "This channel is now the ScamGuard moderation log.";

export async function announceModerationLogChannel(port: {
  shouldAnnounce: boolean;
  send(): Promise<boolean>;
}): Promise<boolean> {
  if (!port.shouldAnnounce) return false;
  try {
    return await port.send();
  } catch {
    return false;
  }
}

export async function runOnboarding(
  port: OnboardingPort,
): Promise<
  "already-complete" | "system-channel" | "owner-dm" | "command-only"
> {
  if (await port.isComplete()) return "already-complete";
  let destination: "system-channel" | "owner-dm" | "command-only" =
    "command-only";
  if (await port.sendSystemChannel()) destination = "system-channel";
  else if (await port.sendOwnerDm()) destination = "owner-dm";
  await port.markComplete();
  return destination;
}

function parseAdminCommand(
  interaction: ChatInputCommandInteraction,
): AdminCommand {
  const name = interaction.options.getSubcommand();
  switch (name) {
    case "status":
      return { kind: "status" };
    case "mode":
      return {
        kind: "mode",
        mode: interaction.options.getString("value", true) as
          | "dry-run"
          | "delete"
          | "enforce",
      };
    case "thresholds":
      return {
        kind: "thresholds",
        suspicious: interaction.options.getInteger("suspicious", true),
        delete: interaction.options.getInteger("delete", true),
        timeout: interaction.options.getInteger("timeout", true),
      };
    case "timeout":
      return {
        kind: "timeout",
        minutes: interaction.options.getInteger("minutes", true),
      };
    case "retention":
      return {
        kind: "retention",
        days: interaction.options.getInteger("days", true),
      };
    case "log-channel":
      return {
        kind: "log-channel",
        channelId: interaction.options.getChannel("channel", true).id,
      };
    case "ignore-channel":
      return {
        kind: "ignore-channel",
        action: interaction.options.getString("action", true) as
          | "add"
          | "remove",
        channelId: interaction.options.getChannel("channel", true).id,
      };
    case "trusted-role":
      return {
        kind: "trusted-role",
        action: interaction.options.getString("action", true) as
          | "add"
          | "remove",
        roleId: interaction.options.getRole("role", true).id,
      };
    default:
      throw new Error(`Unsupported subcommand: ${name}`);
  }
}

export type DiscordBot = {
  start(): Promise<void>;
  isConnected(): boolean;
  notify(incident: IncidentRecord): Promise<void>;
  close(): void;
};

export function createDiscordBot(options: {
  token: string;
  guildId: string;
  settings: StoredGuildSettings;
  databaseAvailable(): boolean;
  onEligibleMessage?(
    event: Extract<ScamGuardEvent, { kind: "message" }>,
  ): Promise<void> | void;
  onSettingsChanged?(): Promise<void> | void;
}): DiscordBot {
  const client = new Client({ intents: discordGatewayIntents });

  client.once("clientReady", async () => {
    const guild = await client.guilds.fetch(options.guildId);
    await guild.commands.set([scamCommand.toJSON()]);
    const instructions =
      "ScamGuard is installed. Run `/scam status`, then configure a moderation log channel and choose a mode.";
    await runOnboarding({
      isComplete: () => options.settings.isOnboardingComplete(guild.id),
      sendSystemChannel: async () => {
        const channel = guild.systemChannel;
        if (!channel || channel.type !== ChannelType.GuildText) return false;
        try {
          await channel.send(instructions);
          return true;
        } catch {
          return false;
        }
      },
      sendOwnerDm: async () => {
        try {
          const owner = await guild.fetchOwner();
          await owner.send(instructions);
          return true;
        } catch {
          return false;
        }
      },
      markComplete: () =>
        options.settings.completeOnboarding(guild.id, new Date()),
    });
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "scam")
      return;
    if (interaction.guildId !== options.guildId) {
      await interaction.reply({
        content: "This command is not available here.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const command = parseAdminCommand(interaction);
    const reply = await handleAdminCommand(
      command,
      {
        guildId: interaction.guildId,
        canManageGuild:
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
          false,
        discordConnected: client.isReady(),
        databaseAvailable: options.databaseAvailable(),
      },
      options.settings,
    );
    if (command.kind !== "status") await options.onSettingsChanged?.();
    await interaction.reply(reply);
    if (command.kind === "log-channel") {
      await announceModerationLogChannel({
        shouldAnnounce:
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
          false,
        send: async () => {
          const channel = await client.channels.fetch(command.channelId);
          if (!channel?.isSendable()) return false;
          await channel.send(moderationLogChannelNotice);
          return true;
        },
      });
    }
  });

  client.on("messageCreate", async (message) => {
    const settings = await options.settings.get(options.guildId);
    if (
      shouldAssessMessage(
        {
          guildId: message.guildId,
          channelId: message.channelId,
          authorId: message.author.id,
          authorIsBot: message.author.bot && message.webhookId === null,
          memberRoleIds: message.member
            ? [...message.member.roles.cache.keys()]
            : [],
        },
        {
          guildId: options.guildId,
          botUserId: client.user?.id ?? "",
          ignoredChannelIds: settings.ignoredChannelIds,
          trustedRoleIds: settings.trustedRoleIds,
        },
      )
    ) {
      await options.onEligibleMessage?.({
        kind: "message",
        guildId: message.guildId as string,
        messageId: message.id,
        userId: message.author.id,
        channelId: message.channelId,
        imageCount:
          message.attachments.filter((attachment) =>
            attachment.contentType?.startsWith("image/"),
          ).size +
          message.embeds.filter((embed) => embed.image || embed.thumbnail)
            .length,
        imageDigests: [],
        accountCreatedAt: message.author.createdAt,
        guildJoinedAt: message.member?.joinedAt ?? null,
        imageEvidence: [],
        signals: [],
      });
    }
  });

  return {
    start: () => client.login(options.token).then(() => undefined),
    isConnected: () => client.isReady(),
    notify: async (incident) => {
      const settings = await options.settings.get(incident.guildId);
      if (!settings.moderationLogChannelId) return;
      const channel = await client.channels.fetch(
        settings.moderationLogChannelId,
      );
      if (channel?.isSendable()) {
        await channel.send(
          `ScamGuard Incident: message ${incident.messageId}, score ${incident.score}, intention ${incident.intention}.`,
        );
      }
    },
    close: () => client.destroy(),
  };
}
