import { type PerceptualHash, perceptualDistance } from "./hash";

export type PerceptualReference = {
  sourceSha256: string;
  classification: "known" | "safe";
  hash: PerceptualHash;
};

export type PerceptualMatch = {
  sourceSha256: string;
  distance: number;
  strength: "weak" | "strong" | "very-strong";
};

async function closestDistance(
  query: PerceptualHash,
  reference: PerceptualHash,
): Promise<number> {
  let closest = await perceptualDistance(query.pdq, reference.pdq);
  for (const queryCrop of query.crops) {
    for (const referenceCrop of reference.crops) {
      closest = Math.min(
        closest,
        await perceptualDistance(queryCrop, referenceCrop),
      );
    }
  }
  return closest;
}

function proposedScore(matches: PerceptualMatch[]): number {
  const veryStrong = matches.filter(
    (match) => match.strength === "very-strong",
  ).length;
  const strong = matches.filter((match) => match.strength === "strong").length;
  if (veryStrong >= 2 || (veryStrong >= 1 && strong >= 1) || strong >= 3)
    return 100;
  if (veryStrong === 1 || strong === 2) return 85;
  if (strong === 1) return 60;
  return matches.length > 0 ? 30 : 0;
}

export async function matchPerceptual(
  query: PerceptualHash,
  references: PerceptualReference[],
): Promise<{
  proposedScore: number;
  matches: PerceptualMatch[];
  suppressedBySafe: boolean;
}> {
  if (query.quality <= 49)
    return { proposedScore: 0, matches: [], suppressedBySafe: false };
  const distances = await Promise.all(
    references
      .filter((reference) => reference.hash.quality > 49)
      .map(async (reference) => ({
        reference,
        distance: await closestDistance(query, reference.hash),
      })),
  );
  const nearestKnown = Math.min(
    ...distances
      .filter(({ reference }) => reference.classification === "known")
      .map(({ distance }) => distance),
  );
  const nearestSafe = Math.min(
    ...distances
      .filter(({ reference }) => reference.classification === "safe")
      .map(({ distance }) => distance),
  );
  if (nearestKnown <= 45 && nearestSafe <= nearestKnown) {
    return { proposedScore: 0, matches: [], suppressedBySafe: true };
  }
  const bySource = new Map<string, number>();
  for (const { reference, distance } of distances) {
    if (reference.classification !== "known" || distance > 45) continue;
    bySource.set(
      reference.sourceSha256,
      Math.min(bySource.get(reference.sourceSha256) ?? 256, distance),
    );
  }
  const matches = [...bySource].map(([sourceSha256, distance]) => ({
    sourceSha256,
    distance,
    strength:
      distance <= 15
        ? ("very-strong" as const)
        : distance <= 31
          ? ("strong" as const)
          : ("weak" as const),
  }));
  return {
    proposedScore: proposedScore(matches),
    matches: matches.sort(
      (left, right) =>
        left.distance - right.distance ||
        left.sourceSha256.localeCompare(right.sourceSha256),
    ),
    suppressedBySafe: false,
  };
}
