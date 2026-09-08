export type LogLevel = "debug" | "info" | "warn" | "error";

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minimumLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  minimumLevel = level;
}

export function writeLog(
  level: LogLevel,
  event: string,
  details: Record<string, boolean | number | string | null> = {},
): void {
  if (priorities[level] < priorities[minimumLevel]) return;
  console[level === "debug" || level === "info" ? "log" : level](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...details,
    }),
  );
}
