import { afterEach, describe, expect, test } from "bun:test";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEvidence } from "../src/fingerprints/evidence-loader";
import { PERCEPTUAL_VERSION } from "../src/perceptual/hash";
import type {
  PerceptualFingerprintRepository,
  StoredPerceptualFingerprint,
} from "../src/storage/perceptual-fingerprints";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("curated Evidence loading", () => {
  test("hashes raw images from the evidence root at boot", async () => {
    const root = await mkdtemp(join(tmpdir(), "scamguard-evidence-"));
    directories.push(root);
    await writeFile(join(root, "b.jpg"), "curated-b");
    await writeFile(join(root, "a.jpg"), "curated-a");
    await writeFile(join(root, "README.md"), "not an image");

    const evidence = await loadEvidence(root);
    expect(evidence.map((entry) => entry.file)).toEqual(["a.jpg", "b.jpg"]);
    expect(evidence.every((entry) => entry.sha256.length === 64)).toBe(true);
  });

  test("caches versioned perceptual hashes for valid Evidence images", async () => {
    const root = await mkdtemp(join(tmpdir(), "scamguard-evidence-"));
    directories.push(root);
    await copyFile(
      join(import.meta.dir, "..", "evidence", "image-7.jpg"),
      join(root, "image.jpg"),
    );
    const values = new Map<string, StoredPerceptualFingerprint>();
    let writes = 0;
    const cache = {
      find: async (sha256: string, version: string, guildId: string | null) =>
        values.get(`${guildId}:${sha256}:${version}`),
      put: async (value: StoredPerceptualFingerprint) => {
        writes += 1;
        values.set(
          `${value.guildId}:${value.sourceSha256}:${value.version}`,
          value,
        );
      },
    } satisfies PerceptualFingerprintRepository;

    const first = await loadEvidence(root, cache);
    const second = await loadEvidence(root, cache);

    expect(first[0]?.perceptual?.version).toBe(PERCEPTUAL_VERSION);
    expect(first[0]?.perceptual?.crops).toHaveLength(28);
    expect(second).toEqual(first);
    expect(writes).toBe(1);
  });
});
