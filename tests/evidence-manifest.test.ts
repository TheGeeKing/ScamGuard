import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEvidenceManifest } from "../scripts/generate-evidence-manifest";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("reviewed Evidence manifest", () => {
  test("hashes approved samples deterministically and ignores pending files", async () => {
    const root = await mkdtemp(join(tmpdir(), "scamguard-evidence-"));
    directories.push(root);
    await mkdir(join(root, "approved"));
    await mkdir(join(root, "pending"));
    await writeFile(join(root, "approved", "b.jpg"), "approved-b");
    await writeFile(join(root, "approved", "a.jpg"), "approved-a");
    await writeFile(join(root, "approved", ".gitkeep"), "");
    await writeFile(join(root, "pending", "ignored.jpg"), "pending");

    const manifest = await buildEvidenceManifest(join(root, "approved"));
    expect(manifest.version).toBe(1);
    expect(manifest.algorithm).toBe("sha256");
    expect(manifest.fingerprints.map((entry) => entry.file)).toEqual([
      "a.jpg",
      "b.jpg",
    ]);
    expect(
      manifest.fingerprints.every((entry) => entry.sha256.length === 64),
    ).toBe(true);
  });
});
