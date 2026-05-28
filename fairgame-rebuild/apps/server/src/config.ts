import { resolve } from "node:path";

export type ServerConfig = {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly dataDir: string;
  readonly allowedOrigins: readonly string[];
  readonly secureCookies: boolean;
  readonly trustProxy: boolean;
  readonly jsonBodyLimit: string;
  readonly logLevel: string;
  readonly rateLimit: {
    readonly windowMs: number;
    readonly max: number;
  };
  readonly staleMatchMaxAgeMs: number;
  readonly cleanupIntervalMs: number;
  readonly webDistDir: string | null;
};

type Env = Readonly<Record<string, string | undefined>>;

export function loadServerConfig(env: Env = process.env, cwd = process.cwd()): ServerConfig {
  const nodeEnv = parseNodeEnv(env["NODE_ENV"]);

  return {
    nodeEnv,
    port: parsePositiveInteger(env["PORT"], 4000),
    dataDir: env["FAIRGAME_DB_DIR"] ?? resolve(cwd, "../../.data/pglite"),
    allowedOrigins: parseCsv(env["FAIRGAME_ALLOWED_ORIGINS"]),
    secureCookies: parseBoolean(env["FAIRGAME_SECURE_COOKIES"], nodeEnv === "production"),
    trustProxy: parseBoolean(env["FAIRGAME_TRUST_PROXY"], false),
    jsonBodyLimit: env["FAIRGAME_JSON_BODY_LIMIT"] ?? "64kb",
    logLevel: env["FAIRGAME_LOG_LEVEL"] ?? (nodeEnv === "production" ? "info" : "warn"),
    rateLimit: {
      windowMs: parsePositiveInteger(env["FAIRGAME_RATE_LIMIT_WINDOW_MS"], 60_000),
      max: parsePositiveInteger(env["FAIRGAME_RATE_LIMIT_MAX"], 120)
    },
    staleMatchMaxAgeMs: parsePositiveInteger(env["FAIRGAME_STALE_MATCH_MAX_AGE_MS"], 24 * 60 * 60 * 1_000),
    cleanupIntervalMs: parseNonNegativeInteger(env["FAIRGAME_CLEANUP_INTERVAL_MS"], 5 * 60 * 1_000),
    webDistDir: env["FAIRGAME_WEB_DIST_DIR"] ? resolve(cwd, env["FAIRGAME_WEB_DIST_DIR"]) : null
  };
}

function parseNodeEnv(value: string | undefined): ServerConfig["nodeEnv"] {
  if (value === "production" || value === "test") return value;
  return "development";
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
