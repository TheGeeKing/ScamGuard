import type { ModerationMode } from "../config";

export type GuildSettingValues = {
  moderationMode?: ModerationMode;
  suspiciousScore?: number;
  deleteScore?: number;
  timeoutScore?: number;
  timeoutMinutes?: number;
  incidentRetentionDays?: number;
  moderationLogChannelId?: string;
  ignoredChannelIds?: string[];
  trustedRoleIds?: string[];
};

export type EffectiveGuildSettings = Required<
  Omit<GuildSettingValues, "moderationLogChannelId">
> & { moderationLogChannelId: string | null };

export type GuildSettingsRepository = {
  get(guildId: string): Promise<EffectiveGuildSettings>;
  update(guildId: string, values: GuildSettingValues): Promise<void>;
};

export type AdminCommand =
  | { kind: "status" }
  | { kind: "mode"; mode: ModerationMode }
  | { kind: "thresholds"; suspicious: number; delete: number; timeout: number }
  | { kind: "timeout"; minutes: number }
  | { kind: "retention"; days: number }
  | { kind: "log-channel"; channelId: string }
  | { kind: "ignore-channel"; action: "add" | "remove"; channelId: string }
  | { kind: "trusted-role"; action: "add" | "remove"; roleId: string };

export type AdminCommandContext = {
  guildId: string;
  canManageGuild: boolean;
  discordConnected?: boolean;
  databaseAvailable?: boolean;
};

export type AdminCommandReply = {
  ephemeral: true;
  content: string;
};

export async function handleAdminCommand(
  command: AdminCommand,
  context: AdminCommandContext,
  settings: GuildSettingsRepository,
): Promise<AdminCommandReply> {
  if (!context.canManageGuild) {
    return {
      ephemeral: true,
      content: "Manage Server permission is required.",
    };
  }

  switch (command.kind) {
    case "status": {
      const current = await settings.get(context.guildId);
      return {
        ephemeral: true,
        content: `Discord: ${context.discordConnected === false ? "not connected" : "connected"}\nDatabase: ${context.databaseAvailable === false ? "unavailable" : "available"}\nMode: ${current.moderationMode}\nModeration log: ${current.moderationLogChannelId ?? "not configured"}`,
      };
    }
    case "mode":
      await settings.update(context.guildId, { moderationMode: command.mode });
      return {
        ephemeral: true,
        content: `Moderation mode set to ${command.mode}.`,
      };
    case "thresholds":
      if (
        command.suspicious > command.delete ||
        command.delete > command.timeout
      ) {
        return {
          ephemeral: true,
          content: "Thresholds must satisfy suspicious <= delete <= timeout.",
        };
      }
      await settings.update(context.guildId, {
        suspiciousScore: command.suspicious,
        deleteScore: command.delete,
        timeoutScore: command.timeout,
      });
      return { ephemeral: true, content: "Score thresholds updated." };
    case "timeout":
      await settings.update(context.guildId, {
        timeoutMinutes: command.minutes,
      });
      return {
        ephemeral: true,
        content: `Timeout set to ${command.minutes} minutes.`,
      };
    case "retention":
      await settings.update(context.guildId, {
        incidentRetentionDays: command.days,
      });
      return {
        ephemeral: true,
        content: `Incident retention set to ${command.days} days.`,
      };
    case "log-channel":
      await settings.update(context.guildId, {
        moderationLogChannelId: command.channelId,
      });
      return { ephemeral: true, content: "Moderation log channel updated." };
    case "ignore-channel": {
      const current = await settings.get(context.guildId);
      const ignored = new Set(current.ignoredChannelIds);
      if (command.action === "add") ignored.add(command.channelId);
      else ignored.delete(command.channelId);
      await settings.update(context.guildId, {
        ignoredChannelIds: [...ignored],
      });
      return { ephemeral: true, content: "Ignored channels updated." };
    }
    case "trusted-role": {
      const current = await settings.get(context.guildId);
      const trusted = new Set(current.trustedRoleIds);
      if (command.action === "add") trusted.add(command.roleId);
      else trusted.delete(command.roleId);
      await settings.update(context.guildId, { trustedRoleIds: [...trusted] });
      return { ephemeral: true, content: "Trusted roles updated." };
    }
  }
}
