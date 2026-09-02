import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";

describe("application configuration", () => {
  test("uses safe operational defaults", () => {
    const config = loadConfig({
      DISCORD_TOKEN: "test-token",
      GUILD_ID: "123456789",
    });

    expect(config).toEqual({
      discordToken: "test-token",
      guildId: "123456789",
      databasePath: "data/scamguard.db",
      suspiciousScore: 50,
      deleteScore: 70,
      timeoutScore: 100,
      timeoutMinutes: 10,
      incidentRetentionDays: 30,
      maxImageBytes: 10 * 1024 * 1024,
      imageDownloadTimeoutMs: 10_000,
      externalImageFetchEnabled: true,
      healthHost: "127.0.0.1",
      healthPort: 3000,
      moderationMode: "dry-run",
    });
  });

  test("names missing required values without exposing secrets", () => {
    expect(() => loadConfig({})).toThrow(
      "Missing required environment variables: DISCORD_TOKEN, GUILD_ID",
    );
  });

  test("rejects invalid moderation settings", () => {
    const required = { DISCORD_TOKEN: "test-token", GUILD_ID: "123456789" };

    expect(() => loadConfig({ ...required, MODERATION_MODE: "ban" })).toThrow(
      "MODERATION_MODE must be dry-run, delete, or enforce",
    );
    expect(() => loadConfig({ ...required, DELETE_SCORE: "40" })).toThrow(
      "Score thresholds must satisfy suspicious <= delete <= timeout",
    );
    expect(() => loadConfig({ ...required, HEALTH_PORT: "zero" })).toThrow(
      "HEALTH_PORT must be an integer between 1 and 65535",
    );
    expect(() =>
      loadConfig({ ...required, EXTERNAL_IMAGE_FETCH_ENABLED: "sometimes" }),
    ).toThrow("EXTERNAL_IMAGE_FETCH_ENABLED must be true or false");
    expect(() => loadConfig({ ...required, HEALTH_HOST: " " })).toThrow(
      "HEALTH_HOST must not be empty",
    );
  });
});
