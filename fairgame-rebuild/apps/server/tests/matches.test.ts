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

    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("fg_seat_match-1=seat1.")])
    );
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

  it("creates a Connect Four match and assigns seat1", async () => {
    const response = await request(appWithDeterministicIds())
      .post("/api/matches")
      .send({ gameType: "connect4" })
      .expect(201);

    expect(response.body).toMatchObject({
      seat: "seat1",
      match: {
        id: "match-1",
        gameType: "connect4",
        boards: [
          {
            id: "A",
            kind: "connect4",
            rows: 6,
            columns: 7,
            cells: Array(42).fill(null),
            playableColumns: [0, 1, 2, 3, 4, 5, 6],
            seatsToAct: ["seat1"]
          },
          {
            id: "B",
            kind: "connect4",
            rows: 6,
            columns: 7,
            cells: Array(42).fill(null),
            playableColumns: [0, 1, 2, 3, 4, 5, 6],
            seatsToAct: ["seat2"]
          }
        ]
      }
    });
  });

  it("rejects unsupported game types", async () => {
    const response = await request(appWithDeterministicIds())
      .post("/api/matches")
      .send({ gameType: "go" })
      .expect(400);

    expect(response.body).toEqual({ error: "unsupported-game" });
  });

  it("joins the second seat", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);

    const response = await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("fg_seat_match-1=seat2.")])
    );
    expect(response.body.seat).toBe("seat2");
    expect(response.body.match.id).toBe("match-1");
  });

  it("restores a player seat from the seat cookie", async () => {
    const app = appWithDeterministicIds();
    const agent = request.agent(app);
    await agent.post("/api/matches").send({}).expect(201);

    const response = await agent.get("/api/matches/match-1/session").expect(200);

    expect(response.body.seat).toBe("seat1");
    expect(response.body.match.id).toBe("match-1");
  });

  it("returns spectator mode without a valid seat cookie", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);

    const response = await request(app).get("/api/matches/match-1/session").expect(200);

    expect(response.body.seat).toBeNull();
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

  it("applies a legal Connect Four move through the server command", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({ gameType: "connect4" }).expect(201);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { column: 0 } })
      .expect(200);

    expect(response.body.match.boards[0].cells[35]).toBe("seat1");
    expect(response.body.match.boards[0].seatsToAct).toEqual(["seat2"]);
    expect(response.body.match.boards[0].playableColumns).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(response.body.match.boards[1].cells).toEqual(Array(42).fill(null));
  });

  it("rejects move shapes that do not match the stored game", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({ gameType: "connect4" }).expect(201);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { cell: 0 } })
      .expect(400);

    expect(response.body.error).toBe("invalid-move");
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
