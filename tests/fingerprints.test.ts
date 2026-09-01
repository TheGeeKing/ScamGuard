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

describe("fingerprint storage", () => {
  test("persists known fingerprints and lets local safe overrides win", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scamguard-fingerprints-"));
    directories.push(directory);
    const storage = openStorage(join(directory, "scamguard.db"));
    try {
      await storage.fingerprints.markKnown({
        guildId: "guild-1",
        sha256: "a".repeat(64),
        source: "moderator",
        createdBy: "moderator-1",
        createdAt: new Date(0),
      });
      expect(
        await storage.fingerprints.classify(
          "guild-1",
          "a".repeat(64),
          new Date(1),
        ),
      ).toBe("known");

      await storage.fingerprints.markSafe({
        guildId: "guild-1",
        sha256: "a".repeat(64),
        createdBy: "moderator-2",
        createdAt: new Date(2),
      });
      expect(
        await storage.fingerprints.classify(
          "guild-1",
          "a".repeat(64),
          new Date(3),
        ),
      ).toBe("safe");
    } finally {
      storage.close();
    }
  });

  test("expires hot fingerprints automatically", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scamguard-hot-"));
    directories.push(directory);
    const storage = openStorage(join(directory, "scamguard.db"));
    try {
      await storage.fingerprints.markHot({
        guildId: "guild-1",
        sha256: "b".repeat(64),
        expiresAt: new Date(1000),
      });
      expect(
        await storage.fingerprints.classify(
          "guild-1",
          "b".repeat(64),
          new Date(999),
        ),
      ).toBe("hot");
      expect(
        await storage.fingerprints.classify(
          "guild-1",
          "b".repeat(64),
          new Date(1000),
        ),
      ).toBe("unknown");
    } finally {
      storage.close();
    }
  });
});
