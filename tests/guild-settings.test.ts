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

describe("Drizzle guild settings", () => {
  test("uses environment defaults until a guild override is stored", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scamguard-settings-"));
    directories.push(directory);
    const storage = openStorage(join(directory, "scamguard.db"), {
      moderationMode: "dry-run",
      suspiciousScore: 45,
      deleteScore: 65,
      timeoutScore: 90,
      timeoutMinutes: 5,
      incidentRetentionDays: 14,
      moderationLogChannelId: null,
      ignoredChannelIds: [],
      trustedRoleIds: [],
    });

    try {
      expect((await storage.guildSettings.get("guild-1")).deleteScore).toBe(65);
      await storage.guildSettings.update("guild-1", {
        moderationMode: "delete",
        moderationLogChannelId: "logs",
      });
      expect(await storage.guildSettings.get("guild-1")).toMatchObject({
        moderationMode: "delete",
        deleteScore: 65,
        moderationLogChannelId: "logs",
      });

      expect(await storage.guildSettings.isOnboardingComplete("guild-1")).toBe(
        false,
      );
      await storage.guildSettings.completeOnboarding("guild-1", new Date(0));
      expect(await storage.guildSettings.isOnboardingComplete("guild-1")).toBe(
        true,
      );
    } finally {
      storage.close();
    }
  });
});
