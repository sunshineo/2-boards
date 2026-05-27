# Checkpoint 3 Real-Time Room Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live room updates, invite URLs, refresh-safe seat cookies, and spectator read-only views to the playable TicTacToe slice.

**Architecture:** Extend the in-memory match service with seat claims and update listeners. Mount Socket.IO in the server process and broadcast match views by match id. Add a browser session restore endpoint. Update the web app to restore sessions from `?match=`, connect to sockets, and represent spectator mode with `seat: null`.

**Tech Stack:** TypeScript, Express, Socket.IO, socket.io-client, React, Vitest, Playwright.

---

### Task 1: Server Seat Claims And Session Restore

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/routes.ts`
- Test: `fairgame-rebuild/apps/server/tests/matches.test.ts`

- [ ] **Step 1: Add seat claim tests**

Cover create sets a cookie, join sets a cookie, session restore returns the seat with a
valid cookie, and session restore returns spectator mode without a valid cookie.

- [ ] **Step 2: Implement claim storage and cookie helpers**

Generate random secrets per claimed seat and validate cookie values.

- [ ] **Step 3: Add session endpoint**

Implement `GET /api/matches/:id/session`.

### Task 2: Socket.IO Match Updates

**Files:**
- Create: `fairgame-rebuild/apps/server/src/realtime.ts`
- Modify: `fairgame-rebuild/apps/server/src/index.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`

- [ ] **Step 1: Add match update listeners**

Match service should notify listeners after join and move changes.

- [ ] **Step 2: Register Socket.IO room watcher**

Implement `watch-match` and `match:update` events.

### Task 3: Web Session Restore And Live Updates

**Files:**
- Modify: `fairgame-rebuild/apps/web/package.json`
- Modify: `fairgame-rebuild/apps/web/src/api.ts`
- Modify: `fairgame-rebuild/apps/web/src/types.ts`
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`

- [ ] **Step 1: Add socket.io-client**

Install and use socket.io-client in the web app.

- [ ] **Step 2: Restore sessions from URL**

On load with `?match=<id>`, call session restore and show player or spectator mode.

- [ ] **Step 3: Subscribe to match updates**

Connect to Socket.IO and update match state when `match:update` arrives.

- [ ] **Step 4: Disable moves for spectators**

Allow `seat: null` and prevent cell clicks.

### Task 4: E2E Refresh And Spectator Coverage

**Files:**
- Modify: `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`

- [ ] **Step 1: Remove manual refresh dependency**

Update the two-player E2E to rely on live updates.

- [ ] **Step 2: Add reload checks**

Reload both player pages and verify seat restoration.

- [ ] **Step 3: Add spectator checks**

Open a third context with `?match=<id>`, verify read-only board state and live updates.

### Task 5: Full Verification And Commit

**Files:**
- Modify: `roadmap.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
npm install
npm run typecheck && npm test && npm run build && npm run test:e2e
```

- [ ] **Step 2: Manual built-in browser verification**

Start `npm run dev:e2e`, open the invite URL in Codex's built-in browser, and verify
the room view loads.

- [ ] **Step 3: Update roadmap and commit**

Mark checkpoint 3 complete and commit:

```bash
git add roadmap.md docs/superpowers fairgame-rebuild
git commit -m "feat: add realtime room flow"
```
