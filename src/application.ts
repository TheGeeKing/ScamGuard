import { loadConfig } from "./config";
import { startHealthServer } from "./health/http";
import { openStorage } from "./storage/database";

export type HealthStatus = {
  process: "ok";
  database: "available" | "unavailable";
  discord: "not-connected" | "connected";
  moderationLog: "not-configured" | "configured";
};

export type Application = {
  health(): HealthStatus;
  serveHealth(): ReturnType<typeof Bun.serve>;
  close(): void;
};

export function createApplication(
  environment: Record<string, string | undefined>,
): Application {
  const config = loadConfig(environment);
  const storage = openStorage(config.databasePath);

  const health = (): HealthStatus => ({
    process: "ok",
    database: storage.isAvailable() ? "available" : "unavailable",
    discord: "not-connected",
    moderationLog: "not-configured",
  });

  return {
    health,
    serveHealth: () =>
      startHealthServer(
        { hostname: config.healthHost, port: config.healthPort },
        health,
      ),
    close: () => storage.close(),
  };
}
