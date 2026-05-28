import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { MatchService } from "../src/matches/matchService";

function appWithDeterministicIds(options: Partial<ConstructorParameters<typeof MatchService>[0]> = {}) {
  return createApp({
    matchService: new MatchService({ createId: () => "match-1", ...options })
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
        joinedSeats: 1,
        maxSeats: 2,
        outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
        boards: [
          { id: "A", firstSeat: "seat1", cells: Array(9).fill(null), seatsToAct: [] },
          { id: "B", firstSeat: "seat2", cells: Array(9).fill(null), seatsToAct: [] }
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
        joinedSeats: 1,
        maxSeats: 2,
        boards: [
          {
            id: "A",
            kind: "connect4",
            rows: 6,
            columns: 7,
            cells: Array(42).fill(null),
            playableColumns: [0, 1, 2, 3, 4, 5, 6],
            seatsToAct: []
          },
          {
            id: "B",
            kind: "connect4",
            rows: 6,
            columns: 7,
            cells: Array(42).fill(null),
            playableColumns: [0, 1, 2, 3, 4, 5, 6],
            seatsToAct: []
          }
        ]
      }
    });
  });

  it("creates a Chess match and assigns first-seat colors per board", async () => {
    const response = await request(appWithDeterministicIds())
      .post("/api/matches")
      .send({ gameType: "chess" })
      .expect(201);

    expect(response.body).toMatchObject({
      seat: "seat1",
      match: {
        id: "match-1",
        gameType: "chess",
        gameLabel: "Chess",
        joinedSeats: 1,
        maxSeats: 2,
        boards: [
          {
            id: "A",
            kind: "chess",
            whiteSeat: "seat1",
            blackSeat: "seat2",
            seatsToAct: []
          },
          {
            id: "B",
            kind: "chess",
            whiteSeat: "seat2",
            blackSeat: "seat1",
            seatsToAct: []
          }
        ]
      }
    });
    expect(response.body.match.boards[0].squares).toHaveLength(64);
  });

  it("creates each added board game with two fair boards", async () => {
    const cases = [
      { gameType: "gomoku", kind: "gomoku", fields: { rows: 15, columns: 15 } },
      { gameType: "hex", kind: "hex", fields: { size: 11 } },
      { gameType: "reversi", kind: "reversi", fields: { rows: 8, columns: 8 } },
      { gameType: "breakthrough", kind: "breakthrough", fields: { rows: 8, columns: 8 } },
      { gameType: "mancala", kind: "mancala", fields: { pitsPerSide: 6 } },
      { gameType: "dots-boxes", kind: "dots-boxes", fields: { boxRows: 3, boxColumns: 3 } },
      { gameType: "order-chaos", kind: "order-chaos", fields: { rows: 6, columns: 6 } }
    ];

    for (const testCase of cases) {
      const app = appWithDeterministicIds();
      const response = await request(app).post("/api/matches").send({ gameType: testCase.gameType }).expect(201);

      expect(response.body).toMatchObject({
        seat: "seat1",
        match: {
          id: "match-1",
          gameType: testCase.gameType,
          joinedSeats: 1,
          maxSeats: 2,
          boards: [
            { id: "A", kind: testCase.kind, firstSeat: "seat1", ...testCase.fields, seatsToAct: [] },
            { id: "B", kind: testCase.kind, firstSeat: "seat2", ...testCase.fields, seatsToAct: [] }
          ]
        }
      });
    }
  });

  it("creates a match with a requested total time and no increment", async () => {
    const response = await request(appWithDeterministicIds())
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 10 * 60 * 1_000 })
      .expect(201);

    expect(response.body.match.clock.config).toEqual({
      initialMs: 10 * 60 * 1_000,
      incrementMs: 0
    });
    expect(response.body.match.clock.seats.seat1).toEqual({ remainingMs: 10 * 60 * 1_000, isRunning: false });
    expect(response.body.match.clock.seats.seat2).toEqual({ remainingMs: 10 * 60 * 1_000, isRunning: false });
  });

  it("rejects invalid requested total times", async () => {
    const response = await request(appWithDeterministicIds())
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 30_000 })
      .expect(400);

    expect(response.body).toEqual({ error: "invalid-clock" });
  });

  it("rejects total times outside the selected game's range", async () => {
    await request(appWithDeterministicIds())
      .post("/api/matches")
      .send({ gameType: "tictactoe", clockInitialMs: 15 * 60 * 1_000 })
      .expect(400);

    await request(appWithDeterministicIds())
      .post("/api/matches")
      .send({ gameType: "connect4", clockInitialMs: 60_000 })
      .expect(400);
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
    expect(response.body.match.joinedSeats).toBe(2);
    expect(response.body.match.maxSeats).toBe(2);
    expect(response.body.match.boards.map((board: { seatsToAct: string[] }) => board.seatsToAct)).toEqual([
      ["seat1"],
      ["seat2"]
    ]);
  });

  it("lists only matches that are waiting for a second player", async () => {
    let idIndex = 0;
    let now = 1_000;
    const app = createApp({
      matchService: new MatchService({
        createId: () => `match-${++idIndex}`,
        nowMs: () => now
      })
    });

    await request(app).post("/api/matches").send({ gameType: "tictactoe" }).expect(201);
    now = 2_000;
    await request(app).post("/api/matches").send({ gameType: "chess" }).expect(201);
    now = 3_000;
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    const response = await request(app).get("/api/matches").expect(200);

    expect(response.body).toEqual({
      matches: [
        {
          id: "match-2",
          gameType: "chess",
          gameLabel: "Chess",
          clockInitialMs: 300_000,
          clockIncrementMs: 0,
          joinedSeats: 1,
          maxSeats: 2,
          updatedAtMs: 2_000
        }
      ]
    });
  });

  it("stores display names for both seats", async () => {
    const app = appWithDeterministicIds();

    const created = await request(app)
      .post("/api/matches")
      .send({ playerName: "Alice" })
      .expect(201);
    expect(created.body.match.players.seat1).toEqual({ label: "Player 1", name: "Alice" });
    expect(created.body.match.players.seat2).toEqual({ label: "Player 2", name: "Player 2" });

    const joined = await request(app)
      .post("/api/matches/match-1/join")
      .send({ playerName: "Bob" })
      .expect(200);
    expect(joined.body.match.players.seat1).toEqual({ label: "Player 1", name: "Alice" });
    expect(joined.body.match.players.seat2).toEqual({ label: "Player 2", name: "Bob" });
  });

  it("starts shared clocks only after both seats have joined", async () => {
    let now = 1_000;
    const app = appWithDeterministicIds({
      clockConfig: { initialMs: 1_000, incrementMs: 100 },
      nowMs: () => now
    });

    const created = await request(app).post("/api/matches").send({}).expect(201);
    expect(created.body.match.clock.seats.seat1).toEqual({ remainingMs: 1_000, isRunning: false });
    expect(created.body.match.clock.seats.seat2).toEqual({ remainingMs: 1_000, isRunning: false });

    const joined = await request(app).post("/api/matches/match-1/join").send({}).expect(200);
    expect(joined.body.match.clock.runningSeats).toEqual(["seat1", "seat2"]);

    now = 1_250;
    const response = await request(app).get("/api/matches/match-1").expect(200);
    expect(response.body.match.clock.seats.seat1).toEqual({ remainingMs: 750, isRunning: true });
    expect(response.body.match.clock.seats.seat2).toEqual({ remainingMs: 750, isRunning: true });
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
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { cell: 0 } })
      .expect(200);

    expect(response.body.match.boards[0].cells[0]).toBe("seat1");
    expect(response.body.match.boards[0].seatsToAct).toEqual(["seat2"]);
    expect(response.body.match.boards[1].cells).toEqual(Array(9).fill(null));
  });

  it("rejects moves before the second seat joins without starting clocks", async () => {
    let now = 0;
    const app = appWithDeterministicIds({
      clockConfig: { initialMs: 1_000, incrementMs: 100 },
      nowMs: () => now
    });
    await request(app).post("/api/matches").send({}).expect(201);

    now = 250;
    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { cell: 0 } })
      .expect(409);

    expect(response.body.error).toBe("match-not-ready");
    expect(response.body.match.boards[0].cells).toEqual(Array(9).fill(null));
    expect(response.body.match.boards[0].seatsToAct).toEqual([]);
    expect(response.body.match.clock.seats.seat1).toEqual({ remainingMs: 1_000, isRunning: false });
    expect(response.body.match.clock.seats.seat2).toEqual({ remainingMs: 1_000, isRunning: false });
    expect(response.body.match.clock.runningSeats).toEqual([]);
  });

  it("charges shared clocks, adds increment, and recomputes running seats after a move", async () => {
    let now = 0;
    const app = appWithDeterministicIds({
      clockConfig: { initialMs: 1_000, incrementMs: 100 },
      nowMs: () => now
    });
    await request(app).post("/api/matches").send({}).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    now = 250;
    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { cell: 0 } })
      .expect(200);

    expect(response.body.match.clock.seats.seat1).toEqual({ remainingMs: 850, isRunning: false });
    expect(response.body.match.clock.seats.seat2).toEqual({ remainingMs: 750, isRunning: true });
    expect(response.body.match.clock.runningSeats).toEqual(["seat2"]);
  });

  it("resolves unfinished boards when a running clock expires", async () => {
    let now = 0;
    const app = appWithDeterministicIds({
      clockConfig: { initialMs: 1_000, incrementMs: 0 },
      nowMs: () => now
    });
    await request(app).post("/api/matches").send({}).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    now = 100;
    await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { cell: 0 } })
      .expect(200);

    now = 1_200;
    const response = await request(app).get("/api/matches/match-1").expect(200);

    expect(response.body.match.clock.status).toBe("expired");
    expect(response.body.match.clock.expiredSeats).toEqual(["seat2"]);
    expect(response.body.match.outcome).toEqual({
      status: "completed",
      score: { seat1: 2, seat2: 0 },
      winner: "seat1"
    });
    expect(response.body.match.boards[0].outcome).toMatchObject({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "timeout"
    });
    expect(response.body.match.boards[1].outcome).toMatchObject({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "timeout"
    });
  });

  it("applies a legal Connect Four move through the server command", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({ gameType: "connect4" }).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { column: 0 } })
      .expect(200);

    expect(response.body.match.boards[0].cells[35]).toBe("seat1");
    expect(response.body.match.boards[0].seatsToAct).toEqual(["seat2"]);
    expect(response.body.match.boards[0].playableColumns).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(response.body.match.boards[1].cells).toEqual(Array(42).fill(null));
  });

  it("applies a legal Chess move through the server command", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({ gameType: "chess" }).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { from: "e2", to: "e4" } })
      .expect(200);

    const board = response.body.match.boards[0];
    expect(board.squares.find((square: { square: string }) => square.square === "e4").piece).toEqual({
      color: "w",
      type: "p"
    });
    expect(board.moveHistory[0]).toMatchObject({ from: "e2", to: "e4", san: "e4", seat: "seat1" });
    expect(board.seatsToAct).toEqual(["seat2"]);
  });

  it("applies representative opening moves for the added board games", async () => {
    const cases = [
      { gameType: "gomoku", move: { cell: 0 }, expected: { path: ["cells", 0], value: "seat1" } },
      { gameType: "hex", move: { cell: 0 }, expected: { path: ["cells", 0], value: "seat1" } },
      { gameType: "reversi", move: { cell: 19 }, expected: { path: ["cells", 19], value: "seat1" } },
      { gameType: "breakthrough", move: { from: 8, to: 16 }, expected: { path: ["cells", 16], value: "seat1" } },
      { gameType: "mancala", move: { pit: 2 }, expected: { path: ["pits", 2], value: 0 } },
      { gameType: "dots-boxes", move: { edge: "h-0-0" }, expected: { path: ["drawnEdges", 0], value: "h-0-0" } },
      { gameType: "order-chaos", move: { cell: 0, mark: "X" }, expected: { path: ["cells", 0], value: "X" } }
    ];

    for (const testCase of cases) {
      const app = appWithDeterministicIds();
      await request(app).post("/api/matches").send({ gameType: testCase.gameType }).expect(201);
      await request(app).post("/api/matches/match-1/join").send({}).expect(200);

      const response = await request(app)
        .post("/api/matches/match-1/moves")
        .send({ boardId: "A", seat: "seat1", move: testCase.move })
        .expect(200);

      const board = response.body.match.boards[0];
      expect(getNestedValue(board, testCase.expected.path)).toBe(testCase.expected.value);
      expect(board.seatsToAct).toEqual(testCase.gameType === "mancala" ? ["seat1"] : ["seat2"]);
    }
  });

  it("rejects move shapes that do not match a Chess game", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({ gameType: "chess" }).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { cell: 0 } })
      .expect(400);

    expect(response.body.error).toBe("invalid-move");
  });

  it("rejects move shapes that do not match the stored game", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({ gameType: "connect4" }).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat1", move: { cell: 0 } })
      .expect(400);

    expect(response.body.error).toBe("invalid-move");
  });

  it("rejects invalid moves", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    const response = await request(app)
      .post("/api/matches/match-1/moves")
      .send({ boardId: "A", seat: "seat2", move: { cell: 0 } })
      .expect(400);

    expect(response.body.error).toBe("seat-not-to-act");
  });

  it("returns the final combined score when both boards finish", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({}).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

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

  it("scores a completed two-board Chess match through generic board outcomes", async () => {
    const app = appWithDeterministicIds();
    await request(app).post("/api/matches").send({ gameType: "chess" }).expect(201);
    await request(app).post("/api/matches/match-1/join").send({}).expect(200);

    for (const command of [
      { boardId: "A", seat: "seat1", move: { from: "f2", to: "f3" } },
      { boardId: "A", seat: "seat2", move: { from: "e7", to: "e5" } },
      { boardId: "A", seat: "seat1", move: { from: "g2", to: "g4" } },
      { boardId: "A", seat: "seat2", move: { from: "d8", to: "h4" } },
      { boardId: "B", seat: "seat2", move: { from: "f2", to: "f3" } },
      { boardId: "B", seat: "seat1", move: { from: "e7", to: "e5" } },
      { boardId: "B", seat: "seat2", move: { from: "g2", to: "g4" } },
      { boardId: "B", seat: "seat1", move: { from: "d8", to: "h4" } }
    ]) {
      await request(app).post("/api/matches/match-1/moves").send(command).expect(200);
    }

    const response = await request(app).get("/api/matches/match-1").expect(200);

    expect(response.body.match.outcome).toEqual({
      status: "completed",
      score: { seat1: 1, seat2: 1 },
      winner: null
    });
    expect(response.body.match.boards[0].outcome).toMatchObject({
      status: "win",
      winner: "seat2",
      reason: "checkmate"
    });
    expect(response.body.match.boards[1].outcome).toMatchObject({
      status: "win",
      winner: "seat1",
      reason: "checkmate"
    });
  });
});

describe("match cleanup", () => {
  it("prunes stale completed and never-joined matches while retaining active matches", async () => {
    let now = 0;
    let idIndex = 0;
    const service = new MatchService({
      createId: () => `match-${++idIndex}`,
      nowMs: () => now
    });

    await service.createMatch("tictactoe");
    await service.joinMatch("match-1");
    await finishDrawnTicTacToe(service, "match-1");
    await service.createMatch("tictactoe");
    await service.createMatch("tictactoe");
    await service.joinMatch("match-3");

    now = 1_000;
    const pruned = await service.pruneStaleMatches(now, 500);

    expect(pruned).toEqual(["match-1", "match-2"]);
    expect(await service.getMatch("match-1")).toBeNull();
    expect(await service.getMatch("match-2")).toBeNull();
    expect((await service.getMatch("match-3"))?.outcome.status).toBe("in_progress");
  });
});

async function finishDrawnTicTacToe(service: MatchService, matchId: string) {
  for (const command of [
    { boardId: "A" as const, seat: "seat1" as const, move: { cell: 0 } },
    { boardId: "A" as const, seat: "seat2" as const, move: { cell: 3 } },
    { boardId: "A" as const, seat: "seat1" as const, move: { cell: 1 } },
    { boardId: "A" as const, seat: "seat2" as const, move: { cell: 4 } },
    { boardId: "A" as const, seat: "seat1" as const, move: { cell: 2 } },
    { boardId: "B" as const, seat: "seat2" as const, move: { cell: 0 } },
    { boardId: "B" as const, seat: "seat1" as const, move: { cell: 3 } },
    { boardId: "B" as const, seat: "seat2" as const, move: { cell: 1 } },
    { boardId: "B" as const, seat: "seat1" as const, move: { cell: 4 } },
    { boardId: "B" as const, seat: "seat2" as const, move: { cell: 2 } }
  ]) {
    const result = await service.applyMove({ id: matchId, ...command });
    expect(result.ok).toBe(true);
  }
}

function getNestedValue(value: unknown, path: readonly (string | number)[]): unknown {
  return path.reduce((current, key) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string | number, unknown>)[key];
  }, value);
}
