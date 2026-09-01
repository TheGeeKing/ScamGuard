import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEvidence } from "../src/fingerprints/evidence-loader";

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
});
