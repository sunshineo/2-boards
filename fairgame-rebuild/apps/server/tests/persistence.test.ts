import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";

import type { SupportedGameState } from "../src/matches/gameRegistry";
import { MatchService } from "../src/matches/matchService";
import { PostgresMatchRepository } from "../src/persistence/postgresMatchRepository";

type ClosableRepository = PostgresMatchRepository<SupportedGameState>;

const repositories: ClosableRepository[] = [];

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.close()));
});

describe("Postgres match persistence", () => {
  it("records the initial schema migration once", async () => {
    const repository = await createRepository();
    expect(await repository.listAppliedMigrations()).toEqual(["001_initial_persistence"]);

    await repository.initialize();
    expect(await repository.listAppliedMigrations()).toEqual(["001_initial_persistence"]);
  });

  it("restores an active match from snapshots and continues from the restored state", async () => {
    let secretIndex = 0;
    const repository = await createRepository();
    const service = new MatchService({
      createId: () => "match-1",
      createSecret: () => `secret-${++secretIndex}`,
      repository
    });
    await service.loadFromRepository();

    await service.createMatch("tictactoe");
    await service.joinMatch("match-1");
    const firstMove = await service.applyMove({
      id: "match-1",
      boardId: "A",
      seat: "seat1",
      move: { cell: 0 }
    });
    expect(firstMove.ok).toBe(true);
    expect(await repository.countEvents("match-1")).toBe(3);

    const restoredService = new MatchService({ repository });
    await restoredService.loadFromRepository();

    const restoredMatch = await restoredService.getMatch("match-1");
    expect(restoredMatch?.boards[0]?.cells[0]).toBe("seat1");
    expect(restoredMatch?.boards[0]?.seatsToAct).toEqual(["seat2"]);
    expect((await restoredService.restoreSession("match-1", "seat1.secret-1"))?.seat).toBe("seat1");

    const continued = await restoredService.applyMove({
      id: "match-1",
      boardId: "A",
      seat: "seat2",
      move: { cell: 3 }
    });

    expect(continued.ok).toBe(true);
    expect((await restoredService.getMatch("match-1"))?.boards[0]?.cells[3]).toBe("seat2");
    expect(await repository.countEvents("match-1")).toBe(4);
  });

  it("prunes stale snapshots while preserving event history", async () => {
    let now = 0;
    const repository = await createRepository();
    const service = new MatchService({
      createId: () => "match-1",
      createSecret: () => "secret",
      nowMs: () => now,
      repository
    });
    await service.loadFromRepository();

    await service.createMatch("tictactoe");
    await service.joinMatch("match-1");
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
      expect((await service.applyMove({ id: "match-1", ...command })).ok).toBe(true);
    }

    const eventCountBeforePrune = await repository.countEvents("match-1");
    expect(await repository.loadSnapshots()).toHaveLength(1);

    now = 1_000;
    expect(await service.pruneStaleMatches(now, 500)).toEqual(["match-1"]);

    expect(await repository.loadSnapshots()).toHaveLength(0);
    expect(await repository.countEvents("match-1")).toBe(eventCountBeforePrune + 1);
  });
});

async function createRepository() {
  const database = newDb({ noAstCoverageCheck: true });
  const adapter = database.adapters.createPg();
  const pool = new adapter.Pool();
  const repository = PostgresMatchRepository.fromPool<SupportedGameState>(pool);
  repositories.push(repository);
  await repository.initialize();
  return repository;
}
