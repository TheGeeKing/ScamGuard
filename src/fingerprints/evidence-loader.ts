import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  hashImageBytes,
  PERCEPTUAL_VERSION,
  type PerceptualHash,
} from "../perceptual/hash";
import type { PerceptualFingerprintRepository } from "../storage/perceptual-fingerprints";

export type CuratedEvidence = {
  file: string;
  sha256: string;
  perceptual?: PerceptualHash;
};

async function hashFile(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

export async function loadEvidence(
  evidenceDirectory: string,
  cache?: PerceptualFingerprintRepository,
): Promise<CuratedEvidence[]> {
  const files = (await readdir(evidenceDirectory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() && /\.(?:gif|jpe?g|png|webp)$/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(
    files.map(async (file) => {
      const path = join(evidenceDirectory, file);
      const sha256 = await hashFile(path);
      if (!cache) return { file, sha256 };
      const cached = await cache.find(sha256, PERCEPTUAL_VERSION, null);
      if (cached) {
        return {
          file,
          sha256,
          perceptual: {
            version: PERCEPTUAL_VERSION,
            pdq: cached.pdq,
            quality: cached.quality,
            crops: cached.crops,
          },
        };
      }
      const perceptual = await hashImageBytes(
        await Bun.file(path).arrayBuffer(),
      );
      await cache.put({
        sourceSha256: sha256,
        version: perceptual.version,
        classification: "known",
        guildId: null,
        pdq: perceptual.pdq,
        quality: perceptual.quality,
        crops: perceptual.crops,
      });
      return { file, sha256, perceptual };
    }),
  );
}
