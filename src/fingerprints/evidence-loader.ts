import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type ApprovedEvidence = {
  file: string;
  sha256: string;
};

async function hashFile(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

export async function loadApprovedEvidence(
  approvedDirectory: string,
): Promise<ApprovedEvidence[]> {
  const files = (await readdir(approvedDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(
    files.map(async (file) => ({
      file,
      sha256: await hashFile(join(approvedDirectory, file)),
    })),
  );
}
