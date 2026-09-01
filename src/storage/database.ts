import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { EffectiveGuildSettings } from "../bot/admin-commands";
import {
  createGuildSettingsRepository,
  type StoredGuildSettings,
} from "./guild-settings";

export type Storage = {
  isAvailable(): boolean;
  guildSettings: StoredGuildSettings;
  close(): void;
};

const fallbackSettings: EffectiveGuildSettings = {
  moderationMode: "dry-run",
  suspiciousScore: 50,
  deleteScore: 70,
  timeoutScore: 100,
  timeoutMinutes: 10,
  incidentRetentionDays: 30,
  moderationLogChannelId: null,
  ignoredChannelIds: [],
  trustedRoleIds: [],
};

export function openStorage(
  path: string,
  defaults: EffectiveGuildSettings = fallbackSettings,
): Storage {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true, strict: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");

  const database = drizzle({ client: sqlite });
  migrate(database, {
    migrationsFolder: join(import.meta.dir, "../../drizzle"),
  });

  return {
    isAvailable: () => sqlite.query("SELECT 1 AS healthy").get() !== null,
    guildSettings: createGuildSettingsRepository(database, defaults),
    close: () => sqlite.close(true),
  };
}
