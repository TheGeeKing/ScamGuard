import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  Client,
  ContainerBuilder,
  GatewayIntentBits,
  type Message,
  type MessageCreateOptions,
  MessageFlags,
  PermissionFlagsBits,
  TextDisplayBuilder,
} from "discord.js";
import type { MessageReference } from "../domain/enforcement";
import type { IncidentRecord, ScamGuardEvent } from "../domain/scamguard";
import {
  type ImageSource,
  selectDiscordImageSources,
} from "../images/discord-images";
import type { StoredGuildSettings } from "../storage/guild-settings";
import type { IncidentRepository } from "../storage/incidents";
import { type AdminCommand, handleAdminCommand } from "./admin-commands";
import { applicationCommands } from "./discord-commands";

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

function messageImageSources(message: Message): ImageSource[] {
  return selectDiscordImageSources({
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      contentType: attachment.contentType,
    })),
    embeds: message.embeds.map((embed) => ({
      image: embed.image
        ? { url: embed.image.url, proxyUrl: embed.image.proxyURL }
        : null,
      thumbnail: embed.thumbnail
        ? { url: embed.thumbnail.url, proxyUrl: embed.thumbnail.proxyURL }
        : null,
      authorIconUrl: embed.author?.iconURL,
      footerIconUrl: embed.footer?.iconURL,
    })),
  });
}

type OnboardingPort = {
  isComplete(): Promise<boolean>;
  sendPublicUpdatesChannel(): Promise<boolean>;
  sendOwnerDm(): Promise<boolean>;
  markComplete(): Promise<void>;
};

export const moderationLogChannelNotice =
  "This channel is now the ScamGuard moderation log.";

function displaySignalKey(key: string): string {
  return key.replace(/^(known|hot)-sha:([a-f\d]{7})[a-f\d]+$/i, "$1-sha:$2…");
}

function incidentButtons(messageId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`scamguard:incident:false-positive:${messageId}`)
      .setLabel("False positive")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`scamguard:incident:safe:${messageId}`)
      .setLabel("Mark images safe")
      .setStyle(ButtonStyle.Success),
  );
}

type IncidentNotification = Pick<
  IncidentRecord,
  | "guildId"
  | "channelId"
  | "messageId"
  | "score"
  | "intention"
  | "signals"
  | "intendedActions"
  | "actionOutcomes"
  | "latencyMs"
  | "userId"
>;

type IncidentAlert = IncidentNotification & {
  messages: { channelId: string | null; messageId: string }[];
};

export function mergeIncidentNotifications(
  current: IncidentAlert | undefined,
  next: IncidentNotification,
): IncidentAlert {
  const messages = [
    ...(current?.messages ?? []),
    { channelId: next.channelId, messageId: next.messageId },
  ].filter(
    (message, index, all) =>
      all.findIndex(
        (candidate) => candidate.messageId === message.messageId,
      ) === index,
  );
  if (!current) return { ...next, messages };
  const signals = [...current.signals, ...next.signals].filter(
    (signal, index, all) =>
      all.findIndex((candidate) => candidate.key === signal.key) === index,
  );
  const rank = { allow: 0, suspicious: 1, delete: 2, timeout: 3 } as const;
  return {
    ...current,
    score: Math.max(current.score, next.score),
    intention:
      rank[next.intention] > rank[current.intention]
        ? next.intention
        : current.intention,
    signals,
    intendedActions: [
      ...new Set([...current.intendedActions, ...next.intendedActions]),
    ],
    actionOutcomes: [...current.actionOutcomes, ...next.actionOutcomes],
    latencyMs: Math.max(current.latencyMs, next.latencyMs),
    messages,
  };
}

export function incidentNotification(
  incident: IncidentNotification | IncidentAlert,
): MessageCreateOptions & { components: ContainerBuilder[] } {
  const messages =
    "messages" in incident
      ? incident.messages
      : [{ channelId: incident.channelId, messageId: incident.messageId }];
  const signals = incident.signals
    .map((signal) => `${displaySignalKey(signal.key)} (${signal.weight})`)
    .join(", ");
  const outcomes = incident.actionOutcomes
    .map((outcome) => `${outcome.action} ${outcome.status}`)
    .join(", ");
  const removed = incident.actionOutcomes.filter(
    (outcome) =>
      outcome.status === "succeeded" && outcome.action.includes("delete"),
  ).length;
  const visibleMessages = messages
    .slice(0, 20)
    .map(({ channelId, messageId }) =>
      channelId
        ? `- https://discord.com/channels/${incident.guildId}/${channelId}/${messageId}`
        : `- Message ${messageId} (source unavailable)`,
    );
  if (messages.length > visibleMessages.length)
    visibleMessages.push(`- ${messages.length - visibleMessages.length} more`);
  return {
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [incident.userId] },
    components: [
      new ContainerBuilder()
        .setAccentColor(incident.intention === "timeout" ? 0xed4245 : 0xfee75c)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "# ScamGuard Incident",
              `Flagged user: <@${incident.userId}>`,
              `### Score: ${incident.score} · ${incident.intention}`,
              `**Affected messages**\n${visibleMessages.join("\n")}`,
              `**Signals**\n${signals || "None"}`,
              `**Desired actions**\n${incident.intendedActions.join(", ") || "None"}`,
              `**Outcomes**\n${outcomes || "None"}`,
              `**Removed:** ${removed} · **Latency:** ${incident.latencyMs}ms`,
              `-# Incident ID · ${incident.messageId}`,
            ].join("\n"),
          ),
        )
        .addActionRowComponents(incidentButtons(incident.messageId)),
    ],
  };
}

export function parseIncidentButton(customId: string): {
  action: "false-positive" | "safe";
  messageId: string;
} | null {
  const match = /^scamguard:incident:(false-positive|safe):(\d+)$/.exec(
    customId,
  );
  return match
    ? {
        action: match[1] as "false-positive" | "safe",
        messageId: match[2] as string,
      }
    : null;
}

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
  "already-complete" | "public-updates" | "owner-dm" | "command-only"
> {
  if (await port.isComplete()) return "already-complete";
  let destination: "public-updates" | "owner-dm" | "command-only" =
    "command-only";
  if (await port.sendPublicUpdatesChannel()) destination = "public-updates";
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
    case "false-positive":
      return {
        kind: "false-positive",
        incidentId: interaction.options.getString("incident-id", true),
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
  timeoutMember(
    guildId: string,
    userId: string,
    minutes: number,
  ): Promise<void>;
  removeTimeout(guildId: string, userId: string): Promise<void>;
  deleteMessage(message: MessageReference): Promise<void>;
  close(): void;
};

export function createDiscordBot(options: {
  token: string;
  guildId: string;
  settings: StoredGuildSettings;
  incidents: Pick<IncidentRepository, "markFalsePositive">;
  databaseAvailable(): boolean;
  onEligibleMessage?(
    event: Extract<ScamGuardEvent, { kind: "message" }>,
  ): Promise<void> | void;
  onSettingsChanged?(): Promise<void> | void;
  onFingerprintReview?(review: {
    action: "scam" | "safe";
    guildId: string;
    moderatorId: string;
    messageId: string;
    imageSources: ImageSource[];
  }): Promise<string>;
  onIncidentReview?(review: {
    action: "false-positive" | "safe";
    guildId: string;
    messageId: string;
    moderatorId: string;
  }): Promise<string>;
}): DiscordBot {
  const client = new Client({ intents: discordGatewayIntents });
  const incidentAlerts = new Map<
    string,
    { incident: IncidentAlert; message: Message; updatedAt: number }
  >();
  const incidentAlertLocks = new Map<string, Promise<void>>();

  client.once("clientReady", async () => {
    const guild = await client.guilds.fetch(options.guildId);
    await guild.commands.set(
      applicationCommands.map((command) => command.toJSON()),
    );
    const instructions =
      "ScamGuard is installed. Run `/scam status`, then configure a moderation log channel and choose a mode.";
    await runOnboarding({
      isComplete: () => options.settings.isOnboardingComplete(guild.id),
      sendPublicUpdatesChannel: async () => {
        const channel = guild.publicUpdatesChannel;
        if (!channel?.isSendable()) return false;
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
    if (interaction.isButton()) {
      const review = parseIncidentButton(interaction.customId);
      if (!review) return;
      if (
        interaction.guildId !== options.guildId ||
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        await interaction.reply({
          content: "Manage Server permission is required.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const content = await options.onIncidentReview?.({
        ...review,
        guildId: interaction.guildId,
        moderatorId: interaction.user.id,
      });
      await interaction.editReply(content ?? "Incident review is unavailable.");
      return;
    }
    if (interaction.isMessageContextMenuCommand()) {
      if (
        interaction.guildId !== options.guildId ||
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        await interaction.reply({
          content: "Manage Server permission is required.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const action =
        interaction.commandName === "Mark as scam"
          ? "scam"
          : interaction.commandName === "Mark as safe"
            ? "safe"
            : null;
      if (!action) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const content = await options.onFingerprintReview?.({
        action,
        guildId: interaction.guildId,
        moderatorId: interaction.user.id,
        messageId: interaction.targetMessage.id,
        imageSources: messageImageSources(interaction.targetMessage),
      });
      await interaction.editReply(
        content ?? "Fingerprint review is unavailable.",
      );
      return;
    }
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
    let reply = await handleAdminCommand(
      command,
      {
        guildId: interaction.guildId,
        canManageGuild:
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
          false,
        discordConnected: client.isReady(),
        databaseAvailable: options.databaseAvailable(),
        reviewerId: interaction.user.id,
      },
      options.settings,
      options.incidents,
    );
    if (
      command.kind === "false-positive" &&
      reply.flags === undefined &&
      options.onIncidentReview
    ) {
      reply = {
        content: await options.onIncidentReview({
          action: "false-positive",
          guildId: interaction.guildId,
          messageId: command.incidentId,
          moderatorId: interaction.user.id,
        }),
      };
    }
    if (command.kind !== "status" && command.kind !== "false-positive")
      await options.onSettingsChanged?.();
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
      const imageSources = messageImageSources(message);
      await options.onEligibleMessage?.({
        kind: "message",
        guildId: message.guildId as string,
        messageId: message.id,
        userId: message.author.id,
        channelId: message.channelId,
        imageCount: imageSources.length,
        imageSources,
        imageDigests: [],
        accountCreatedAt: message.author.createdAt,
        guildJoinedAt: message.member?.joinedAt ?? null,
        isWebhook: message.webhookId !== null,
        imageEvidence: [],
        signals: [],
      });
    }
  });

  return {
    start: () => client.login(options.token).then(() => undefined),
    isConnected: () => client.isReady(),
    notify: async (incident) => {
      const key = `${incident.guildId}:${incident.userId}`;
      const pending = (incidentAlertLocks.get(key) ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          const settings = await options.settings.get(incident.guildId);
          if (!settings.moderationLogChannelId) return;
          const channel = await client.channels.fetch(
            settings.moderationLogChannelId,
          );
          if (!channel?.isSendable()) return;
          const existing = incidentAlerts.get(key);
          const current =
            existing && Date.now() - existing.updatedAt < 5 * 60 * 1000
              ? existing
              : undefined;
          const merged = mergeIncidentNotifications(
            current?.incident,
            incident,
          );
          const notification = incidentNotification(merged);
          const message = current
            ? await current.message.edit({
                components: notification.components,
              })
            : await channel.send(notification);
          incidentAlerts.set(key, {
            incident: merged,
            message,
            updatedAt: Date.now(),
          });
        });
      incidentAlertLocks.set(key, pending);
      try {
        await pending;
      } finally {
        if (incidentAlertLocks.get(key) === pending)
          incidentAlertLocks.delete(key);
      }
    },
    timeoutMember: async (guildId, userId, minutes) => {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      await member.timeout(minutes * 60 * 1000, "ScamGuard enforcement");
    },
    removeTimeout: async (guildId, userId) => {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      await member.timeout(null, "ScamGuard false-positive correction");
    },
    deleteMessage: async ({ channelId, messageId }) => {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased() || !("messages" in channel))
        throw new Error("message channel is unavailable");
      const message = await channel.messages.fetch(messageId);
      await message.delete();
    },
    close: () => client.destroy(),
  };
}
