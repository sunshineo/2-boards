import { join } from "node:path";

import express from "express";
import type { ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { createBootstrapBoardAssignments } from "@fairgame/domain";
import { projectName } from "@fairgame/shared";
import { loadServerConfig, type ServerConfig } from "./config.js";
import { MatchService } from "./matches/matchService.js";
import { createMatchRouter } from "./matches/routes.js";

export function createApp(
  options: {
    readonly matchService?: MatchService;
    readonly config?: ServerConfig;
    readonly logger?: boolean;
    readonly readinessCheck?: () => Promise<void>;
  } = {}
) {
  const app = express();
  const matchService = options.matchService ?? new MatchService();
  const config = options.config ?? loadServerConfig();

  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  if (options.logger !== false) {
    app.use(pinoHttp({ level: config.logLevel }));
  }
  app.use((request, response, next) => {
    const allowedOrigin = getAllowedOrigin(request.header("origin"), config);
    if (allowedOrigin) {
      response.header("access-control-allow-origin", allowedOrigin);
      response.header("vary", "Origin");
    }
    response.header("access-control-allow-methods", "GET,POST,OPTIONS");
    response.header("access-control-allow-headers", "content-type");
    response.header("access-control-allow-credentials", "true");
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(
    "/api",
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_request, response) => {
        response.status(429).json({ error: "rate-limit-exceeded" });
      }
    })
  );

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      project: projectName,
      boardAssignments: createBootstrapBoardAssignments()
    });
  });

  app.get("/ready", async (_request, response) => {
    try {
      await options.readinessCheck?.();
      response.json({ ok: true, project: projectName });
    } catch {
      response.status(503).json({ ok: false, error: "not-ready" });
    }
  });

  app.use("/api/matches", createMatchRouter(matchService, { secureCookies: config.secureCookies }));
  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "not-found" });
  });

  if (config.webDistDir) {
    const webDistDir = config.webDistDir;
    app.use(express.static(webDistDir));
    app.use((request, response, next) => {
      if (!["GET", "HEAD"].includes(request.method) || request.path.startsWith("/api")) {
        next();
        return;
      }

      response.sendFile(join(webDistDir, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use(createErrorHandler());

  return app;
}

function getAllowedOrigin(origin: string | undefined, config: ServerConfig): string | null {
  if (!origin) return null;
  if (config.allowedOrigins.length === 0) return origin;
  return config.allowedOrigins.includes(origin) ? origin : null;
}

function createErrorHandler(): ErrorRequestHandler {
  return (error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    request.log?.error({ error }, "Unhandled request error");
    response.status(500).json({ error: "internal-error" });
  };
}
