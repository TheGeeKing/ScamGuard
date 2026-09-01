import { describe, expect, test } from "bun:test";
import {
  applyFingerprintReview,
  fingerprintClassificationSignals,
  shouldPromoteHotFingerprint,
} from "../src/fingerprints/moderator-actions";

describe("fingerprint moderator actions", () => {
  test("promotes fingerprints only after an enforced timeout decision", () => {
    expect(
      shouldPromoteHotFingerprint({
        intention: "timeout",
        moderationMode: "enforce",
        actionOutcomes: [
          { action: "timeout", targetId: "user-1", status: "succeeded" },
        ],
      }),
    ).toBe(true);
    expect(
      shouldPromoteHotFingerprint({
        intention: "suspicious",
        moderationMode: "enforce",
        actionOutcomes: [],
      }),
    ).toBe(false);
    expect(
      shouldPromoteHotFingerprint({
        intention: "timeout",
        moderationMode: "dry-run",
        actionOutcomes: [
          { action: "timeout", targetId: "user-1", status: "intended" },
        ],
      }),
    ).toBe(false);
  });

  test("gives safe overrides precedence over curated, known, and hot matches", () => {
    const digests = ["safe", "known", "hot", "curated"];
    expect(
      fingerprintClassificationSignals(
        digests,
        ["safe", "known", "hot", "unknown"],
        new Set(["safe", "curated"]),
      ).map((signal) => [signal.key, signal.weight]),
    ).toEqual([
      ["known-sha:known", 100],
      ["hot-sha:hot", 90],
      ["known-sha:curated", 100],
    ]);
  });

  test("marks every unique selected hash as scam and reports the count", async () => {
    const known: unknown[] = [];
    const result = await applyFingerprintReview(
      {
        action: "scam",
        guildId: "guild-1",
        moderatorId: "moderator-1",
        sha256: ["a".repeat(64), "b".repeat(64), "a".repeat(64)],
      },
      {
        markKnown: async (fingerprint) => {
          known.push(fingerprint);
        },
        markSafe: async () => {},
      },
      new Date(0),
    );

    expect(result).toEqual({ count: 2, message: "Marked 2 images as scam." });
    expect(known).toHaveLength(2);
    expect(known[0]).toMatchObject({
      guildId: "guild-1",
      createdBy: "moderator-1",
      source: "moderator",
    });
  });

  test("marks every selected hash safe", async () => {
    const safe: unknown[] = [];
    const result = await applyFingerprintReview(
      {
        action: "safe",
        guildId: "guild-1",
        moderatorId: "moderator-1",
        sha256: ["a".repeat(64), "b".repeat(64)],
      },
      {
        markKnown: async () => {},
        markSafe: async (fingerprint) => {
          safe.push(fingerprint);
        },
      },
      new Date(0),
    );
    expect(result).toEqual({ count: 2, message: "Marked 2 images as safe." });
    expect(safe).toHaveLength(2);
  });
});
