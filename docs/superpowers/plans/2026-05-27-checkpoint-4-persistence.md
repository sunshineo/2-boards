# Checkpoint 4 Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable PGlite persistence with append-only events and current snapshots, and restore active matches after server restart.

**Architecture:** Add a repository interface in the server match layer and a PGlite implementation in `apps/server/src/persistence`. Keep `MatchService` as the command orchestrator, but make mutating methods async so successful create/join/move commands are persisted before broadcasting.

**Tech Stack:** TypeScript, PGlite, Express, Vitest, Playwright.

---

### Task 1: Repository Contract

**Files:**
- Create: `fairgame-rebuild/apps/server/src/matches/matchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`

- [x] **Step 1: Define serializable stored match and event types**

Represent match snapshots, joined seats, seat claims, and event payloads.

- [x] **Step 2: Add optional repository to MatchService**

Add `loadFromRepository()` and async persistence calls for create/join/move.

### Task 2: PGlite Repository

**Files:**
- Modify: `fairgame-rebuild/apps/server/package.json`
- Create: `fairgame-rebuild/apps/server/src/persistence/pgliteMatchRepository.ts`
- Test: `fairgame-rebuild/apps/server/tests/persistence.test.ts`
- Modify: `.gitignore`

- [x] **Step 1: Install PGlite**

Run:

```bash
npm install -w @fairgame/server @electric-sql/pglite
```

- [x] **Step 2: Implement schema initialization**

Create `match_events` and `match_snapshots`.

- [x] **Step 3: Implement append/load/save methods**

Store JSON payloads in PGlite and load snapshots into service records.

- [x] **Step 4: Add persistence tests**

Verify create/move events, snapshots, service restart load, and continued play.

### Task 3: Server Startup Integration

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/index.ts`

- [x] **Step 1: Initialize PGlite repository on startup**

Use `FAIRGAME_DB_DIR` or default `.data/pglite`.

- [x] **Step 2: Hydrate match service**

Call `loadFromRepository()` before registering realtime and listening.

### Task 4: Full Verification And Commit

**Files:**
- Modify: `roadmap.md`

- [x] **Step 1: Run full verification**

Run:

```bash
npm install
npm run typecheck && npm test && npm run build && npm run test:e2e
```

- [x] **Step 2: Update roadmap and commit**

Mark checkpoint 4 complete, record verification evidence, and commit:

```bash
git add .gitignore roadmap.md docs/superpowers fairgame-rebuild
git commit -m "feat: persist matches with pglite"
```
