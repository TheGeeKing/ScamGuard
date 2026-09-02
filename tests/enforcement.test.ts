import { describe, expect, test } from "bun:test";
import { createModerationEnforcer } from "../src/domain/enforcement";

const request = {
  guildId: "guild-1",
  userId: "user-1",
  trigger: { channelId: "channel-1", messageId: "message-3" },
  cleanup: [
    { channelId: "channel-1", messageId: "message-1" },
    { channelId: "channel-2", messageId: "message-2" },
    { channelId: "channel-1", messageId: "message-3" },
  ],
  intention: "timeout" as const,
  moderationMode: "enforce" as const,
  timeoutMinutes: 10,
  isWebhook: false,
};

describe("moderation enforcement", () => {
  test("orders timeout, trigger deletion, and cleanup despite timeout failure", async () => {
    const calls: string[] = [];
    const enforcer = createModerationEnforcer({
      timeoutMember: async () => {
        calls.push("timeout");
        throw new Error("missing permission");
      },
      deleteMessage: async ({ messageId }) => {
        calls.push(`delete:${messageId}`);
      },
    });

    const outcomes = await enforcer.enforce(request);

    expect(calls).toEqual([
      "timeout",
      "delete:message-3",
      "delete:message-1",
      "delete:message-2",
    ]);
    expect(outcomes.map(({ action, status }) => [action, status])).toEqual([
      ["timeout", "failed"],
      ["delete", "succeeded"],
      ["cleanup-delete", "succeeded"],
      ["cleanup-delete", "succeeded"],
    ]);
    expect(enforcer.isBlocked("guild-1", "user-1")).toBe(true);
  });

  test("serializes concurrent enforcement and performs each action once", async () => {
    const calls: string[] = [];
    const enforcer = createModerationEnforcer({
      timeoutMember: async () => {
        calls.push("timeout");
      },
      deleteMessage: async ({ messageId }) => {
        calls.push(messageId);
      },
    });

    await Promise.all(
      Array.from({ length: 10 }, () => enforcer.enforce(request)),
    );

    expect(calls).toEqual(["timeout", "message-3", "message-1", "message-2"]);
  });

  test("expires local blocked state with the configured timeout", async () => {
    let now = new Date(0);
    const enforcer = createModerationEnforcer({
      now: () => now,
      timeoutMember: async () => {},
      deleteMessage: async () => {},
    });

    await enforcer.enforce(request);
    expect(enforcer.isBlocked("guild-1", "user-1")).toBe(true);
    now = new Date(10 * 60 * 1000);
    expect(enforcer.isBlocked("guild-1", "user-1")).toBe(false);
  });

  test("clears local blocked state when a timeout is reversed", async () => {
    const enforcer = createModerationEnforcer({
      timeoutMember: async () => {},
      deleteMessage: async () => {},
    });
    await enforcer.enforce({
      ...request,
      moderationMode: "enforce",
    });
    expect(enforcer.isBlocked("guild-1", "user-1")).toBe(true);
    enforcer.clearBlocked("guild-1", "user-1");
    expect(enforcer.isBlocked("guild-1", "user-1")).toBe(false);
  });

  test("keeps dry-run inert and webhooks deletion-only", async () => {
    const calls: string[] = [];
    const enforcer = createModerationEnforcer({
      timeoutMember: async () => {
        calls.push("timeout");
      },
      deleteMessage: async ({ messageId }) => {
        calls.push(messageId);
      },
    });

    expect(
      await enforcer.enforce({ ...request, moderationMode: "dry-run" }),
    ).toEqual([
      { action: "timeout", targetId: "user-1", status: "intended" },
      { action: "delete", targetId: "message-3", status: "intended" },
    ]);
    await enforcer.enforce({
      ...request,
      userId: "webhook-1",
      trigger: { channelId: "channel-1", messageId: "webhook-message" },
      cleanup: [],
      isWebhook: true,
    });

    expect(calls).toEqual(["webhook-message"]);
    expect(enforcer.isBlocked("guild-1", "webhook-1")).toBe(false);
  });
});
