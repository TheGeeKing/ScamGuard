import { and, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { IncidentRecord } from "../domain/scamguard";
import { incidents } from "./schema";

export type IncidentRepository = {
  save(incident: IncidentRecord): Promise<void>;
  find(guildId: string, messageId: string): Promise<IncidentRecord | undefined>;
};

export function createIncidentRepository(
  database: BunSQLiteDatabase,
): IncidentRepository {
  return {
    save: async (incident) => {
      await database
        .insert(incidents)
        .values({
          id: `${incident.guildId}:${incident.messageId}`,
          ...incident,
        })
        .onConflictDoNothing()
        .run();
    },
    find: async (guildId, messageId) => {
      const row = await database
        .select()
        .from(incidents)
        .where(
          and(
            eq(incidents.guildId, guildId),
            eq(incidents.messageId, messageId),
          ),
        )
        .get();
      return row
        ? {
            guildId: row.guildId,
            channelId: row.channelId,
            messageId: row.messageId,
            userId: row.userId,
            createdAt: row.createdAt,
            imageEvidence: row.imageEvidence as IncidentRecord["imageEvidence"],
            signals: row.signals as IncidentRecord["signals"],
            score: row.score,
            intention: row.intention,
            moderationMode: row.moderationMode,
            intendedActions:
              row.intendedActions as IncidentRecord["intendedActions"],
          }
        : undefined;
    },
  };
}
