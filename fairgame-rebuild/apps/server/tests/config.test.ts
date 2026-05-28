import { describe, expect, it } from "vitest";

import { loadServerConfig } from "../src/config";

describe("server config", () => {
  it("parses production operational settings from the environment", () => {
    const config = loadServerConfig(
      {
        NODE_ENV: "production",
        PORT: "8080",
        FAIRGAME_DB_DIR: "/var/lib/fairgame/pglite",
        FAIRGAME_ALLOWED_ORIGINS: "https://play.example.com, https://fair.example.com",
        FAIRGAME_RATE_LIMIT_WINDOW_MS: "120000",
        FAIRGAME_RATE_LIMIT_MAX: "25",
        FAIRGAME_STALE_MATCH_MAX_AGE_MS: "604800000",
        FAIRGAME_CLEANUP_INTERVAL_MS: "900000",
        FAIRGAME_WEB_DIST_DIR: "/srv/fairgame/web"
      },
      "/repo"
    );

    expect(config).toMatchObject({
      nodeEnv: "production",
      port: 8080,
      dataDir: "/var/lib/fairgame/pglite",
      allowedOrigins: ["https://play.example.com", "https://fair.example.com"],
      secureCookies: true,
      rateLimit: { windowMs: 120_000, max: 25 },
      staleMatchMaxAgeMs: 604_800_000,
      cleanupIntervalMs: 900_000,
      webDistDir: "/srv/fairgame/web"
    });
  });

  it("uses safe development defaults", () => {
    const config = loadServerConfig({}, "/repo/apps/server");

    expect(config).toMatchObject({
      nodeEnv: "development",
      port: 4000,
      dataDir: "/repo/.data/pglite",
      allowedOrigins: [],
      secureCookies: false,
      rateLimit: { windowMs: 60_000, max: 120 },
      staleMatchMaxAgeMs: 86_400_000,
      cleanupIntervalMs: 300_000,
      webDistDir: null
    });
  });
});
