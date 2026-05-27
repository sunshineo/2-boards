# Checkpoint 7 Chess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chess through `chess.js` as another two-board playable game.

**Architecture:** Implement a domain chess rules adapter, add a chess definition to the server game registry, then render chess-specific board interaction and move history in the web app.

**Tech Stack:** TypeScript, chess.js, React/Vite, Express, Vitest, Playwright.

---

### Task 1: Domain Chess Adapter

**Files:**
- Modify: `fairgame-rebuild/packages/domain/package.json`
- Create: `fairgame-rebuild/packages/domain/src/games/chess.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/chess.test.ts`
- Modify: `fairgame-rebuild/packages/domain/src/index.ts`

- [x] **Step 1: Write failing chess domain tests**

Cover initial state, legal move, illegal move, checkmate, stalemate, castling, en
passant, and promotion.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/domain -- chess`. Expected: fail because `chess.ts` does not exist.

- [x] **Step 3: Install and inspect `chess.js`**

Run `npm install -w @fairgame/domain chess.js`, then inspect the installed package API
locally if needed.

- [x] **Step 4: Implement chess adapter**

Add `chessRules`, state/move/history types, FEN helpers, color-seat mapping, and generic
outcome projection.

- [x] **Step 5: Export and verify green**

Export from `packages/domain/src/index.ts` and rerun the targeted domain command.

### Task 2: Server Chess Registry

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/matches/gameRegistry.ts`
- Modify: `fairgame-rebuild/apps/server/tests/matches.test.ts`

- [x] **Step 1: Write failing server tests**

Test chess match creation, `e2-e4`, invalid chess move shape, and two-board Fool's Mate
scoring as `1 - 1`.

- [x] **Step 2: Run red**

Run `npm run typecheck && npm test -w @fairgame/server -- matches`.

- [x] **Step 3: Implement registry support**

Add `chess` to supported game types, parse `{ from, to, promotion }`, project board
squares and move history, and compute active seats from chess state.

- [x] **Step 4: Verify green**

Rerun targeted server verification.

### Task 3: Web Chess UI

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/types.ts`
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/styles.css`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`

- [x] **Step 1: Write failing web tests**

Expect Chess in the selector and a rendered chess board after selecting Chess.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/web`.

- [x] **Step 3: Implement chess renderer**

Render square buttons, selected-square state, queen promotion default, and move history.

- [x] **Step 4: Verify green**

Rerun web tests.

### Task 4: E2E, Browser Verification, Roadmap, Commit

**Files:**
- Modify: `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`
- Modify: `roadmap.md`

- [x] **Step 1: Add Playwright chess smoke flow**

Create a chess match, click `e2`, click `e4`, and verify move history.

- [x] **Step 2: Run full verification**

Run `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e`.

- [x] **Step 3: Run built-in browser verification**

Use the Codex in-app browser to create a chess match and make `e2-e4`.

- [ ] **Step 4: Update roadmap and commit**

Mark checkpoint 7 complete and commit with `git commit -m "feat: add chess"`.
