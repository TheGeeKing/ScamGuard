import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStorage } from "../src/storage/database";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

test("persists review history and finds the latest unreversed decision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "scamguard-reviews-"));
  directories.push(directory);
  const storage = openStorage(join(directory, "scamguard.db"));
  try {
    const first = {
      id: "review-1",
      guildId: "guild-1",
      incidentMessageId: "message-1",
      action: "false-positive" as const,
      moderatorId: "moderator-1",
      createdAt: new Date(1),
      reversesReviewId: null,
      effects: { previousFalsePositive: false },
    };
    await storage.moderatorReviews.save(first);
    expect(await storage.moderatorReviews.find(first.id)).toEqual(first);
    expect(
      await storage.moderatorReviews.findLatestUnreversed("guild-1", "message-1"),
    ).toEqual(first);

    await storage.moderatorReviews.save({
      id: "reversal-1",
      guildId: "guild-1",
      incidentMessageId: "message-1",
      action: "reversal",
      moderatorId: "moderator-2",
      createdAt: new Date(2),
      reversesReviewId: first.id,
      effects: {},
    });
    expect(
      await storage.moderatorReviews.findLatestUnreversed("guild-1", "message-1"),
    ).toBeUndefined();
  } finally {
    storage.close();
  }
});
