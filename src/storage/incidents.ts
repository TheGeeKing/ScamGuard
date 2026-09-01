import { and, eq, lt } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { IncidentRecord } from "../domain/scamguard";
import { incidents } from "./schema";

export type IncidentRepository = {
  save(incident: IncidentRecord): Promise<void>;
  find(guildId: string, messageId: string): Promise<IncidentRecord | undefined>;
  markFalsePositive(
    guildId: string,
    messageId: string,
    reviewerId: string,
    reviewedAt: Date,
  ): Promise<boolean>;
  markFalsePositiveByHashes(
    guildId: string,
    sha256: string[],
    reviewerId: string,
    reviewedAt: Date,
  ): Promise<number>;
  deleteExpired(guildId: string, cutoff: Date): Promise<number>;
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
            isWebhook: row.isWebhook,
            createdAt: row.createdAt,
            latencyMs: row.latencyMs,
            imageEvidence: row.imageEvidence as IncidentRecord["imageEvidence"],
            signals: row.signals as IncidentRecord["signals"],
            score: row.score,
            intention: row.intention,
            moderationMode: row.moderationMode,
            intendedActions:
              row.intendedActions as IncidentRecord["intendedActions"],
            actionOutcomes:
              row.actionOutcomes as IncidentRecord["actionOutcomes"],
            falsePositive: row.falsePositive,
            reviewedBy: row.reviewedBy,
            reviewedAt: row.reviewedAt,
          }
        : undefined;
    },
    markFalsePositive: async (guildId, messageId, reviewerId, reviewedAt) => {
      const reviewed = await database
        .update(incidents)
        .set({ falsePositive: true, reviewedBy: reviewerId, reviewedAt })
        .where(
          and(
            eq(incidents.guildId, guildId),
            eq(incidents.messageId, messageId),
          ),
        )
        .returning({ messageId: incidents.messageId })
        .all();
      return reviewed.length > 0;
    },
    markFalsePositiveByHashes: async (
      guildId,
      sha256,
      reviewerId,
      reviewedAt,
    ) => {
      const reviewed = new Set(sha256);
      const rows = await database
        .select({
          messageId: incidents.messageId,
          evidence: incidents.imageEvidence,
        })
        .from(incidents)
        .where(eq(incidents.guildId, guildId))
        .all();
      const matches = rows.filter((row) =>
        (row.evidence as IncidentRecord["imageEvidence"]).some(
          (evidence) => evidence.sha256 && reviewed.has(evidence.sha256),
        ),
      );
      await Promise.all(
        matches.map((row) =>
          database
            .update(incidents)
            .set({ falsePositive: true, reviewedBy: reviewerId, reviewedAt })
            .where(
              and(
                eq(incidents.guildId, guildId),
                eq(incidents.messageId, row.messageId),
              ),
            )
            .run(),
        ),
      );
      return matches.length;
    },
    deleteExpired: async (guildId, cutoff) => {
      const deleted = await database
        .delete(incidents)
        .where(
          and(eq(incidents.guildId, guildId), lt(incidents.createdAt, cutoff)),
        )
        .returning({ messageId: incidents.messageId })
        .all();
      return deleted.length;
    },
  };
}
