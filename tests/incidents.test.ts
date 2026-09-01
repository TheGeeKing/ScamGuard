import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStorage } from "../src/storage/database";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Incident storage", () => {
  test("persists an explainable Incident without message content or image bytes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scamguard-incidents-"));
    directories.push(directory);
    const storage = openStorage(join(directory, "scamguard.db"));
    try {
      await storage.incidents.save({
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "message-1",
        userId: "user-1",
        createdAt: new Date(0),
        imageEvidence: [{ sourceId: "attachment-1" }],
        signals: [{ key: "known-sha", group: "fingerprint", weight: 100 }],
        score: 100,
        intention: "timeout",
        moderationMode: "dry-run",
        intendedActions: ["timeout", "delete"],
      });

      expect(
        await storage.incidents.find("guild-1", "message-1"),
      ).toMatchObject({
        guildId: "guild-1",
        messageId: "message-1",
        score: 100,
        moderationMode: "dry-run",
      });
    } finally {
      storage.close();
    }
  });
});
