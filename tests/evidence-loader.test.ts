import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadApprovedEvidence } from "../src/fingerprints/evidence-loader";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("approved Evidence loading", () => {
  test("hashes raw approved images at boot and ignores pending files", async () => {
    const root = await mkdtemp(join(tmpdir(), "scamguard-evidence-"));
    directories.push(root);
    await mkdir(join(root, "approved"));
    await mkdir(join(root, "pending"));
    await writeFile(join(root, "approved", "b.jpg"), "approved-b");
    await writeFile(join(root, "approved", "a.jpg"), "approved-a");
    await writeFile(join(root, "approved", ".gitkeep"), "");
    await writeFile(join(root, "pending", "ignored.jpg"), "pending");

    const evidence = await loadApprovedEvidence(join(root, "approved"));
    expect(evidence.map((entry) => entry.file)).toEqual(["a.jpg", "b.jpg"]);
    expect(evidence.every((entry) => entry.sha256.length === 64)).toBe(true);
  });
});
