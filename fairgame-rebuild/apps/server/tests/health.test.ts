import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { loadServerConfig } from "../src/config";

const tempDirs: string[] = [];
const testDatabaseUrl = "postgresql://fairgame:secret@db.example.com/fairgame?sslmode=require";

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("health endpoint", () => {
  it("returns project and bootstrap board assignment data", async () => {
    const response = await request(createApp({ config: loadTestConfig(), logger: false })).get("/health").expect(200);

    expect(response.body).toEqual({
      ok: true,
      project: "FairGame",
      boardAssignments: [
        { boardId: "A", firstSeat: "seat1" },
        { boardId: "B", firstSeat: "seat2" }
      ]
    });
  });

  it("sets security headers and allows configured origins", async () => {
    const config = loadServerConfig(
      {
        DATABASE_URL: testDatabaseUrl,
        FAIRGAME_ALLOWED_ORIGINS: "https://play.example.com"
      },
      "/repo"
    );

    const response = await request(createApp({ config, logger: false }))
      .get("/health")
      .set("Origin", "https://play.example.com")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe("https://play.example.com");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("does not allow unconfigured cross-origin callers", async () => {
    const config = loadServerConfig(
      {
        DATABASE_URL: testDatabaseUrl,
        FAIRGAME_ALLOWED_ORIGINS: "https://play.example.com"
      },
      "/repo"
    );

    const response = await request(createApp({ config, logger: false }))
      .get("/health")
      .set("Origin", "https://evil.example.com")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("uses secure seat cookies in production", async () => {
    const config = loadServerConfig({ NODE_ENV: "production", DATABASE_URL: testDatabaseUrl }, "/repo");

    const response = await request(createApp({ config, logger: false }))
      .post("/api/matches")
      .send({ gameType: "tictactoe" })
      .expect(201);

    expect(response.headers["set-cookie"]?.[0]).toContain("Secure");
  });

  it("rate limits API requests", async () => {
    const config = loadServerConfig(
      {
        DATABASE_URL: testDatabaseUrl,
        FAIRGAME_RATE_LIMIT_WINDOW_MS: "60000",
        FAIRGAME_RATE_LIMIT_MAX: "2"
      },
      "/repo"
    );
    const app = createApp({ config, logger: false });

    await request(app).post("/api/matches").send({ gameType: "tictactoe" }).expect(201);
    await request(app).post("/api/matches").send({ gameType: "tictactoe" }).expect(201);
    const limited = await request(app).post("/api/matches").send({ gameType: "tictactoe" }).expect(429);

    expect(limited.body).toEqual({ error: "rate-limit-exceeded" });
  });

  it("reports readiness when dependencies are healthy", async () => {
    const response = await request(
      createApp({
        config: loadTestConfig(),
        logger: false,
        readinessCheck: async () => {
          return;
        }
      })
    )
      .get("/ready")
      .expect(200);

    expect(response.body).toEqual({ ok: true, project: "FairGame" });
  });

  it("reports readiness failure without leaking dependency internals", async () => {
    const response = await request(
      createApp({
        config: loadTestConfig(),
        logger: false,
        readinessCheck: async () => {
          throw new Error("database connection details");
        }
      })
    )
      .get("/ready")
      .expect(503);

    expect(response.body).toEqual({ ok: false, error: "not-ready" });
  });

  it("returns a stable JSON error for unknown API routes", async () => {
    const response = await request(createApp({ config: loadTestConfig(), logger: false }))
      .get("/api/does-not-exist")
      .expect(404);

    expect(response.body).toEqual({ error: "not-found" });
  });

  it("serves built web assets and falls back to index html for app routes", async () => {
    const webDistDir = await mkdtemp(join(tmpdir(), "fairgame-web-dist-"));
    tempDirs.push(webDistDir);
    await writeFile(join(webDistDir, "index.html"), "<!doctype html><title>FairGame Built</title>");
    await writeFile(join(webDistDir, "asset.txt"), "asset body");

    const config = loadServerConfig({ DATABASE_URL: testDatabaseUrl, FAIRGAME_WEB_DIST_DIR: webDistDir }, "/repo");
    const app = createApp({ config, logger: false });

    const root = await request(app).get("/").expect(200);
    expect(root.text).toContain("FairGame Built");

    const appRoute = await request(app).get("/matches/match-1").expect(200);
    expect(appRoute.text).toContain("FairGame Built");

    const asset = await request(app).get("/asset.txt").expect(200);
    expect(asset.text).toBe("asset body");

    const apiRoute = await request(app).get("/api/does-not-exist").expect(404);
    expect(apiRoute.body).toEqual({ error: "not-found" });
  });
});

function loadTestConfig() {
  return loadServerConfig({ DATABASE_URL: testDatabaseUrl }, "/repo");
}
