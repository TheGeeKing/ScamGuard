import { describe, expect, test } from "bun:test";
import { createHealthHandler, startHealthServer } from "../src/health/http";

describe("health HTTP adapter", () => {
  test("returns component states without configuration details", async () => {
    const handler = createHealthHandler(() => ({
      process: "ok",
      database: "available",
      discord: "not-connected",
      moderationLog: "not-configured",
    }));

    const response = handler(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      process: "ok",
      database: "available",
      discord: "not-connected",
      moderationLog: "not-configured",
    });
    expect(handler(new Request("http://localhost/unknown")).status).toBe(404);
  });

  test("serves health through a real HTTP listener", async () => {
    const server = startHealthServer(
      { hostname: "127.0.0.1", port: 0 },
      () => ({
        process: "ok",
        database: "available",
        discord: "not-connected",
        moderationLog: "not-configured",
      }),
    );

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        process: "ok",
        database: "available",
        discord: "not-connected",
        moderationLog: "not-configured",
      });
    } finally {
      await server.stop();
    }
  });
});
