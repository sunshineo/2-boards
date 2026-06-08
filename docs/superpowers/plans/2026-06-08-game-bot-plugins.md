# Game Bot Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "play vs bot" support for every FairGame game type using one replaceable bot module per game.

**Architecture:** The framework owns automated seats, cookies, match lifecycle, clocks, and `/agent-moves`. Server and web game registries expose bot capabilities. Chess keeps browser Stockfish behind the same interface, while every non-Chess game gets its own browser-side random legal-move bot module.

**Tech Stack:** TypeScript, Express, React, Vite, Vitest, Supertest, Playwright, existing FairGame domain/server/web packages.

---

## Baseline And Worktree

- [x] Spec approved: `docs/superpowers/specs/2026-06-08-game-bot-plugins-design.md`.
- [x] Worktree ready: `.worktrees/game-bot-plugins-spec` on branch `codex/game-bot-plugins-spec`.
- [x] Before execution, create or reuse an implementation worktree. Continuing in this existing approved-spec worktree on branch `codex/game-bot-plugins-spec` so the spec, plan, and implementation stay together.
- [x] Before first code edit, run baseline verification in `fairgame-rebuild`: `npm run typecheck && npm test` passed after `npm install` restored worktree-local dependencies.

## Files To Change

Server:
- Modify `fairgame-rebuild/apps/server/src/matches/seatAgents.ts` to make `AutomatedSeat` generic and expose factory helpers for plugin-created seats.
- Modify `fairgame-rebuild/apps/server/src/games/registry.ts` to add `bot` metadata to every game definition and export helpers such as `getGameBotCapability`.
- Modify `fairgame-rebuild/apps/server/src/matches/routes.ts` to create bot matches through the selected game definition instead of a Chess-only branch.
- Modify `fairgame-rebuild/apps/server/src/matches/matchRepository.ts`, `matchService.ts`, and `matchView.ts` to import the widened `AutomatedSeat` type without changing snapshot behavior.
- Modify `fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts` and `gameRegistry.test.ts`.

Web:
- Modify `fairgame-rebuild/apps/web/src/types.ts` to make `AutomatedSeat` generic while keeping `BrowserChessBot` compatibility.
- Create `fairgame-rebuild/apps/web/src/games/bots/types.ts`.
- Move/adapt Chess bot implementation into `fairgame-rebuild/apps/web/src/games/bots/chessStockfish.ts`.
- Create one random bot file per non-Chess game under `fairgame-rebuild/apps/web/src/games/bots/`.
- Create `fairgame-rebuild/apps/web/src/games/bots/random.ts` only for shared random selection primitives, not game move logic.
- Modify `fairgame-rebuild/apps/web/src/games/registry.tsx` to expose each game's bot capability.
- Replace or wrap `fairgame-rebuild/apps/web/src/browserChessBot.ts` with generic bot-controller exports plus Chess compatibility exports.
- Modify `fairgame-rebuild/apps/web/src/App.tsx` so bot mode works for every game.
- Modify `fairgame-rebuild/apps/web/src/App.test.tsx`, `api.test.ts`, `browserChessBot.test.ts`, and `games/registry.test.tsx`.
- Add `fairgame-rebuild/apps/web/src/games/bots/randomBots.test.ts`.

Docs:
- Update this plan as tasks complete with verification evidence.

---

## Task 1: Generalize Server Automated Seat And Bot Capabilities

Status: Complete.

Evidence:
- Commits: `87af145` (`Generalize server bot capabilities`) and `6f95dd0` (`Fix server bot capability layering`).
- Verification: `npm test -w @fairgame/server -- gameRegistry.test.ts browserChessBot.test.ts` passed with 12 tests; `npm run test -w @fairgame/server` passed with 65 tests; `npm run typecheck` passed.
- Reviews: spec compliance approved; code quality approved after moving automated-seat types into neutral `apps/server/src/seatAgents/types.ts` and adding non-Chess `/agent-moves` coverage.

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/matches/seatAgents.ts`
- Modify: `fairgame-rebuild/apps/server/src/games/registry.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/gameRegistry.test.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts`

- [ ] **Step 1: Write failing registry and creation tests**

In `fairgame-rebuild/apps/server/src/matches/gameRegistry.test.ts`, extend the imports and add tests:

```ts
import { describe, expect, it } from "vitest";

import { getGameDefinition, supportedGameDefinitions } from "./gameRegistry.js";

describe("game registry", () => {
  it("exposes per-game clock range metadata from game plugins", () => {
    expect(getGameDefinition("tictactoe")).toMatchObject({ clockRange: { min: 1, max: 10 } });
    expect(getGameDefinition("connect4")).toMatchObject({ clockRange: { min: 2, max: 20 } });
    expect(getGameDefinition("chess")).toMatchObject({ clockRange: { min: 3, max: 60 } });
  });

  it("exposes a bot capability for every current game plugin", () => {
    expect(supportedGameDefinitions).toHaveLength(10);
    expect(supportedGameDefinitions.map((definition) => [definition.gameType, definition.bot?.kind])).toEqual([
      ["tictactoe", "random-legal"],
      ["connect4", "random-legal"],
      ["chess", "browser-stockfish"],
      ["gomoku", "random-legal"],
      ["hex", "random-legal"],
      ["reversi", "random-legal"],
      ["breakthrough", "random-legal"],
      ["mancala", "random-legal"],
      ["dots-boxes", "random-legal"],
      ["order-chaos", "random-legal"]
    ]);
  });

  it("creates game-specific automated seats through plugin bot capabilities", () => {
    expect(getGameDefinition("connect4").bot?.createAutomatedSeat("normal")).toEqual({
      seat: "seat2",
      gameType: "connect4",
      kind: "random-legal",
      difficulty: "normal",
      displayName: "Connect Four Bot"
    });
    expect(getGameDefinition("chess").bot?.createAutomatedSeat("hard")).toEqual({
      seat: "seat2",
      gameType: "chess",
      kind: "browser-stockfish",
      difficulty: "hard",
      displayName: "Stockfish Hard"
    });
  });
});
```

In `fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts`, replace the current non-Chess rejection test with a non-Chess success test:

```ts
  it("creates non-Chess bot matches with random legal bot metadata", async () => {
    const response = await request(createTestApp())
      .post("/api/matches")
      .send({ gameType: "tictactoe", bot: { difficulty: "normal" } })
      .expect(201);

    expect(response.body.seat).toBe("seat1");
    expect(response.body.match.joinedSeats).toBe(2);
    expect(response.body.match.automatedSeat).toEqual({
      seat: "seat2",
      kind: "random-legal",
      gameType: "tictactoe",
      difficulty: "normal",
      displayName: "TicTacToe Bot"
    });
    expect(response.body.match.players.seat2.name).toBe("TicTacToe Bot");
    expect(getSetCookies(response).join("\n")).toContain(`fg_agent_${response.body.match.id}=`);
  });
```

Keep the Chess metadata tests unchanged so they protect Stockfish compatibility.

- [ ] **Step 2: Run the RED tests**

Run:

```bash
npm test -w @fairgame/server -- gameRegistry.test.ts browserChessBot.test.ts
```

Expected: FAIL because `supportedGameDefinitions` does not expose `bot`, `AutomatedSeat` is Chess-only, and routes still reject non-Chess bot creation.

- [ ] **Step 3: Implement generic seat-agent metadata**

Replace the top of `fairgame-rebuild/apps/server/src/matches/seatAgents.ts` with:

```ts
import type { SeatId } from "@fairgame/shared";

import type { SupportedGameType } from "./gameRegistry.js";

export type SeatAgentDifficulty = "easy" | "normal" | "hard";
export type SeatAgentKind = "browser-stockfish" | "random-legal";

export type AutomatedSeat = {
  readonly seat: SeatId;
  readonly kind: SeatAgentKind;
  readonly gameType: SupportedGameType;
  readonly difficulty: SeatAgentDifficulty;
  readonly displayName: string;
};

export type SeatAgentControlClaim = {
  readonly matchId: string;
  readonly secret: string;
};

export function parseSeatAgentDifficulty(value: unknown): SeatAgentDifficulty | null {
  return value === "easy" || value === "normal" || value === "hard" ? value : null;
}

export function parseBrowserChessBotDifficulty(value: unknown): SeatAgentDifficulty | null {
  return parseSeatAgentDifficulty(value);
}

export function createAutomatedSeat(input: {
  readonly gameType: SupportedGameType;
  readonly kind: SeatAgentKind;
  readonly difficulty: SeatAgentDifficulty;
  readonly displayName: string;
}): AutomatedSeat {
  return {
    seat: "seat2",
    gameType: input.gameType,
    kind: input.kind,
    difficulty: input.difficulty,
    displayName: input.displayName
  };
}

export function createBrowserStockfishSeatAgent(difficulty: SeatAgentDifficulty): AutomatedSeat {
  return createAutomatedSeat({
    gameType: "chess",
    kind: "browser-stockfish",
    difficulty,
    displayName: getBrowserChessBotDisplayName(difficulty)
  });
}
```

Leave `getBrowserChessBotDisplayName`, cookie helpers, and parsing helpers in place below this block.

- [ ] **Step 4: Add server bot capabilities to game definitions**

In `fairgame-rebuild/apps/server/src/games/registry.ts`, import the generic helpers:

```ts
import { createAutomatedSeat, createBrowserStockfishSeatAgent, type AutomatedSeat, type SeatAgentDifficulty, type SeatAgentKind } from "../matches/seatAgents.js";
```

Add the capability type near `ClockMinuteRange`:

```ts
export type GameBotCapability = {
  readonly kind: SeatAgentKind;
  readonly displayName: string;
  createAutomatedSeat(difficulty: SeatAgentDifficulty): AutomatedSeat;
};
```

Add `readonly bot?: GameBotCapability;` to both `SupportedGameDefinition<TState, TMove>` and `AnySupportedGameDefinition`.

Add helper factories near the type declarations:

```ts
function createRandomLegalBotCapability(gameType: SupportedGameType, displayName: string): GameBotCapability {
  return {
    kind: "random-legal",
    displayName,
    createAutomatedSeat(difficulty) {
      return createAutomatedSeat({ gameType, kind: "random-legal", difficulty, displayName });
    }
  };
}

const chessBotCapability: GameBotCapability = {
  kind: "browser-stockfish",
  displayName: "Stockfish",
  createAutomatedSeat: createBrowserStockfishSeatAgent
};
```

Add `bot` to each definition immediately after `clockRange`:

```ts
// ticTacToeDefinition
bot: createRandomLegalBotCapability("tictactoe", "TicTacToe Bot"),

// connectFourDefinition
bot: createRandomLegalBotCapability("connect4", "Connect Four Bot"),

// chessDefinition
bot: chessBotCapability,

// gomokuDefinition
bot: createRandomLegalBotCapability("gomoku", "Gomoku Bot"),

// hexDefinition
bot: createRandomLegalBotCapability("hex", "Hex Bot"),

// reversiDefinition
bot: createRandomLegalBotCapability("reversi", "Reversi Bot"),

// breakthroughDefinition
bot: createRandomLegalBotCapability("breakthrough", "Breakthrough Bot"),

// mancalaDefinition
bot: createRandomLegalBotCapability("mancala", "Mancala Bot"),

// dotsBoxesDefinition
bot: createRandomLegalBotCapability("dots-boxes", "Dots and Boxes Bot"),

// orderChaosDefinition
bot: createRandomLegalBotCapability("order-chaos", "Order and Chaos Bot"),
```

In `toAnyDefinition`, pass through `bot: definition.bot`.

Export the list if it is not already exported:

```ts
export const supportedGameDefinitions = gameDefinitions.map(toAnyDefinition);
```

- [ ] **Step 5: Route bot creation through game plugin capability**

In `fairgame-rebuild/apps/server/src/matches/routes.ts`, change the imports:

```ts
import { getClockMinuteRange, getGameDefinition, parseSupportedGameType, type SupportedGameType } from "./gameRegistry.js";
import {
  getSeatAgentControlCookieName,
  parseSeatAgentControlCookie,
  parseSeatAgentDifficulty,
  type SeatAgentControlClaim
} from "./seatAgents.js";
```

Replace the Chess-only creation block with:

```ts
    const botDifficulty = parseCreateBotDifficulty(body.bot);
    const gameDefinition = getGameDefinition(gameType);
    const automatedSeat = botDifficulty ? gameDefinition.bot?.createAutomatedSeat(botDifficulty) : undefined;
    if (botDifficulty && !automatedSeat) {
      response.status(400).json({ error: "unsupported-bot-game" });
      return;
    }

    const result = await matchService.createMatch(
      gameType,
      typeof body.playerName === "string" ? body.playerName : undefined,
      clockConfig,
      automatedSeat ? { automatedSeat } : {}
    );
```

Change `parseCreateBotDifficulty`:

```ts
function parseCreateBotDifficulty(value: unknown) {
  if (!isRecord(value)) return null;
  return parseSeatAgentDifficulty(value["difficulty"]);
}
```

- [ ] **Step 6: Run GREEN tests for server bot capability**

Run:

```bash
npm test -w @fairgame/server -- gameRegistry.test.ts browserChessBot.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add fairgame-rebuild/apps/server/src/matches/seatAgents.ts \
  fairgame-rebuild/apps/server/src/games/registry.ts \
  fairgame-rebuild/apps/server/src/matches/routes.ts \
  fairgame-rebuild/apps/server/src/matches/gameRegistry.test.ts \
  fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts
git commit -m "Generalize server bot capabilities"
```

---

## Task 2: Add Web Bot Types And Per-Game Random Bot Modules

Status: Complete.

Evidence:
- Commits: `fab3b27` (`Add per-game random bot modules`) and `136e2d5` (`Harden random bot move guards`).
- Verification: `npm test -w @fairgame/web -- randomBots.test.ts` passed with 12 tests; `npm run typecheck` passed.
- Reviews: spec compliance approved; code quality approved after widening `MatchView.bot` to `AutomatedSeat` and adding active-seat guards to all random bot modules.

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/types.ts`
- Create: `fairgame-rebuild/apps/web/src/games/bots/types.ts`
- Create: `fairgame-rebuild/apps/web/src/games/bots/random.ts`
- Create: one random bot file per non-Chess game under `fairgame-rebuild/apps/web/src/games/bots/`
- Create: `fairgame-rebuild/apps/web/src/games/bots/randomBots.test.ts`

- [ ] **Step 1: Write failing random-bot module tests**

Create `fairgame-rebuild/apps/web/src/games/bots/randomBots.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type {
  BreakthroughBoardView,
  ConnectFourBoardView,
  DotsBoxesBoardView,
  GomokuBoardView,
  HexBoardView,
  MancalaBoardView,
  OrderChaosBoardView,
  ReversiBoardView,
  TicTacToeBoardView
} from "../../types";
import { chooseBreakthroughRandomMove } from "./breakthroughRandom";
import { chooseConnectFourRandomMove } from "./connectFourRandom";
import { chooseDotsBoxesRandomMove } from "./dotsBoxesRandom";
import { chooseGomokuRandomMove } from "./gomokuRandom";
import { chooseHexRandomMove } from "./hexRandom";
import { chooseMancalaRandomMove } from "./mancalaRandom";
import { chooseOrderChaosRandomMove } from "./orderChaosRandom";
import { chooseReversiRandomMove } from "./reversiRandom";
import { chooseTicTacToeRandomMove } from "./tictactoeRandom";

describe("random legal game bots", () => {
  it("chooses TicTacToe empty cells", () => {
    const board = baseBoard("tictactoe", { cells: ["seat1", null, null] }) as TicTacToeBoardView;
    expect([{ cell: 1 }, { cell: 2 }]).toContainEqual(chooseTicTacToeRandomMove({ board, seat: "seat2" }));
  });

  it("chooses Connect Four playable columns", () => {
    const board = baseBoard("connect4", {
      rows: 6,
      columns: 7,
      cells: Array(42).fill(null),
      playableColumns: [2, 4]
    }) as ConnectFourBoardView;
    expect([{ column: 2 }, { column: 4 }]).toContainEqual(chooseConnectFourRandomMove({ board, seat: "seat2" }));
  });

  it("chooses simple playable-cell moves", () => {
    const gomoku = baseBoard("gomoku", { rows: 15, columns: 15, cells: [], playableCells: [10] }) as GomokuBoardView;
    const hex = baseBoard("hex", { size: 11, cells: [], playableCells: [11] }) as HexBoardView;
    const reversi = baseBoard("reversi", { rows: 8, columns: 8, cells: [], playableCells: [20] }) as ReversiBoardView;

    expect(chooseGomokuRandomMove({ board: gomoku, seat: "seat2" })).toEqual({ cell: 10 });
    expect(chooseHexRandomMove({ board: hex, seat: "seat2" })).toEqual({ cell: 11 });
    expect(chooseReversiRandomMove({ board: reversi, seat: "seat2" })).toEqual({ cell: 20 });
  });

  it("chooses Breakthrough, Mancala, Dots and Boxes, and Order and Chaos moves", () => {
    const breakthrough = baseBoard("breakthrough", {
      rows: 8,
      columns: 8,
      cells: [],
      playableMoves: [{ from: 8, to: 16 }]
    }) as BreakthroughBoardView;
    const mancala = baseBoard("mancala", {
      pitsPerSide: 6,
      stonesPerPit: 4,
      pits: Array(12).fill(4),
      stores: { seat1: 0, seat2: 0 },
      playablePits: [3]
    }) as MancalaBoardView;
    const dotsBoxes = baseBoard("dots-boxes", {
      boxRows: 3,
      boxColumns: 3,
      drawnEdges: [],
      boxes: [],
      scores: { seat1: 0, seat2: 0 },
      playableEdges: ["h-0-0"]
    }) as DotsBoxesBoardView;
    const orderChaos = baseBoard("order-chaos", {
      rows: 6,
      columns: 6,
      cells: [],
      orderSeat: "seat1",
      chaosSeat: "seat2",
      playableCells: [5]
    }) as OrderChaosBoardView;

    expect(chooseBreakthroughRandomMove({ board: breakthrough, seat: "seat2" })).toEqual({ from: 8, to: 16 });
    expect(chooseMancalaRandomMove({ board: mancala, seat: "seat2" })).toEqual({ pit: 3 });
    expect(chooseDotsBoxesRandomMove({ board: dotsBoxes, seat: "seat2" })).toEqual({ edge: "h-0-0" });
    expect([{ cell: 5, mark: "X" }, { cell: 5, mark: "O" }]).toContainEqual(
      chooseOrderChaosRandomMove({ board: orderChaos, seat: "seat2" })
    );
  });

  it("returns null when no legal move exists", () => {
    const board = baseBoard("connect4", {
      rows: 6,
      columns: 7,
      cells: Array(42).fill(null),
      playableColumns: []
    }) as ConnectFourBoardView;

    expect(chooseConnectFourRandomMove({ board, seat: "seat2" })).toBeNull();
  });
});

function baseBoard(kind: string, extra: object) {
  return {
    kind,
    id: "A",
    firstSeat: "seat1",
    seatsToAct: ["seat2"],
    outcome: { status: "in_progress" },
    ...extra
  };
}
```

- [ ] **Step 2: Run the RED random-bot tests**

Run:

```bash
npm test -w @fairgame/web -- randomBots.test.ts
```

Expected: FAIL because bot modules do not exist.

- [ ] **Step 3: Generalize web automated-seat types**

In `fairgame-rebuild/apps/web/src/types.ts`, replace the current bot types at the top with:

```ts
export type SeatAgentDifficulty = "easy" | "normal" | "hard";
export type BrowserChessBotDifficulty = SeatAgentDifficulty;
export type SeatAgentKind = "browser-stockfish" | "random-legal";

export type AutomatedSeat = {
  seat: "seat2";
  kind: SeatAgentKind;
  gameType: GameType;
  difficulty: SeatAgentDifficulty;
  displayName: string;
};

export type BrowserChessBot = AutomatedSeat & {
  kind: "browser-stockfish";
  gameType: "chess";
};
```

Keep `bot?: BrowserChessBot;` on `MatchView` for compatibility.

- [ ] **Step 4: Add shared bot module types and random helper**

Create `fairgame-rebuild/apps/web/src/games/bots/types.ts`:

```ts
import type { MatchBoardView, MovePayload, SeatAgentDifficulty, SeatAgentKind, SeatId } from "../../types";

export type BotMoveInput<TBoard extends MatchBoardView = MatchBoardView> = {
  readonly board: TBoard;
  readonly seat: SeatId;
};

export type WebGameBotCapability = {
  readonly kind: SeatAgentKind;
  readonly displayName: string;
  readonly difficulties: readonly SeatAgentDifficulty[];
  chooseMove(input: BotMoveInput): Promise<MovePayload | null>;
};
```

Create `fairgame-rebuild/apps/web/src/games/bots/random.ts`:

```ts
export type RandomSource = () => number;

export function chooseRandom<T>(items: readonly T[], random: RandomSource = Math.random): T | null {
  if (items.length === 0) return null;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] ?? null;
}
```

- [ ] **Step 5: Implement one random bot module per non-Chess game**

Create `fairgame-rebuild/apps/web/src/games/bots/tictactoeRandom.ts`:

```ts
import type { MovePayload, TicTacToeBoardView } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseTicTacToeRandomMove(
  input: BotMoveInput<TicTacToeBoardView>,
  random?: RandomSource
): MovePayload | null {
  const cells = input.board.cells
    .map((cell, index) => (cell === null ? index : null))
    .filter((cell): cell is number => cell !== null);
  const cell = chooseRandom(cells, random);
  return cell === null ? null : { cell };
}
```

Create `connectFourRandom.ts`:

```ts
import type { ConnectFourBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseConnectFourRandomMove(
  input: BotMoveInput<ConnectFourBoardView>,
  random?: RandomSource
): MovePayload | null {
  const column = chooseRandom(input.board.playableColumns, random);
  return column === null ? null : { column };
}
```

Create `gomokuRandom.ts`, `hexRandom.ts`, and `reversiRandom.ts` with this pattern, changing the board type and function name:

```ts
import type { GomokuBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseGomokuRandomMove(
  input: BotMoveInput<GomokuBoardView>,
  random?: RandomSource
): MovePayload | null {
  const cell = chooseRandom(input.board.playableCells, random);
  return cell === null ? null : { cell };
}
```

Create `breakthroughRandom.ts`:

```ts
import type { BreakthroughBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseBreakthroughRandomMove(
  input: BotMoveInput<BreakthroughBoardView>,
  random?: RandomSource
): MovePayload | null {
  const move = chooseRandom(input.board.playableMoves, random);
  return move === null ? null : { from: move.from, to: move.to };
}
```

Create `mancalaRandom.ts`:

```ts
import type { MancalaBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseMancalaRandomMove(
  input: BotMoveInput<MancalaBoardView>,
  random?: RandomSource
): MovePayload | null {
  const pit = chooseRandom(input.board.playablePits, random);
  return pit === null ? null : { pit };
}
```

Create `dotsBoxesRandom.ts`:

```ts
import type { DotsBoxesBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseDotsBoxesRandomMove(
  input: BotMoveInput<DotsBoxesBoardView>,
  random?: RandomSource
): MovePayload | null {
  const edge = chooseRandom(input.board.playableEdges, random);
  return edge === null ? null : { edge };
}
```

Create `orderChaosRandom.ts`:

```ts
import type { MovePayload, OrderChaosBoardView } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseOrderChaosRandomMove(
  input: BotMoveInput<OrderChaosBoardView>,
  random?: RandomSource
): MovePayload | null {
  const cell = chooseRandom(input.board.playableCells, random);
  if (cell === null) return null;
  const mark = chooseRandom(["X", "O"] as const, random) ?? "X";
  return { cell, mark };
}
```

- [ ] **Step 6: Run GREEN random-bot tests**

Run:

```bash
npm test -w @fairgame/web -- randomBots.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add fairgame-rebuild/apps/web/src/types.ts \
  fairgame-rebuild/apps/web/src/games/bots
git commit -m "Add per-game random bot modules"
```

---

## Task 3: Register Web Bot Capabilities

Status: Complete.

Evidence:
- Commits: `75efe26` (`Register web bot capabilities`) and `8f5acbd` (`Make web bot capability contracts honest`).
- Verification: `npm test -w @fairgame/web -- registry.test.tsx randomBots.test.ts browserChessBot.test.ts` passed with 22 tests; `npm run typecheck` passed.
- Reviews: spec compliance approved; code quality approved after making `browser-stockfish` metadata-only and removing circular dependency from `games/bots/chessStockfish.ts` to `browserChessBot.ts`.

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/games/registry.tsx`
- Modify: `fairgame-rebuild/apps/web/src/games/registry.test.tsx`
- Create: `fairgame-rebuild/apps/web/src/games/bots/chessStockfish.ts`
- Modify: `fairgame-rebuild/apps/web/src/browserChessBot.ts`

- [ ] **Step 1: Write failing web registry tests**

Extend `fairgame-rebuild/apps/web/src/games/registry.test.tsx`:

```ts
  it("exposes bot capabilities for every game", () => {
    expect(webGamePlugins.map((plugin) => [plugin.gameType, plugin.bot?.kind])).toEqual([
      ["chess", "browser-stockfish"],
      ["tictactoe", "random-legal"],
      ["connect4", "random-legal"],
      ["gomoku", "random-legal"],
      ["hex", "random-legal"],
      ["reversi", "random-legal"],
      ["breakthrough", "random-legal"],
      ["mancala", "random-legal"],
      ["dots-boxes", "random-legal"],
      ["order-chaos", "random-legal"]
    ]);
    expect(getWebGamePlugin("connect4")?.bot).toMatchObject({
      displayName: "Connect Four Bot",
      difficulties: ["normal"]
    });
    expect(getWebGamePlugin("chess")?.bot).toMatchObject({
      displayName: "Stockfish",
      difficulties: ["easy", "normal", "hard"]
    });
  });
```

- [ ] **Step 2: Run RED web registry test**

Run:

```bash
npm test -w @fairgame/web -- registry.test.tsx
```

Expected: FAIL because `WebGamePlugin` has no `bot` field.

- [ ] **Step 3: Move Stockfish behind a web bot capability**

Create `fairgame-rebuild/apps/web/src/games/bots/chessStockfish.ts`:

```ts
export {
  browserChessBotPresets,
  createBrowserChessBotController,
  createStockfishEngine,
  getBrowserChessBotTiming,
  selectBrowserChessBotAction,
  toChessMovePayloadFromUci,
  type BrowserChessBotAction,
  type BrowserChessBotController,
  type BrowserChessBotEngine,
  type BrowserChessBotPreset,
  type BrowserChessBotStatus,
  type BrowserChessBotTiming
} from "../../browserChessBot";
```

This compatibility-first file makes the registry depend on a Chess bot module while preserving the existing Stockfish implementation and tests.

- [ ] **Step 4: Add bot capabilities to web registry**

In `fairgame-rebuild/apps/web/src/games/registry.tsx`, import bot types and chooser functions:

```ts
import { selectBrowserChessBotAction } from "./bots/chessStockfish";
import { chooseBreakthroughRandomMove } from "./bots/breakthroughRandom";
import { chooseConnectFourRandomMove } from "./bots/connectFourRandom";
import { chooseDotsBoxesRandomMove } from "./bots/dotsBoxesRandom";
import { chooseGomokuRandomMove } from "./bots/gomokuRandom";
import { chooseHexRandomMove } from "./bots/hexRandom";
import { chooseMancalaRandomMove } from "./bots/mancalaRandom";
import { chooseOrderChaosRandomMove } from "./bots/orderChaosRandom";
import { chooseReversiRandomMove } from "./bots/reversiRandom";
import { chooseTicTacToeRandomMove } from "./bots/tictactoeRandom";
import type { BotMoveInput, WebGameBotCapability } from "./bots/types";
```

Add `readonly bot?: WebGameBotCapability;` to `WebGamePlugin`.

Add helper capabilities above `webGamePlugins`:

```ts
const chessBotCapability: WebGameBotCapability = {
  kind: "browser-stockfish",
  displayName: "Stockfish",
  difficulties: ["easy", "normal", "hard"],
  async chooseMove(input) {
    const action = selectBrowserChessBotAction({
      id: "plugin-preview",
      gameType: "chess",
      gameLabel: "Chess",
      seats: ["seat1", "seat2"],
      joinedSeats: 2,
      maxSeats: 2,
      players: {
        seat1: { label: "Player 1", name: "Player 1" },
        seat2: { label: "Player 2", name: "Stockfish" }
      },
      outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
      clock: null,
      boards: [input.board],
      automatedSeat: {
        seat: "seat2",
        kind: "browser-stockfish",
        gameType: "chess",
        difficulty: "normal",
        displayName: "Stockfish"
      }
    });
    return action?.kind === "control" ? action.move : null;
  }
};

function randomBotCapability(
  displayName: string,
  chooseMove: WebGameBotCapability["chooseMove"]
): WebGameBotCapability {
  return {
    kind: "random-legal",
    displayName,
    difficulties: ["normal"],
    chooseMove
  };
}
```

For Chess, the generic controller in Task 4 will still use the existing Stockfish controller directly; this registry capability establishes metadata and keeps `chooseMove` available for control actions.

Add `bot` to each plugin:

```ts
// chess plugin
bot: chessBotCapability

// tictactoe plugin
bot: randomBotCapability("TicTacToe Bot", async (input) =>
  input.board.kind === "tictactoe" ? chooseTicTacToeRandomMove({ board: input.board, seat: input.seat }) : null
)

// connect4 plugin
bot: randomBotCapability("Connect Four Bot", async (input) =>
  input.board.kind === "connect4" ? chooseConnectFourRandomMove({ board: input.board, seat: input.seat }) : null
)

// gomoku plugin
bot: randomBotCapability("Gomoku Bot", async (input) =>
  input.board.kind === "gomoku" ? chooseGomokuRandomMove({ board: input.board, seat: input.seat }) : null
)

// hex plugin
bot: randomBotCapability("Hex Bot", async (input) =>
  input.board.kind === "hex" ? chooseHexRandomMove({ board: input.board, seat: input.seat }) : null
)

// reversi plugin
bot: randomBotCapability("Reversi Bot", async (input) =>
  input.board.kind === "reversi" ? chooseReversiRandomMove({ board: input.board, seat: input.seat }) : null
)

// breakthrough plugin
bot: randomBotCapability("Breakthrough Bot", async (input) =>
  input.board.kind === "breakthrough" ? chooseBreakthroughRandomMove({ board: input.board, seat: input.seat }) : null
)

// mancala plugin
bot: randomBotCapability("Mancala Bot", async (input) =>
  input.board.kind === "mancala" ? chooseMancalaRandomMove({ board: input.board, seat: input.seat }) : null
)

// dots-boxes plugin
bot: randomBotCapability("Dots and Boxes Bot", async (input) =>
  input.board.kind === "dots-boxes" ? chooseDotsBoxesRandomMove({ board: input.board, seat: input.seat }) : null
)

// order-chaos plugin
bot: randomBotCapability("Order and Chaos Bot", async (input) =>
  input.board.kind === "order-chaos" ? chooseOrderChaosRandomMove({ board: input.board, seat: input.seat }) : null
)
```

- [ ] **Step 5: Run GREEN web registry tests**

Run:

```bash
npm test -w @fairgame/web -- registry.test.tsx randomBots.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add fairgame-rebuild/apps/web/src/games/registry.tsx \
  fairgame-rebuild/apps/web/src/games/registry.test.tsx \
  fairgame-rebuild/apps/web/src/games/bots/chessStockfish.ts
git commit -m "Register web bot capabilities"
```

---

## Task 4: Add Generic Browser Bot Controller

Status: Complete.

Evidence:
- Commits: `eae82d0` (`Add generic browser bot controller`) and `1093b71` (`Cancel stale random bot runs`).
- Verification: `npm test -w @fairgame/web -- browserChessBot.test.ts registry.test.tsx randomBots.test.ts` passed with 23 tests; `npm test -w @fairgame/web -- browserChessBot.test.ts` passed with 10 tests after cancellation fix; `npm run typecheck` passed.
- Reviews: spec compliance approved; code quality approved after adding run-generation cancellation for disposed random bot runs.

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/browserChessBot.ts`
- Modify: `fairgame-rebuild/apps/web/src/browserChessBot.test.ts`
- Modify: `fairgame-rebuild/apps/web/src/api.test.ts`

- [ ] **Step 1: Write failing controller test for non-Chess bot**

In `fairgame-rebuild/apps/web/src/browserChessBot.test.ts`, add:

```ts
import { createBrowserGameBotController } from "./browserChessBot";
```

Add a test near the controller tests:

```ts
  it("submits random legal moves for non-Chess automated seats through the generic controller", async () => {
    const submitted: unknown[] = [];
    const controller = createBrowserGameBotController({
      submitMove: async (input) => {
        submitted.push(input);
      }
    });
    const match = createConnectFourBotMatch();

    await controller.runForMatch(match);

    expect(submitted).toEqual([{ boardId: "B", move: { column: 0 } }]);
  });
```

Add this fixture at the bottom:

```ts
function createConnectFourBotMatch(): MatchView {
  return {
    id: "match-connect4-bot",
    gameType: "connect4",
    gameLabel: "Connect Four",
    seats: ["seat1", "seat2"],
    joinedSeats: 2,
    maxSeats: 2,
    players: {
      seat1: { label: "Player 1", name: "Player 1" },
      seat2: { label: "Player 2", name: "Connect Four Bot" }
    },
    outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
    clock: null,
    automatedSeat: {
      seat: "seat2",
      kind: "random-legal",
      gameType: "connect4",
      difficulty: "normal",
      displayName: "Connect Four Bot"
    },
    boards: [
      {
        kind: "connect4",
        id: "A",
        firstSeat: "seat1",
        rows: 6,
        columns: 7,
        cells: Array(42).fill(null),
        playableColumns: [0],
        seatsToAct: ["seat1"],
        outcome: { status: "in_progress" }
      },
      {
        kind: "connect4",
        id: "B",
        firstSeat: "seat2",
        rows: 6,
        columns: 7,
        cells: Array(42).fill(null),
        playableColumns: [0],
        seatsToAct: ["seat2"],
        outcome: { status: "in_progress" }
      }
    ]
  };
}
```

- [ ] **Step 2: Run RED controller test**

Run:

```bash
npm test -w @fairgame/web -- browserChessBot.test.ts
```

Expected: FAIL because `createBrowserGameBotController` does not exist.

- [ ] **Step 3: Implement generic controller while preserving Chess exports**

In `fairgame-rebuild/apps/web/src/browserChessBot.ts`, import the registry:

```ts
import { getWebGamePlugin } from "./games/registry";
```

Add status and controller aliases:

```ts
export type BrowserGameBotStatus = BrowserChessBotStatus;

export type BrowserGameBotController = {
  runForMatch(match: MatchView): Promise<void>;
  dispose(): void;
};

type BrowserGameBotControllerOptions = {
  readonly submitMove: (input: { readonly boardId: BoardId; readonly move: MovePayload }) => Promise<void>;
  readonly onStatus?: (status: BrowserGameBotStatus) => void;
};
```

Add the generic controller above `createBrowserChessBotController`:

```ts
export function createBrowserGameBotController(options: BrowserGameBotControllerOptions): BrowserGameBotController {
  let chessController: BrowserChessBotController | null = null;
  let isRunning = false;
  let isDisposed = false;

  function getChessController() {
    if (!chessController) {
      chessController = createBrowserChessBotController(options);
    }
    return chessController;
  }

  return {
    async runForMatch(match) {
      if (isDisposed || isRunning) return;
      const automatedSeat = match.automatedSeat ?? match.bot ?? null;
      if (!automatedSeat || match.outcome.status !== "in_progress") {
        options.onStatus?.("idle");
        return;
      }

      if (automatedSeat.kind === "browser-stockfish") {
        await getChessController().runForMatch(match);
        return;
      }

      const plugin = getWebGamePlugin(match.gameType);
      if (!plugin?.bot || plugin.bot.kind !== automatedSeat.kind) {
        options.onStatus?.("error");
        return;
      }

      const board = match.boards.find(
        (candidate) =>
          candidate.kind === match.gameType &&
          candidate.outcome.status === "in_progress" &&
          candidate.seatsToAct.includes(automatedSeat.seat)
      );
      if (!board) {
        options.onStatus?.("idle");
        return;
      }

      isRunning = true;
      try {
        options.onStatus?.("thinking");
        await waitForBotMoveTime(250);
        const move = await plugin.bot.chooseMove({ board, seat: automatedSeat.seat });
        if (!move) {
          options.onStatus?.("idle");
          return;
        }
        await options.submitMove({ boardId: board.id, move });
        options.onStatus?.("idle");
      } catch {
        options.onStatus?.("error");
      } finally {
        isRunning = false;
      }
    },

    dispose() {
      isDisposed = true;
      chessController?.dispose();
      chessController = null;
      options.onStatus?.("idle");
    }
  };
}
```

If `waitForBotMoveTime` is private below, keep it in the same file so the generic controller can call it.

- [ ] **Step 4: Run GREEN controller tests**

Run:

```bash
npm test -w @fairgame/web -- browserChessBot.test.ts registry.test.tsx randomBots.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add fairgame-rebuild/apps/web/src/browserChessBot.ts \
  fairgame-rebuild/apps/web/src/browserChessBot.test.ts
git commit -m "Add generic browser bot controller"
```

---

## Task 5: Wire Lobby And App To Generic Bot Capabilities

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing lobby tests**

In `fairgame-rebuild/apps/web/src/App.test.tsx`, add or update tests:

```ts
  it("shows bot mode controls for non-Chess games", async () => {
    vi.stubGlobal("fetch", createFetchMock({ matches: [] }));
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Connect Four lobby" }));

    expect(screen.getByRole("group", { name: "Opponent" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Human" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bot" })).toBeVisible();
  });

  it("creates a non-Chess bot match with normal difficulty", async () => {
    const botSession = createConnectFourSeatSession("match-connect4-bot");
    botSession.match.automatedSeat = {
      seat: "seat2",
      kind: "random-legal",
      gameType: "connect4",
      difficulty: "normal",
      displayName: "Connect Four Bot"
    };
    botSession.match.players.seat2.name = "Connect Four Bot";
    const fetchMock = createFetchMock({ matches: [], seatSession: botSession });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Connect Four lobby" }));
    await userEvent.click(screen.getByRole("button", { name: "Bot" }));
    await userEvent.click(screen.getByRole("button", { name: "Create Connect Four match" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ gameType: "connect4", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      })
    );
    expect(await screen.findByTestId("match-opponent-name")).toHaveTextContent("Connect Four Bot");
  });
```

Add this fixture near `createTicTacToeSeatSession`:

```ts
function createConnectFourSeatSession(id: string) {
  return {
    seat: "seat1",
    match: {
      id,
      gameType: "connect4",
      gameLabel: "Connect Four",
      seats: ["seat1", "seat2"],
      joinedSeats: 2,
      maxSeats: 2,
      players: createPlayersMock(),
      outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
      clock: createClockMock(),
      boards: [
        {
          kind: "connect4",
          id: "A",
          firstSeat: "seat1",
          rows: 6,
          columns: 7,
          cells: Array(42).fill(null),
          playableColumns: [0],
          seatsToAct: ["seat1"],
          outcome: { status: "in_progress" }
        },
        {
          kind: "connect4",
          id: "B",
          firstSeat: "seat2",
          rows: 6,
          columns: 7,
          cells: Array(42).fill(null),
          playableColumns: [0],
          seatsToAct: ["seat2"],
          outcome: { status: "in_progress" }
        }
      ]
    }
  };
}
```

- [ ] **Step 2: Run RED lobby tests**

Run:

```bash
npm test -w @fairgame/web -- App.test.tsx
```

Expected: FAIL because bot mode is Chess-only.

- [ ] **Step 3: Replace Chess-only lobby mode state with generic bot mode**

In `fairgame-rebuild/apps/web/src/App.tsx`:

Change state:

```ts
const [createMode, setCreateMode] = useState<"human" | "bot">("human");
const [botDifficulty, setBotDifficulty] = useState<BrowserChessBotDifficulty>("normal");
```

Delete the old `chessCreateMode` state after replacing all references with `createMode`.

Derive plugin bot metadata near other lobby derived values:

```ts
const selectedGamePlugin = lobbyGame ? getWebGamePlugin(lobbyGame) : null;
const selectedBotCapability = selectedGamePlugin?.bot ?? null;
const shouldCreateBot = selectedBotCapability !== null && createMode === "bot";
const selectedBotDifficulty = selectedBotCapability?.difficulties.includes(botDifficulty) ? botDifficulty : "normal";
```

Update `handleCreate`:

```ts
async function handleCreate(minutes = customMinutes) {
  if (!lobbyGame) return;
  const shouldCreateBotForGame = selectedBotCapability !== null && createMode === "bot";
  setIsCreatingBrowserBotGame(shouldCreateBotForGame);
  try {
    await run(async () => {
      const nextSession = await createMatch(lobbyGame, {
        clockInitialMs: minutesToMs(minutes, lobbyGame),
        ...(shouldCreateBotForGame ? { bot: { difficulty: selectedBotDifficulty } } : {})
      });
      setSession(nextSession);
      navigateTo({ view: "match", matchId: nextSession.match.id });
    });
  } finally {
    setIsCreatingBrowserBotGame(false);
  }
}
```

Replace the Chess-only opponent UI with:

```tsx
{selectedBotCapability ? (
  <div className="mode-section" aria-label={`${selectedGameLabel} opponent`}>
    <div className="mode-toggle" role="group" aria-label="Opponent">
      <button
        aria-pressed={createMode === "human"}
        className={createMode === "human" ? "selected" : ""}
        disabled={isBusy}
        onClick={() => setCreateMode("human")}
        type="button"
      >
        Human
      </button>
      <button
        aria-pressed={createMode === "bot"}
        className={createMode === "bot" ? "selected" : ""}
        disabled={isBusy}
        onClick={() => setCreateMode("bot")}
        type="button"
      >
        Bot
      </button>
    </div>
    {createMode === "bot" && selectedBotCapability.difficulties.length > 1 ? (
      <div className="difficulty-grid" role="group" aria-label="Bot difficulty">
        {selectedBotCapability.difficulties.map((difficulty) => (
          <button
            aria-pressed={botDifficulty === difficulty}
            className={botDifficulty === difficulty ? "selected" : ""}
            disabled={isBusy}
            key={difficulty}
            onClick={() => setBotDifficulty(difficulty)}
            type="button"
          >
            {formatBotDifficulty(difficulty)}
          </button>
        ))}
      </div>
    ) : null}
  </div>
) : null}
```

For difficulty controls:

```tsx
{createMode === "bot" && selectedBotCapability.difficulties.length > 1 ? (
  <div className="difficulty-grid" role="group" aria-label="Bot difficulty">
    {selectedBotCapability.difficulties.map((difficulty) => (
      <button
        aria-pressed={botDifficulty === difficulty}
        className={botDifficulty === difficulty ? "selected" : ""}
        disabled={isBusy}
        key={difficulty}
        onClick={() => setBotDifficulty(difficulty)}
        type="button"
      >
        {formatBotDifficulty(difficulty)}
      </button>
    ))}
  </div>
) : null}
```

Add helper:

```ts
function formatBotDifficulty(difficulty: BrowserChessBotDifficulty) {
  if (difficulty === "easy") return "Easy";
  if (difficulty === "hard") return "Hard";
  return "Normal";
}
```

Change create button pending label to remain generic:

```tsx
{isCreatingBrowserBotGame ? "Creating bot game" : `Create ${selectedGameLabel} match`}
```

- [ ] **Step 4: Use generic controller in App**

Change imports from:

```ts
import { createBrowserChessBotController, type BrowserChessBotController, type BrowserChessBotStatus } from "./browserChessBot";
```

to:

```ts
import { createBrowserGameBotController, type BrowserGameBotController, type BrowserGameBotStatus } from "./browserChessBot";
```

Change refs and effects:

```ts
const browserBotControllerRef = useRef<BrowserGameBotController | null>(null);

const matchId = activeAutomatedSeat ? activeSession?.match.id ?? null : null;

const controller = createBrowserGameBotController({
  onStatus: setBrowserBotStatus,
  submitMove: async ({ boardId, move }) => {
    const match = await makeAgentMove({ matchId, boardId, move });
    setSession((current) => (current?.match.id === match.id ? { ...current, match } : current));
  }
});

if (!activeAutomatedSeat || !activeSession) return;
void browserBotControllerRef.current?.runForMatch(activeSession.match);
```

Change status visibility from Stockfish-only to all automated seats:

```ts
const activeBrowserBotStatus = activeAutomatedSeat ? browserBotStatus : "idle";
const shouldShowFloatingBotStatus =
  activeAutomatedSeat !== null &&
  activeBrowserBotStatus !== "idle" &&
  activeBrowserBotStatus !== "thinking" &&
  !isChessZenModeActive;
```

Keep existing Chess Zen behavior tied to Chess only.

- [ ] **Step 5: Run GREEN lobby/App tests**

Run:

```bash
npm test -w @fairgame/web -- App.test.tsx browserChessBot.test.ts registry.test.tsx randomBots.test.ts api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add fairgame-rebuild/apps/web/src/App.tsx \
  fairgame-rebuild/apps/web/src/App.test.tsx \
  fairgame-rebuild/apps/web/src/browserChessBot.ts \
  fairgame-rebuild/apps/web/src/browserChessBot.test.ts
git commit -m "Enable bot mode for every game lobby"
```

---

## Task 6: Server Route And Agent-Move Integration Tests

Status: Complete early in Task 1 follow-up.

Evidence:
- Commit: `6f95dd0` (`Fix server bot capability layering`).
- Verification: `npm test -w @fairgame/server -- gameRegistry.test.ts browserChessBot.test.ts` passed with 12 tests.
- Coverage added: TicTacToe bot match posts to `/agent-moves` with the `fg_agent_*` cookie, applies board B cell 0 as `seat2`, and advances `seat1` clock state.

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts`

- [ ] **Step 1: Add failing authorized non-Chess agent move test**

In `fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts`, add:

```ts
  it("applies authorized non-Chess agent moves as the automated seat", async () => {
    const app = createTestApp();
    const created = await request(app)
      .post("/api/matches")
      .send({ gameType: "tictactoe", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      .expect(201);

    const moved = await request(app)
      .post(`/api/matches/${created.body.match.id}/agent-moves`)
      .set("Cookie", getSetCookies(created))
      .send({ boardId: "B", move: { cell: 0 } })
      .expect(200);

    const boardB = findBoard(moved.body.match, "B");
    expect(boardB?.cells[0]).toBe("seat2");
    expect(moved.body.match.clock.runningSeats).toContain("seat1");
  });
```

- [ ] **Step 2: Run GREEN integration test**

Run:

```bash
npm test -w @fairgame/server -- browserChessBot.test.ts
```

Expected: PASS because Task 1 wires bot creation through game plugins and existing `/agent-moves` already applies moves as `stored.automatedSeat.seat`.

- [ ] **Step 3: Run focused server tests**

Run:

```bash
npm test -w @fairgame/server -- gameRegistry.test.ts browserChessBot.test.ts matches.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Task 6**

```bash
git add fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts
git commit -m "Cover non-chess agent bot moves"
```

---

## Task 7: Final Verification And Browser Checks

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-game-bot-plugins.md`

- [ ] **Step 1: Run full static and unit verification**

Run from `fairgame-rebuild`:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 2: Run official e2e if local `DATABASE_URL` is configured**

Check without printing secret values:

```bash
node -e 'console.log(Boolean(process.env.DATABASE_URL) ? "DATABASE_URL=set" : "DATABASE_URL=unset")'
```

If set, run:

```bash
npm run test:e2e
```

Expected: 6 Playwright tests pass.

If unset, record that official e2e could not start the DB-backed server in this shell, then use Step 3.

- [ ] **Step 3: Run supplementary browser verification with temporary no-persistence API**

Start temporary API from `fairgame-rebuild`:

```bash
PORT=4210 npx tsx -e 'import { createServer } from "node:http"; import { Server } from "socket.io"; import { createApp } from "./apps/server/src/app.ts"; import { loadServerConfig } from "./apps/server/src/config.ts"; import { MatchService } from "./apps/server/src/matches/matchService.ts"; import { registerRealtime } from "./apps/server/src/realtime.ts"; const config = loadServerConfig({ DATABASE_URL: "postgresql://local/fairgame", PORT: process.env.PORT, FAIRGAME_ALLOWED_ORIGINS: "http://localhost:5177", FAIRGAME_RATE_LIMIT_MAX: "10000", FAIRGAME_LOG_LEVEL: "fatal" }, process.cwd()); const matchService = new MatchService(); const app = createApp({ config, matchService, logger: false }); const server = createServer(app); const io = new Server(server, { cors: { origin: ["http://localhost:5177"], credentials: true } }); registerRealtime(io, matchService); server.listen(config.port, "localhost", () => console.log(`ephemeral api listening on ${config.port}`));'
```

Start web:

```bash
VITE_API_URL=http://localhost:4210 npm run dev -w @fairgame/web -- --host localhost --port 5177
```

Run:

```bash
PLAYWRIGHT_REUSE_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:5177 PLAYWRIGHT_API_URL=http://localhost:4210 npm run test:e2e
```

Expected: existing Playwright suite passes. Manually inspect at `http://localhost:5177/`:

- Chess bot match still creates and Stockfish moves.
- Connect Four or TicTacToe bot match creates and the bot responds.

Stop temporary servers after verification.

- [ ] **Step 4: Update plan evidence**

Record:

- Commit hashes for completed tasks.
- Verification commands and pass/fail results.
- Any e2e environment limitation.
- Browser verification result.

- [ ] **Step 5: Commit final evidence**

```bash
git add docs/superpowers/plans/2026-06-08-game-bot-plugins.md
git commit -m "Record game bot plugin evidence"
```

---

## Final Merge Checklist

- [ ] `git status --short` is clean in the implementation worktree.
- [ ] `git pull --ff-only origin main` succeeds in the primary checkout.
- [ ] Merge branch into `main`.
- [ ] Run `npm run typecheck && npm test && npm run build` from merged `main`.
- [ ] Push `main`.
- [ ] Remove the task worktree and delete the merged branch.
