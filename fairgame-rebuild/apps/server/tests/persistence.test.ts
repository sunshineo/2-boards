import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import type { SupportedGameState } from "../src/matches/gameRegistry";
import { MatchService } from "../src/matches/matchService";
import { PgliteMatchRepository } from "../src/persistence/pgliteMatchRepository";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("PGlite match persistence", () => {
  it("restores an active match from snapshots and continues from the restored state", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "fairgame-pglite-"));
    tempDirs.push(tempDir);
    const dataDir = join(tempDir, "db");

    let secretIndex = 0;
    const repository = await PgliteMatchRepository.open<SupportedGameState>(dataDir);
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
    await repository.close();

    const restoredRepository = await PgliteMatchRepository.open<SupportedGameState>(dataDir);
    const restoredService = new MatchService({ repository: restoredRepository });
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
    expect(await restoredRepository.countEvents("match-1")).toBe(4);
    await restoredRepository.close();
  });
});
