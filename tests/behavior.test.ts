import { describe, expect, test } from "bun:test";
import { createBehaviorTracker } from "../src/domain/behavior";

describe("rolling behavior", () => {
  test("keeps ordinary same-channel image traffic below timeout", () => {
    let now = new Date("2026-09-01T00:00:00Z");
    const tracker = createBehaviorTracker(() => now);
    const scores: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      now = new Date(now.getTime() + 1000);
      const signals = tracker.observe({
        guildId: "guild-1",
        userId: "user-1",
        messageId: `message-${index}`,
        channelId: "photos",
        imageCount: 1,
        imageDigests: [`different-${index}`],
        accountCreatedAt: new Date("2020-01-01T00:00:00Z"),
        guildJoinedAt: new Date("2025-01-01T00:00:00Z"),
      });
      scores.push(signals.reduce((sum, signal) => sum + signal.weight, 0));
    }
    expect(scores.at(-1)).toBe(40);
  });

  test("escalates an exact-image cross-channel flood with exclusive buckets", () => {
    let now = new Date("2026-09-01T00:00:00Z");
    const tracker = createBehaviorTracker(() => now);
    let signals = [] as ReturnType<typeof tracker.observe>;
    for (let index = 0; index < 5; index += 1) {
      now = new Date(now.getTime() + 1000);
      signals = tracker.observe({
        guildId: "guild-1",
        userId: "user-1",
        messageId: `message-${index}`,
        channelId: `channel-${index}`,
        imageCount: 1,
        imageDigests: ["same-sha"],
        accountCreatedAt: new Date("2020-01-01T00:00:00Z"),
        guildJoinedAt: new Date("2025-01-01T00:00:00Z"),
      });
    }

    expect(signals.map((signal) => [signal.key, signal.weight])).toEqual([
      ["message-burst-5s", 15],
      ["image-burst-10s", 25],
      ["channel-spread-5", 50],
      ["exact-repeat-3-channels", 80],
    ]);
    expect(signals.reduce((sum, signal) => sum + signal.weight, 0)).toBe(170);
  });

  test("keeps age evidence weak and retains cleanup message IDs for five minutes", () => {
    let now = new Date("2026-09-01T00:00:00Z");
    const tracker = createBehaviorTracker(() => now);
    const signals = tracker.observe({
      guildId: "guild-1",
      userId: "user-1",
      messageId: "message-1",
      channelId: "general",
      imageCount: 0,
      imageDigests: [],
      accountCreatedAt: new Date(now.getTime() - 60 * 60 * 1000),
      guildJoinedAt: new Date(now.getTime() - 60 * 1000),
    });
    expect(signals.reduce((sum, signal) => sum + signal.weight, 0)).toBe(18);
    expect(tracker.cleanupMessageIds("guild-1", "user-1")).toEqual([
      "message-1",
    ]);
    now = new Date(now.getTime() + 5 * 60 * 1000);
    expect(tracker.cleanupMessageIds("guild-1", "user-1")).toEqual([]);
  });
});
