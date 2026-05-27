import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { MatchService } from "../src/matches/matchService";

function appWithDeterministicIds() {
  return createApp({
    matchService: new MatchService({ createId: () => "match-1" })
  });
}

describe("match API", () => {
  it("creates a TicTacToe match and assigns seat1", async () => {
    const response = await request(appWithDeterministicIds()).post("/api/matches").send({}).expect(201);

    expect(response.body).toMatchObject({
      seat: "seat1",
      match: {
        id: "match-1",
        gameType: "tictactoe",
        outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
        boards: [
          { id: "A", firstSeat: "seat1", cells: Array(9).fill(null), seatsToAct: ["seat1"] },
          { id: "B", firstSeat: "seat2", cells: Array(9).fill(null), seatsToAct: ["seat2"] }
        ]
      }
    });
  });

  it("joins the second seat", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);

    const response = await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    expect(response.body.seat).toBe("seat2");
    expect(response.body.match.id).toBe("match-1");
  });

  it("reads an existing match", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);

    const response = await request(app).get("/api/matches/match-1").expect(200);

    expect(response.body.match.id).toBe("match-1");
    expect(response.body.match.boards).toHaveLength(2);
  });

  it("applies a legal move through the server command", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { cell: 0 } })
      .expect(200);

    expect(response.body.match.boards[0].cells[0]).toBe("seat1");
    expect(response.body.match.boards[0].seatsToAct).toEqual(["seat2"]);
    expect(response.body.match.boards[1].cells).toEqual(Array(9).fill(null));
  });

  it("rejects invalid moves", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat2", move: { cell: 0 } })
      .expect(400);

    expect(response.body.error).toBe("seat-not-to-act");
  });

  it("returns the final combined score when both boards finish", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);

    for (const command of [
      { boardId: "A", seat: "seat1", move: { cell: 0 } },
      { boardId: "A", seat: "seat2", move: { cell: 3 } },
      { boardId: "A", seat: "seat1", move: { cell: 1 } },
      { boardId: "A", seat: "seat2", move: { cell: 4 } },
      { boardId: "A", seat: "seat1", move: { cell: 2 } },
      { boardId: "B", seat: "seat2", move: { cell: 0 } },
      { boardId: "B", seat: "seat1", move: { cell: 3 } },
      { boardId: "B", seat: "seat2", move: { cell: 1 } },
      { boardId: "B", seat: "seat1", move: { cell: 4 } },
      { boardId: "B", seat: "seat2", move: { cell: 2 } }
    ]) {
      await request(app).post("/api/matches/match-1/moves").send(command).expect(200);
    }

    const response = await request(app).get("/api/matches/match-1").expect(200);

    expect(response.body.match.outcome).toEqual({
      status: "completed",
      score: { seat1: 1, seat2: 1 },
      winner: null
    });
  });
});
