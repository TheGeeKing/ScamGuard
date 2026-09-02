import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PERCEPTUAL_VERSION } from "../src/perceptual/hash";
import { openStorage } from "../src/storage/database";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("perceptual fingerprint cache", () => {
  test("caches versioned hashes by source SHA and isolates guild scope", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scamguard-perceptual-"));
    directories.push(directory);
    const storage = openStorage(join(directory, "scamguard.db"));
    try {
      await storage.perceptualFingerprints.put({
        sourceSha256: "a".repeat(64),
        version: PERCEPTUAL_VERSION,
        classification: "known",
        guildId: null,
        pdq: "b".repeat(64),
        quality: 100,
        crops: ["c".repeat(64)],
      });

      expect(
        await storage.perceptualFingerprints.find(
          "a".repeat(64),
          PERCEPTUAL_VERSION,
          null,
        ),
      ).toEqual({
        sourceSha256: "a".repeat(64),
        version: PERCEPTUAL_VERSION,
        classification: "known",
        guildId: null,
        pdq: "b".repeat(64),
        quality: 100,
        crops: ["c".repeat(64)],
      });
      expect(
        await storage.perceptualFingerprints.find(
          "a".repeat(64),
          PERCEPTUAL_VERSION,
          "guild-1",
        ),
      ).toBeUndefined();
      expect(
        await storage.perceptualFingerprints.find(
          "a".repeat(64),
          "other-version",
          null,
        ),
      ).toBeUndefined();
    } finally {
      storage.close();
    }
  });
});
