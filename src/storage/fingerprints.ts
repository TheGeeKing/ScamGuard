import { and, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { fingerprints } from "./schema";

type KnownFingerprint = {
  guildId: string;
  sha256: string;
  source: string;
  createdBy: string;
  createdAt: Date;
};

type SafeFingerprint = {
  guildId: string;
  sha256: string;
  createdBy: string;
  createdAt: Date;
};

type HotFingerprint = {
  guildId: string;
  sha256: string;
  expiresAt: Date;
};

export type FingerprintRepository = {
  markKnown(fingerprint: KnownFingerprint): Promise<void>;
  markSafe(fingerprint: SafeFingerprint): Promise<void>;
  markHot(fingerprint: HotFingerprint): Promise<void>;
  classify(
    guildId: string,
    sha256: string,
    now: Date,
  ): Promise<"known" | "safe" | "hot" | "unknown">;
};

export function createFingerprintRepository(
  database: BunSQLiteDatabase,
): FingerprintRepository {
  const store = async (
    values: typeof fingerprints.$inferInsert,
  ): Promise<void> => {
    await database
      .insert(fingerprints)
      .values(values)
      .onConflictDoUpdate({ target: fingerprints.id, set: values })
      .run();
  };

  return {
    markKnown: (fingerprint) =>
      store({
        id: `${fingerprint.guildId}:${fingerprint.sha256}`,
        ...fingerprint,
        classification: "known",
        expiresAt: null,
      }),
    markSafe: (fingerprint) =>
      store({
        id: `${fingerprint.guildId}:${fingerprint.sha256}`,
        ...fingerprint,
        classification: "safe",
        source: "moderator",
        expiresAt: null,
      }),
    markHot: (fingerprint) =>
      store({
        id: `${fingerprint.guildId}:${fingerprint.sha256}`,
        ...fingerprint,
        classification: "hot",
        source: "automatic",
        createdBy: null,
        createdAt: new Date(),
      }),
    classify: async (guildId, sha256, now) => {
      const row = await database
        .select()
        .from(fingerprints)
        .where(
          and(
            eq(fingerprints.guildId, guildId),
            eq(fingerprints.sha256, sha256),
          ),
        )
        .get();
      if (!row) return "unknown";
      if (
        row.classification === "hot" &&
        row.expiresAt &&
        row.expiresAt.getTime() <= now.getTime()
      ) {
        await database
          .delete(fingerprints)
          .where(eq(fingerprints.id, row.id))
          .run();
        return "unknown";
      }
      return row.classification;
    },
  };
}
