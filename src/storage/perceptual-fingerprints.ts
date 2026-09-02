import { and, eq, isNull } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { perceptualFingerprints } from "./schema";

export type StoredPerceptualFingerprint = Omit<
  typeof perceptualFingerprints.$inferInsert,
  "id"
>;

export type PerceptualFingerprintRepository = {
  put(value: StoredPerceptualFingerprint): Promise<void>;
  find(
    sourceSha256: string,
    version: string,
    guildId: string | null,
  ): Promise<StoredPerceptualFingerprint | undefined>;
};

export function createPerceptualFingerprintRepository(
  database: BunSQLiteDatabase,
): PerceptualFingerprintRepository {
  return {
    put: async (value) => {
      const values = {
        id: `${value.guildId ?? "global"}:${value.sourceSha256}:${value.version}`,
        ...value,
      };
      await database
        .insert(perceptualFingerprints)
        .values(values)
        .onConflictDoUpdate({ target: perceptualFingerprints.id, set: values })
        .run();
    },
    find: async (sourceSha256, version, guildId) => {
      const row = await database
        .select()
        .from(perceptualFingerprints)
        .where(
          and(
            eq(perceptualFingerprints.sourceSha256, sourceSha256),
            eq(perceptualFingerprints.version, version),
            guildId === null
              ? isNull(perceptualFingerprints.guildId)
              : eq(perceptualFingerprints.guildId, guildId),
          ),
        )
        .get();
      if (!row) return undefined;
      const { id: _id, ...value } = row;
      return value;
    },
  };
}
