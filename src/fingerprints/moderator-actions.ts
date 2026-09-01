import type { IncidentRecord, Signal } from "../domain/scamguard";
import type {
  FingerprintClassification,
  FingerprintRepository,
} from "../storage/fingerprints";

export function fingerprintClassificationSignals(
  digests: string[],
  classifications: FingerprintClassification[],
  curatedHashes: ReadonlySet<string>,
): Signal[] {
  return digests.flatMap((digest, index) => {
    const classification = classifications[index];
    if (classification === "safe") return [];
    if (classification === "hot")
      return [
        {
          key: `hot-sha:${digest}`,
          group: "known-fingerprint",
          weight: 90,
        },
      ];
    return classification === "known" || curatedHashes.has(digest)
      ? [
          {
            key: `known-sha:${digest}`,
            group: "known-fingerprint",
            weight: 100,
          },
        ]
      : [];
  });
}

export function shouldPromoteHotFingerprint(
  incident: Pick<
    IncidentRecord,
    "intention" | "moderationMode" | "actionOutcomes"
  >,
): boolean {
  return (
    incident.intention === "timeout" &&
    incident.moderationMode === "enforce" &&
    incident.actionOutcomes.some(
      (outcome) =>
        outcome.action === "timeout" && outcome.status === "succeeded",
    )
  );
}

type FingerprintReview = {
  action: "scam" | "safe";
  guildId: string;
  moderatorId: string;
  sha256: string[];
};

export async function applyFingerprintReview(
  review: FingerprintReview,
  repository: Pick<FingerprintRepository, "markKnown" | "markSafe">,
  createdAt: Date,
): Promise<{ count: number; message: string }> {
  const hashes = [...new Set(review.sha256)];
  await Promise.all(
    hashes.map((sha256) =>
      review.action === "scam"
        ? repository.markKnown({
            guildId: review.guildId,
            sha256,
            source: "moderator",
            createdBy: review.moderatorId,
            createdAt,
          })
        : repository.markSafe({
            guildId: review.guildId,
            sha256,
            createdBy: review.moderatorId,
            createdAt,
          }),
    ),
  );
  return {
    count: hashes.length,
    message: `Marked ${hashes.length} ${hashes.length === 1 ? "image" : "images"} as ${review.action}.`,
  };
}
