import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type EvidenceManifest = {
  version: 1;
  algorithm: "sha256";
  fingerprints: { file: string; sha256: string; bytes: number }[];
};

async function hashFile(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

export async function buildEvidenceManifest(
  approvedDirectory: string,
): Promise<EvidenceManifest> {
  const files = (await readdir(approvedDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  return {
    version: 1,
    algorithm: "sha256",
    fingerprints: await Promise.all(
      files.map(async (file) => {
        const path = join(approvedDirectory, file);
        return {
          file,
          sha256: await hashFile(path),
          bytes: (await stat(path)).size,
        };
      }),
    ),
  };
}

if (import.meta.main) {
  const evidenceDirectory = join(import.meta.dir, "../evidence");
  const manifest = await buildEvidenceManifest(
    join(evidenceDirectory, "approved"),
  );
  await Bun.write(
    join(evidenceDirectory, "fingerprints.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
