export type ModerationMode = "dry-run" | "delete" | "enforce";

export type AppConfig = {
  discordToken: string;
  guildId: string;
  databasePath: string;
  suspiciousScore: number;
  deleteScore: number;
  timeoutScore: number;
  timeoutMinutes: number;
  incidentRetentionDays: number;
  maxImageBytes: number;
  imageDownloadTimeoutMs: number;
  externalImageFetchEnabled: boolean;
  fastAnalysisBudgetMs: number;
  healthHost: string;
  healthPort: number;
  moderationMode: ModerationMode;
};

function readInteger(
  environment: Record<string, string | undefined>,
  key: string,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = Number(environment[key] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${key} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function readBoolean(
  environment: Record<string, string | undefined>,
  key: string,
  fallback: boolean,
): boolean {
  const value = environment[key];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${key} must be true or false`);
}

export function loadConfig(
  environment: Record<string, string | undefined>,
): AppConfig {
  const missing = ["DISCORD_TOKEN", "GUILD_ID"].filter(
    (key) => !environment[key],
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const moderationMode = environment.MODERATION_MODE ?? "dry-run";
  if (
    !(["dry-run", "delete", "enforce"] as const).includes(
      moderationMode as ModerationMode,
    )
  ) {
    throw new Error("MODERATION_MODE must be dry-run, delete, or enforce");
  }

  const suspiciousScore = readInteger(environment, "SUSPICIOUS_SCORE", 50);
  const deleteScore = readInteger(environment, "DELETE_SCORE", 70);
  const timeoutScore = readInteger(environment, "TIMEOUT_SCORE", 100);
  if (suspiciousScore > deleteScore || deleteScore > timeoutScore) {
    throw new Error(
      "Score thresholds must satisfy suspicious <= delete <= timeout",
    );
  }

  const healthHost = environment.HEALTH_HOST?.trim() ?? "127.0.0.1";
  if (!healthHost) {
    throw new Error("HEALTH_HOST must not be empty");
  }

  return {
    discordToken: environment.DISCORD_TOKEN as string,
    guildId: environment.GUILD_ID as string,
    databasePath: environment.DATABASE_PATH ?? "data/scamguard.db",
    suspiciousScore,
    deleteScore,
    timeoutScore,
    timeoutMinutes: readInteger(environment, "TIMEOUT_MINUTES", 10),
    incidentRetentionDays: readInteger(
      environment,
      "INCIDENT_RETENTION_DAYS",
      30,
    ),
    maxImageBytes: readInteger(
      environment,
      "MAX_IMAGE_BYTES",
      10 * 1024 * 1024,
    ),
    imageDownloadTimeoutMs: readInteger(
      environment,
      "IMAGE_DOWNLOAD_TIMEOUT_MS",
      10_000,
    ),
    externalImageFetchEnabled: readBoolean(
      environment,
      "EXTERNAL_IMAGE_FETCH_ENABLED",
      true,
    ),
    fastAnalysisBudgetMs: readInteger(
      environment,
      "FAST_ANALYSIS_BUDGET_MS",
      100,
    ),
    healthHost,
    healthPort: readInteger(environment, "HEALTH_PORT", 3000, 65_535),
    moderationMode: moderationMode as ModerationMode,
  };
}
