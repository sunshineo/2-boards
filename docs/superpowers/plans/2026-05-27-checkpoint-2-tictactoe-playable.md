# Checkpoint 2 TicTacToe Playable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a server-authoritative, browser-playable TicTacToe fair match using the generic two-board engine.

**Architecture:** Add TicTacToe as a game rules module in the domain package. Add an in-memory server match service and REST API. Replace the bootstrap web screen with a playable React flow that creates, joins, and plays TicTacToe matches through server commands. Expand Playwright to cover a full two-client match.

**Tech Stack:** TypeScript, React, Vite, Express, Vitest, Playwright.

---

### Task 1: TicTacToe Rules

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/tictactoe.ts`
- Test: `fairgame-rebuild/packages/domain/src/games/tictactoe.test.ts`
- Modify: `fairgame-rebuild/packages/domain/src/index.ts`

- [ ] **Step 1: Write TicTacToe rules tests**

Cover initial turn, legal move, occupied cell rejection, row win, column win,
diagonal win, and draw.

- [ ] **Step 2: Implement TicTacToe rules adapter**

Implement `ticTacToeRules` as `GameRules<TicTacToeState, TicTacToeMove>`.

- [ ] **Step 3: Run domain game tests**

Run:

```bash
npm test -w @fairgame/domain -- tictactoe
```

Expected: TicTacToe tests pass.

### Task 2: Server Match API

**Files:**
- Create: `fairgame-rebuild/apps/server/src/matches/matchService.ts`
- Create: `fairgame-rebuild/apps/server/src/matches/matchView.ts`
- Create: `fairgame-rebuild/apps/server/src/matches/routes.ts`
- Test: `fairgame-rebuild/apps/server/tests/matches.test.ts`
- Modify: `fairgame-rebuild/apps/server/src/app.ts`

- [ ] **Step 1: Write API tests**

Cover create, join, read, legal move, invalid move, and completed match score.

- [ ] **Step 2: Implement in-memory match service**

Store matches in memory for this checkpoint. Use the domain engine and `ticTacToeRules`.

- [ ] **Step 3: Add REST routes**

Mount JSON API routes under `/api/matches`.

- [ ] **Step 4: Run server tests**

Run:

```bash
npm test -w @fairgame/server -- matches
```

Expected: match API tests pass.

### Task 3: Web Playable UI

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`
- Modify: `fairgame-rebuild/apps/web/src/styles.css`
- Create: `fairgame-rebuild/apps/web/src/api.ts`
- Create: `fairgame-rebuild/apps/web/src/types.ts`

- [ ] **Step 1: Add API client and view types**

Create typed browser helpers for create, join, get, and move commands.

- [ ] **Step 2: Replace bootstrap UI with playable match UI**

Implement create/join controls, two boards, turn/result labels, score/result summary,
and rejected-move errors.

- [ ] **Step 3: Update React tests**

Cover initial create/join controls and board rendering from a loaded match view.

- [ ] **Step 4: Run web tests**

Run:

```bash
npm test -w @fairgame/web
```

Expected: web tests pass.

### Task 4: E2E Full Match

**Files:**
- Modify: `fairgame-rebuild/playwright.config.ts`
- Modify: `fairgame-rebuild/package.json`
- Replace: `fairgame-rebuild/tests/e2e/bootstrap.spec.ts`

- [ ] **Step 1: Run server and web for E2E**

Add a `dev:e2e` script that starts server and web together for Playwright.

- [ ] **Step 2: Write two-client TicTacToe E2E**

Use two browser contexts. Player 1 creates a match, Player 2 joins by code, and both
players finish both boards.

- [ ] **Step 3: Run E2E**

Run:

```bash
npm run test:e2e
```

Expected: full playable TicTacToe E2E passes.

### Task 5: Full Verification And Commit

**Files:**
- Modify: `roadmap.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run typecheck && npm test && npm run build && npm run test:e2e
```

Expected: all checks pass.

- [ ] **Step 2: Manual browser verification**

Start local dev servers, open the app with Codex's built-in browser, create or inspect
the playable TicTacToe screen, and record the result.

- [ ] **Step 3: Update roadmap and commit**

Mark checkpoint 2 complete, record evidence, then commit:

```bash
git add roadmap.md docs/superpowers fairgame-rebuild
git commit -m "feat: add playable tictactoe slice"
```
