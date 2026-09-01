import { createApplication } from "./application";

const application = createApplication(process.env);
const healthServer = application.serveHealth();

console.log(
  `ScamGuard health listening on ${healthServer.hostname}:${healthServer.port}`,
);

let stopping = false;
function stop(): void {
  if (stopping) return;
  stopping = true;
  void healthServer.stop().finally(() => {
    application.close();
    process.exit(0);
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
