import express from "express";

import { createBootstrapBoardAssignments } from "@fairgame/domain";
import { projectName } from "@fairgame/shared";
import { MatchService } from "./matches/matchService";
import { createMatchRouter } from "./matches/routes";

export function createApp(options: { readonly matchService?: MatchService } = {}) {
  const app = express();
  const matchService = options.matchService ?? new MatchService();

  app.use((request, response, next) => {
    response.header("access-control-allow-origin", request.header("origin") ?? "*");
    response.header("access-control-allow-methods", "GET,POST,OPTIONS");
    response.header("access-control-allow-headers", "content-type");
    response.header("access-control-allow-credentials", "true");
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      project: projectName,
      boardAssignments: createBootstrapBoardAssignments()
    });
  });

  app.use("/api/matches", createMatchRouter(matchService));

  return app;
}
