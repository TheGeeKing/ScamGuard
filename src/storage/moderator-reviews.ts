import { and, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { moderatorReviews } from "./schema";

export type ModeratorReviewAction =
  | "false-positive"
  | "images-safe"
  | "reversal";

export type ModeratorReviewRecord = {
  id: string;
  guildId: string;
  incidentMessageId: string;
  action: ModeratorReviewAction;
  moderatorId: string;
  createdAt: Date;
  reversesReviewId: string | null;
  effects: unknown;
};

export type ModeratorReviewRepository = {
  save(review: ModeratorReviewRecord): Promise<void>;
  find(id: string): Promise<ModeratorReviewRecord | undefined>;
  findLatestUnreversed(
    guildId: string,
    incidentMessageId: string,
  ): Promise<ModeratorReviewRecord | undefined>;
};

export function createModeratorReviewRepository(
  database: BunSQLiteDatabase,
): ModeratorReviewRepository {
  return {
    save: async (review) => {
      await database.insert(moderatorReviews).values(review).run();
    },
    find: async (id) =>
      database.select().from(moderatorReviews).where(eq(moderatorReviews.id, id)).get(),
    findLatestUnreversed: async (guildId, incidentMessageId) => {
      const rows = await database
        .select()
        .from(moderatorReviews)
        .where(
          and(
            eq(moderatorReviews.guildId, guildId),
            eq(moderatorReviews.incidentMessageId, incidentMessageId),
          ),
        )
        .all();
      const reversed = new Set(
        rows.flatMap((row) =>
          row.action === "reversal" && row.reversesReviewId
            ? [row.reversesReviewId]
            : [],
        ),
      );
      return rows
        .filter((row) => row.action !== "reversal" && !reversed.has(row.id))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    },
  };
}
