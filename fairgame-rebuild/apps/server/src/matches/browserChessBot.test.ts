import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { loadServerConfig } from "../config.js";
import { MatchService } from "./matchService.js";
import { createMatchRouter } from "./routes.js";

function createTestApp(matchService = new MatchService()) {
  const app = express();
  app.use(express.json());
  app.use("/api/matches", createMatchRouter(matchService));
  return app;
}

function getSetCookies(response: request.Response): string[] {
  const header = response.headers["set-cookie"];
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

function findBoard(match: { boards: readonly { id: string }[] }, boardId: string) {
  return match.boards.find((board) => board.id === boardId);
}

describe("browser Chess bot", () => {
  it("does not expose legacy server heuristic bot config", () => {
    const legacyEnvFlag = ["FAIRGAME", "DEBUG", "CHESS", "BOT"].join("_");
    const legacyConfigKey = ["debug", "Chess", "Bot"].join("");
    const config = loadServerConfig({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://fairgame:password@localhost:5432/fairgame",
      [legacyEnvFlag]: "true"
    });

    expect(legacyConfigKey in config).toBe(false);
  });

  it("does not auto-seat a server debug bot for normal Chess match creation", async () => {
    const response = await request(createTestApp())
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000 })
      .expect(201);

    expect(response.body.match.joinedSeats).toBe(1);
    expect(response.body.match.bot).toBeUndefined();
    expect(response.body.match.players.seat2.name).toBe("Player 2");
  });

  it("creates a Chess bot match with seat2 joined and bot metadata", async () => {
    const response = await request(createTestApp())
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      .expect(201);

    expect(response.body.seat).toBe("seat1");
    expect(response.body.match.joinedSeats).toBe(2);
    expect(response.body.match.bot).toEqual({
      seat: "seat2",
      kind: "browser-stockfish",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    });
    expect(response.body.match.players.seat2.name).toBe("Stockfish Normal");
    expect(getSetCookies(response).join("\n")).toContain(`fg_bot_${response.body.match.id}=`);
  });

  it("creates Chess bot matches without a feature flag", async () => {
    const response = await request(createTestApp())
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      .expect(201);

    expect(response.body.match.bot?.displayName).toBe("Stockfish Normal");
    expect(response.body.match.joinedSeats).toBe(2);
  });

  it("rejects bot match creation for non-Chess games", async () => {
    await request(createTestApp())
      .post("/api/matches")
      .send({ gameType: "tictactoe", bot: { difficulty: "easy" } })
      .expect(400)
      .expect(({ body }) => expect(body.error).toBe("unsupported-bot-game"));
  });

  it("rejects bot moves without the bot-control cookie", async () => {
    const app = createTestApp();
    const created = await request(app)
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      .expect(201);

    await request(app)
      .post(`/api/matches/${created.body.match.id}/bot-moves`)
      .send({ boardId: "B", move: { from: "e2", to: "e4" } })
      .expect(403)
      .expect(({ body }) => expect(body.error).toBe("unauthorized-bot"));
  });

  it("applies authorized bot moves as seat2 and advances the opponent clock", async () => {
    const app = createTestApp();
    const created = await request(app)
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      .expect(201);

    const moved = await request(app)
      .post(`/api/matches/${created.body.match.id}/bot-moves`)
      .set("Cookie", getSetCookies(created))
      .send({ boardId: "B", move: { from: "e2", to: "e4" } })
      .expect(200);

    const boardB = findBoard(moved.body.match, "B");
    expect(boardB?.moveHistory.at(-1)).toMatchObject({ seat: "seat2", from: "e2", to: "e4" });
    expect(moved.body.match.clock.runningSeats).toContain("seat1");
  });

  it("declines human draw offers through the bot endpoint", async () => {
    const app = createTestApp();
    const created = await request(app)
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "easy" } })
      .expect(201);

    await request(app)
      .post(`/api/matches/${created.body.match.id}/moves`)
      .send({ boardId: "A", seat: "seat1", move: { drawOffer: true } })
      .expect(200);

    const declined = await request(app)
      .post(`/api/matches/${created.body.match.id}/bot-moves`)
      .set("Cookie", getSetCookies(created))
      .send({ boardId: "A", move: { declineDraw: true } })
      .expect(200);

    const boardA = findBoard(declined.body.match, "A");
    expect(boardA?.drawOffer).toBeNull();
    expect(boardA?.moveHistory.at(-1)).toMatchObject({ seat: "seat2", drawDeclined: true });
  });
});
