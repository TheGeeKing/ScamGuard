import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type CuratedEvidence = {
  file: string;
  sha256: string;
};

async function hashFile(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

export async function loadEvidence(
  evidenceDirectory: string,
): Promise<CuratedEvidence[]> {
  const files = (await readdir(evidenceDirectory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() && /\.(?:gif|jpe?g|png|webp)$/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(
    files.map(async (file) => ({
      file,
      sha256: await hashFile(join(evidenceDirectory, file)),
    })),
  );
}
