import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../src/application";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("application startup", () => {
  test("migrates SQLite and reports database health", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scamguard-test-"));
    temporaryDirectories.push(directory);

    const application = createApplication({
      DISCORD_TOKEN: "test-token",
      GUILD_ID: "123456789",
      DATABASE_PATH: join(directory, "scamguard.db"),
    });

    try {
      expect(application.health()).toEqual({
        process: "ok",
        database: "available",
        discord: "not-connected",
        moderationLog: "not-configured",
      });
    } finally {
      application.close();
    }
  });
});
