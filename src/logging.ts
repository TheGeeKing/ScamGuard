export type LogLevel = "info" | "warn" | "error";

export function writeLog(
  level: LogLevel,
  event: string,
  details: Record<string, boolean | number | string | null> = {},
): void {
  console[level === "info" ? "log" : level](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...details,
    }),
  );
}
