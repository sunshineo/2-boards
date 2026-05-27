import express from "express";

import { createBootstrapBoardAssignments } from "@fairgame/domain";
import { projectName } from "@fairgame/shared";

export function createApp() {
  const app = express();

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      project: projectName,
      boardAssignments: createBootstrapBoardAssignments()
    });
  });

  return app;
}
