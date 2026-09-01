import type { ModerationMode } from "../config";
import type { Intention } from "./scamguard";

export type MessageReference = { channelId: string; messageId: string };

export type ActionOutcome = {
  action: "timeout" | "delete" | "cleanup-delete";
  targetId: string;
  status: "intended" | "succeeded" | "failed";
  detail?: string;
};

export type EnforcementRequest = {
  guildId: string;
  userId: string;
  trigger: MessageReference;
  cleanup: MessageReference[];
  intention: Intention;
  moderationMode: ModerationMode;
  timeoutMinutes: number;
  isWebhook: boolean;
};

type Ports = {
  now?(): Date;
  timeoutMember(
    guildId: string,
    userId: string,
    minutes: number,
  ): Promise<void>;
  deleteMessage(message: MessageReference): Promise<void>;
};

export function createModerationEnforcer(ports: Ports) {
  const blockedUntil = new Map<string, number>();
  const deleted = new Set<string>();
  const locks = new Map<string, Promise<ActionOutcome[]>>();
  const userKey = (guildId: string, userId: string) => `${guildId}:${userId}`;
  const now = () => ports.now?.().getTime() ?? Date.now();

  const remove = async (
    guildId: string,
    message: MessageReference,
    action: "delete" | "cleanup-delete",
  ): Promise<ActionOutcome | undefined> => {
    const key = `${guildId}:${message.channelId}:${message.messageId}`;
    if (deleted.has(key)) return undefined;
    deleted.add(key);
    try {
      await ports.deleteMessage(message);
      return { action, targetId: message.messageId, status: "succeeded" };
    } catch (error) {
      return {
        action,
        targetId: message.messageId,
        status: "failed",
        detail: error instanceof Error ? error.message : "unknown error",
      };
    }
  };

  const enforce = async (
    request: EnforcementRequest,
  ): Promise<ActionOutcome[]> => {
    if (!(["delete", "timeout"] as Intention[]).includes(request.intention))
      return [];
    if (request.moderationMode === "dry-run") {
      return [
        ...(request.intention === "timeout" && !request.isWebhook
          ? [
              {
                action: "timeout" as const,
                targetId: request.userId,
                status: "intended" as const,
              },
            ]
          : []),
        {
          action: "delete",
          targetId: request.trigger.messageId,
          status: "intended",
        },
      ];
    }

    const identity = userKey(request.guildId, request.userId);
    let startsTimeout = false;
    if (
      request.moderationMode === "enforce" &&
      request.intention === "timeout" &&
      !request.isWebhook
    ) {
      startsTimeout = (blockedUntil.get(identity) ?? 0) <= now();
      if (startsTimeout)
        blockedUntil.set(identity, now() + request.timeoutMinutes * 60 * 1000);
    }
    const run = async (): Promise<ActionOutcome[]> => {
      const outcomes: ActionOutcome[] = [];
      if (
        request.moderationMode === "enforce" &&
        request.intention === "timeout" &&
        !request.isWebhook &&
        startsTimeout
      ) {
        try {
          await ports.timeoutMember(
            request.guildId,
            request.userId,
            request.timeoutMinutes,
          );
          outcomes.push({
            action: "timeout",
            targetId: request.userId,
            status: "succeeded",
          });
        } catch (error) {
          outcomes.push({
            action: "timeout",
            targetId: request.userId,
            status: "failed",
            detail: error instanceof Error ? error.message : "unknown error",
          });
        }
      }
      const trigger = await remove(request.guildId, request.trigger, "delete");
      if (trigger) outcomes.push(trigger);
      if (
        request.moderationMode === "enforce" &&
        request.intention === "timeout" &&
        !request.isWebhook
      ) {
        for (const message of request.cleanup) {
          const outcome = await remove(
            request.guildId,
            message,
            "cleanup-delete",
          );
          if (outcome) outcomes.push(outcome);
        }
      }
      return outcomes;
    };

    const pending = (locks.get(identity) ?? Promise.resolve([])).then(run);
    locks.set(identity, pending);
    void pending.finally(() => {
      if (locks.get(identity) === pending) locks.delete(identity);
    });
    return pending;
  };

  return {
    enforce,
    isBlocked: (guildId: string, userId: string) => {
      const identity = userKey(guildId, userId);
      if ((blockedUntil.get(identity) ?? 0) > now()) return true;
      blockedUntil.delete(identity);
      return false;
    },
    deleteBlockedMessage: (
      guildId: string,
      message: MessageReference,
      moderationMode: ModerationMode,
    ) =>
      moderationMode === "dry-run"
        ? Promise.resolve([])
        : remove(guildId, message, "delete").then((outcome) =>
            outcome ? [outcome] : [],
          ),
  };
}
