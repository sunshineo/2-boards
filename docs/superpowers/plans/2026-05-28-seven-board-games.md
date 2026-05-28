# Seven Board Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gomoku, Hex, Reversi, Breakthrough, Mancala, Dots and Boxes, and Order and Chaos to the FairGame rebuild.

**Architecture:** Each game gets an isolated domain rules module first, implemented in a worker branch with focused tests. The gate branch integrates those modules through the server registry and web board renderers after worker branches are merged.

**Tech Stack:** TypeScript, Vitest, Express API tests with supertest, React/Vite, Playwright, npm workspaces.

---

## File Structure

- Create `fairgame-rebuild/packages/domain/src/games/gomoku.ts` and `.test.ts` for 15 by 15 placement rules.
- Create `fairgame-rebuild/packages/domain/src/games/hex.ts` and `.test.ts` for 11 by 11 connection rules.
- Create `fairgame-rebuild/packages/domain/src/games/reversi.ts` and `.test.ts` for Othello-style flipping rules.
- Create `fairgame-rebuild/packages/domain/src/games/breakthrough.ts` and `.test.ts` for pawn movement rules.
- Create `fairgame-rebuild/packages/domain/src/games/mancala.ts` and `.test.ts` for Kalah rules.
- Create `fairgame-rebuild/packages/domain/src/games/dotsBoxes.ts` and `.test.ts` for edge and box rules.
- Create `fairgame-rebuild/packages/domain/src/games/orderChaos.ts` and `.test.ts` for Order and Chaos placement rules.
- Modify `fairgame-rebuild/packages/domain/src/index.ts` once in the gate branch to export all new modules.
- Modify `fairgame-rebuild/apps/server/src/matches/gameRegistry.ts` once in the gate branch to register all new games and board views.
- Modify `fairgame-rebuild/apps/server/src/matches/routes.ts` once in the gate branch to apply clock ranges for all games.
- Modify `fairgame-rebuild/apps/server/tests/matches.test.ts` once in the gate branch to cover creation and representative moves.
- Modify `fairgame-rebuild/apps/web/src/types.ts`, `App.tsx`, `App.test.tsx`, `styles.css`, and `tests/e2e/tictactoe.spec.ts` once in the gate branch for UI and e2e coverage.
- Create thumbnail assets under `fairgame-rebuild/apps/web/public/game-thumbnails/`.
- Update `roadmap.md` with status, evidence, verification, and the final gate branch commit hash.

## Durable Task List

### Task 1: Gomoku Domain Worker

**Status:** Not started

**Worker branch/worktree:** `codex/game-gomoku` at `.worktrees/game-gomoku`

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/gomoku.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/gomoku.test.ts`

- [ ] Write failing tests for initial state, legal placement, occupied cell rejection, wrong-seat rejection, row/column/diagonal five wins, and full-board draw.
- [ ] Run `npm test -w @fairgame/domain -- gomoku` and confirm the tests fail because `gomokuRules` is missing.
- [ ] Implement `gomokuRules` with `gameType: "gomoku"`, move shape `{ cell: number }`, 225 cells, alternating turns, outcome detection, and draw detection.
- [ ] Run `npm test -w @fairgame/domain -- gomoku` and confirm it passes.
- [ ] Commit with `feat: add gomoku rules`.

### Task 2: Hex Domain Worker

**Status:** Not started

**Worker branch/worktree:** `codex/game-hex` at `.worktrees/game-hex`

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/hex.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/hex.test.ts`

- [ ] Write failing tests for initial state, legal placement, occupied cell rejection, top-bottom seat1 connection, left-right seat2 connection, and full board draw fallback.
- [ ] Run `npm test -w @fairgame/domain -- hex` and confirm the tests fail because `hexRules` is missing.
- [ ] Implement `hexRules` with `gameType: "hex"`, move shape `{ cell: number }`, 121 cells, hex-neighbor flood fill, alternating turns, and connection outcomes.
- [ ] Run `npm test -w @fairgame/domain -- hex` and confirm it passes.
- [ ] Commit with `feat: add hex rules`.

### Task 3: Reversi Domain Worker

**Status:** Not started

**Worker branch/worktree:** `codex/game-reversi` at `.worktrees/game-reversi`

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/reversi.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/reversi.test.ts`

- [ ] Write failing tests for initial four discs, legal flips, illegal non-flipping move rejection, turn passing when the opponent has no moves, final win by disc count, and draw by equal discs.
- [ ] Run `npm test -w @fairgame/domain -- reversi` and confirm the tests fail because `reversiRules` is missing.
- [ ] Implement `reversiRules` with `gameType: "reversi"`, move shape `{ cell: number }`, 64 cells, eight-direction flipping, pass-on-no-move, and count-based outcomes.
- [ ] Run `npm test -w @fairgame/domain -- reversi` and confirm it passes.
- [ ] Commit with `feat: add reversi rules`.

### Task 4: Breakthrough Domain Worker

**Status:** Not started

**Worker branch/worktree:** `codex/game-breakthrough` at `.worktrees/game-breakthrough`

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/breakthrough.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/breakthrough.test.ts`

- [ ] Write failing tests for initial pawn rows, legal forward move, diagonal capture, illegal backward/sideways/occupied-forward moves, promotion-rank win, and elimination win.
- [ ] Run `npm test -w @fairgame/domain -- breakthrough` and confirm the tests fail because `breakthroughRules` is missing.
- [ ] Implement `breakthroughRules` with `gameType: "breakthrough"`, move shape `{ from: number; to: number }`, 64 cells, first-seat direction toward row 7, and alternating turns.
- [ ] Run `npm test -w @fairgame/domain -- breakthrough` and confirm it passes.
- [ ] Commit with `feat: add breakthrough rules`.

### Task 5: Mancala Domain Worker

**Status:** Not started

**Worker branch/worktree:** `codex/game-mancala` at `.worktrees/game-mancala`

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/mancala.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/mancala.test.ts`

- [ ] Write failing tests for initial pits, legal sowing, empty pit rejection, extra turn from own store, capture from opposite pit, game-end sweep, win, and draw.
- [ ] Run `npm test -w @fairgame/domain -- mancala` and confirm the tests fail because `mancalaRules` is missing.
- [ ] Implement `mancalaRules` with `gameType: "mancala"`, move shape `{ pit: number }`, 6 pits per side, stores, sowing, capture, extra turn, and store-count outcomes.
- [ ] Run `npm test -w @fairgame/domain -- mancala` and confirm it passes.
- [ ] Commit with `feat: add mancala rules`.

### Task 6: Dots and Boxes Domain Worker

**Status:** Not started

**Worker branch/worktree:** `codex/game-dots-boxes` at `.worktrees/game-dots-boxes`

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/dotsBoxes.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/dotsBoxes.test.ts`

- [ ] Write failing tests for initial edge/box counts, legal edge drawing, duplicate edge rejection, box completion ownership, extra turn after completing a box, final win, and final draw.
- [ ] Run `npm test -w @fairgame/domain -- dotsBoxes` and confirm the tests fail because `dotsBoxesRules` is missing.
- [ ] Implement `dotsBoxesRules` with `gameType: "dots-boxes"`, move shape `{ edge: string }`, 3 by 3 boxes, 24 normalized edges, box ownership, extra turns, and box-count outcomes.
- [ ] Run `npm test -w @fairgame/domain -- dotsBoxes` and confirm it passes.
- [ ] Commit with `feat: add dots and boxes rules`.

### Task 7: Order and Chaos Domain Worker

**Status:** Not started

**Worker branch/worktree:** `codex/game-order-chaos` at `.worktrees/game-order-chaos`

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/orderChaos.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/orderChaos.test.ts`

- [ ] Write failing tests for initial state, placing either mark, occupied cell rejection, invalid mark rejection, Order five-in-row win, Chaos full-board win, and wrong-seat rejection.
- [ ] Run `npm test -w @fairgame/domain -- orderChaos` and confirm the tests fail because `orderChaosRules` is missing.
- [ ] Implement `orderChaosRules` with `gameType: "order-chaos"`, move shape `{ cell: number; mark: "X" | "O" }`, 36 cells, alternating turns, five-in-row detection for Order, and full-board Chaos win.
- [ ] Run `npm test -w @fairgame/domain -- orderChaos` and confirm it passes.
- [ ] Commit with `feat: add order and chaos rules`.

### Task 8: Gate Integration

**Status:** Not started

**Files:**
- Modify: `fairgame-rebuild/packages/domain/src/index.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/gameRegistry.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/routes.ts`
- Modify: `fairgame-rebuild/apps/server/tests/matches.test.ts`
- Modify: `fairgame-rebuild/apps/web/src/types.ts`
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`
- Modify: `fairgame-rebuild/apps/web/src/styles.css`
- Modify: `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`
- Create: `fairgame-rebuild/apps/web/public/game-thumbnails/gomoku.svg`
- Create: `fairgame-rebuild/apps/web/public/game-thumbnails/hex.svg`
- Create: `fairgame-rebuild/apps/web/public/game-thumbnails/reversi.svg`
- Create: `fairgame-rebuild/apps/web/public/game-thumbnails/breakthrough.svg`
- Create: `fairgame-rebuild/apps/web/public/game-thumbnails/mancala.svg`
- Create: `fairgame-rebuild/apps/web/public/game-thumbnails/dots-boxes.svg`
- Create: `fairgame-rebuild/apps/web/public/game-thumbnails/order-chaos.svg`

- [ ] Merge the seven worker branches into `codex/add-seven-games-gate`.
- [ ] Export all seven domain modules from `packages/domain/src/index.ts`.
- [ ] Add board view types, move parsers, game definitions, playable move projections, and labels to `gameRegistry.ts`.
- [ ] Add game-specific clock ranges in `routes.ts`.
- [ ] Extend web types, game options, time ranges, route validation, recent-match parsing, and move payload types.
- [ ] Add board renderers for placement grids, Reversi, Breakthrough, Mancala, Dots and Boxes, and Order and Chaos.
- [ ] Add thumbnail SVG assets.
- [ ] Add server, web, and Playwright tests for the new games.
- [ ] Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.
- [ ] Start the dev server and verify the picker plus representative new-game move flows in the built-in browser.
- [ ] Update `roadmap.md` and this plan with changed files, verification commands/results, and gate commit hash.
- [ ] Commit with `feat: add seven board games`.

## Execution Notes

- Started from gate worktree `/Volumes/T9/code/2-boards/.worktrees/add-seven-games-gate` on branch `codex/add-seven-games-gate`.
- Baseline verification before implementation: `npm run typecheck` passed; `npm test` passed with shared 2 tests, domain 44 tests, server 40 tests, and web 16 tests.
