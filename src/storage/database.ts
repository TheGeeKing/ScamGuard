import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export type Storage = {
  isAvailable(): boolean;
  close(): void;
};

export function openStorage(path: string): Storage {
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
    close: () => sqlite.close(true),
  };
}
