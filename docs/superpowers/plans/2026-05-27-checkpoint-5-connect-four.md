# Checkpoint 5 Connect Four Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Connect Four as a second playable two-board game.

**Architecture:** Implement Connect Four in the domain package through `GameRules`, then add a server game registry that creates, validates, applies, and projects supported games. The React app renders a discriminated board-view union so new games do not require match orchestration changes.

**Tech Stack:** TypeScript, React/Vite, Express, Socket.IO, Vitest, Playwright.

---

### Task 1: Domain Connect Four Rules

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/games/connectFour.ts`
- Create: `fairgame-rebuild/packages/domain/src/games/connectFour.test.ts`
- Modify: `fairgame-rebuild/packages/domain/src/index.ts`

- [x] **Step 1: Write failing domain tests**

Cover initial state, gravity, wrong-seat rejection, full-column rejection, vertical win,
horizontal win, diagonal win, and draw detection.

- [x] **Step 2: Run tests to verify red**

Run:

```bash
npm test -w @fairgame/domain -- connectFour
```

Expected: fail because `connectFourRules` does not exist.

- [x] **Step 3: Implement Connect Four rules**

Create `ConnectFourState`, `ConnectFourMove`, `connectFourRules`, and helpers for
dropping into the lowest empty slot, scanning four directions, and detecting board-full
draws.

- [x] **Step 4: Export and verify green**

Export the rules from `packages/domain/src/index.ts` and rerun the targeted command.

### Task 2: Server Game Registry

**Files:**
- Create: `fairgame-rebuild/apps/server/src/matches/gameRegistry.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchView.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/routes.ts`
- Modify: `fairgame-rebuild/apps/server/src/index.ts`
- Modify: `fairgame-rebuild/apps/server/tests/matches.test.ts`
- Modify: `fairgame-rebuild/apps/server/tests/persistence.test.ts`

- [x] **Step 1: Write failing server tests**

Add tests for `POST /api/matches { gameType: "connect4" }`, first Connect Four move,
invalid Connect Four move shape, and unsupported game type.

- [x] **Step 2: Run server tests to verify red**

Run:

```bash
npm test -w @fairgame/server -- matches
```

Expected: fail because the API ignores `gameType`.

- [x] **Step 3: Implement registry and service integration**

Add supported game definitions for TicTacToe and Connect Four. `MatchService.createMatch`
accepts a game type, applies moves through the definition for the stored match, and
serializes `SupportedGameState` snapshots.

- [x] **Step 4: Implement route parsing and view projection**

`POST /api/matches` reads `gameType`; move routes pass raw move bodies to the service.
`toMatchView` delegates board projection to the matching game definition.

- [x] **Step 5: Verify green**

Run the targeted server tests.

### Task 3: Web Game Selector And Board Renderers

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/types.ts`
- Modify: `fairgame-rebuild/apps/web/src/api.ts`
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/styles.css`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`

- [x] **Step 1: Write failing web tests**

Update App tests to expect a game selector, TicTacToe as the default, and Connect Four
board rendering when selected.

- [x] **Step 2: Run web tests to verify red**

Run:

```bash
npm test -w @fairgame/web
```

Expected: fail because the selector and Connect Four renderer do not exist.

- [x] **Step 3: Implement typed API and UI selector**

`createMatch(gameType)` sends `{ gameType }`. Setup screen includes a segmented selector
for TicTacToe and Connect Four.

- [x] **Step 4: Implement board renderer switch**

Render TicTacToe with the existing cell grid and Connect Four with column buttons and
six-row slot stacks.

- [x] **Step 5: Verify green**

Run the web tests.

### Task 4: E2E, Browser Verification, Roadmap, Commit

**Files:**
- Modify: `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`
- Modify: `roadmap.md`

- [x] **Step 1: Add Playwright Connect Four coverage**

Add a two-player Connect Four flow that finishes both boards and verifies the combined
`1 - 1` result.

- [x] **Step 2: Run full verification**

Run:

```bash
npm install
npm run typecheck && npm test && npm run build && npm run test:e2e
```

- [x] **Step 3: Run built-in browser verification**

Start the dev server and use the Codex in-app browser against the local app to create a
Connect Four match, confirm both boards render, and confirm a legal column is clickable.

- [x] **Step 4: Update roadmap and commit**

Mark checkpoint 5 complete, record verification evidence, and commit:

```bash
git add roadmap.md docs/superpowers fairgame-rebuild
git commit -m "feat: add connect four"
```
