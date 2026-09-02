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
): Promise<{ distance: number; actionableDistance: number }> {
  let distance = await perceptualDistance(query.pdq, reference.pdq);
  let actionableDistance = distance;
  for (const queryCrop of query.crops) {
    for (const referenceCrop of reference.crops) {
      const cropDistance = await perceptualDistance(queryCrop, referenceCrop);
      const observationOnly =
        queryCrop.startsWith("d:") && referenceCrop.startsWith("d:");
      distance = Math.min(distance, cropDistance);
      if (!observationOnly)
        actionableDistance = Math.min(actionableDistance, cropDistance);
    }
  }
  return { distance, actionableDistance };
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
        ...(await closestDistance(query, reference.hash)),
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
  const bySource = new Map<
    string,
    { distance: number; actionableDistance: number }
  >();
  for (const { reference, distance, actionableDistance } of distances) {
    if (reference.classification !== "known" || distance > 45) continue;
    const current = bySource.get(reference.sourceSha256);
    bySource.set(reference.sourceSha256, {
      distance: Math.min(current?.distance ?? 256, distance),
      actionableDistance: Math.min(
        current?.actionableDistance ?? 256,
        actionableDistance,
      ),
    });
  }
  const matches = [...bySource].map(([sourceSha256, match]) => ({
    sourceSha256,
    distance: match.distance,
    strength:
      match.actionableDistance <= 15
        ? ("very-strong" as const)
        : match.actionableDistance <= 31
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
