import { createApplication } from "./application";
import { writeLog } from "./logging";

const application = createApplication(process.env);
const healthServer = application.serveHealth();
void application.start().catch((error: unknown) => {
  writeLog("error", "discord.connection-failed", {
    error: error instanceof Error ? error.name : "unknown",
  });
});

writeLog("info", "health.started", {
  hostname: healthServer.hostname ?? null,
  port: healthServer.port ?? null,
});

let stopping = false;
function stop(): void {
  if (stopping) return;
  stopping = true;
  void healthServer.stop().finally(async () => {
    await application.close();
    process.exit(0);
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
