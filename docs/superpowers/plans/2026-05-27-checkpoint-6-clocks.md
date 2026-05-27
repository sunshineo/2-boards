# Checkpoint 6 Clock System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared match clocks, increments, and timeout handling.

**Architecture:** Keep clock math pure in the domain package. Let `MatchService` inject time, start clocks after both seats join, advance clocks on reads and commands, and project clock state into match views.

**Tech Stack:** TypeScript, Vitest, React/Vite, Express, Playwright.

---

### Task 1: Domain Clock Math

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/clocks.ts`
- Create: `fairgame-rebuild/packages/domain/src/clocks.test.ts`
- Modify: `fairgame-rebuild/packages/domain/src/index.ts`

- [x] **Step 1: Write failing clock tests**

Cover zero, one, and two running seats; move increment; single timeout; mutual timeout.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/domain -- clocks`. Expected: fail because `clocks.ts` does not exist.

- [x] **Step 3: Implement clock math**

Add `ClockConfig`, `MatchClock`, `createMatchClock`, `setClockRunningSeats`,
`advanceMatchClock`, `completeClockMove`, and `toClockView`.

- [x] **Step 4: Export and verify green**

Export from `packages/domain/src/index.ts` and rerun the targeted command.

### Task 2: Server Clock Integration

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/matches/gameRegistry.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchView.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/routes.ts`
- Modify: `fairgame-rebuild/apps/server/src/realtime.ts`
- Modify: `fairgame-rebuild/apps/server/tests/matches.test.ts`
- Modify: `fairgame-rebuild/apps/server/tests/persistence.test.ts`

- [x] **Step 1: Write failing server tests**

Verify clocks are present, start on join, both run at the opening position, a move adds
increment and recomputes running seats, and timeout resolves unfinished boards.

- [x] **Step 2: Run red**

Run `npm run typecheck && npm test -w @fairgame/server -- matches persistence`.

- [x] **Step 3: Implement server clock state**

Add `clock` to stored snapshots, inject `nowMs`, create clocks on match create, start
running seats on join, and include `clock` in `MatchView`.

- [x] **Step 4: Implement timeout handling**

Advance clocks before reads and commands. Persist `clock.timeout` events and snapshots
when timeout changes match outcomes.

- [x] **Step 5: Verify green**

Rerun the targeted server verification.

### Task 3: Web Clock Display

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/types.ts`
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/styles.css`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`

- [x] **Step 1: Write failing web tests**

Expect Player 1 and Player 2 clocks in the match summary after creating a match.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/web`.

- [x] **Step 3: Implement clock display**

Render remaining time and running state from `match.clock`.

- [x] **Step 4: Verify green**

Rerun the web tests.

### Task 4: Full Verification, Browser Check, Roadmap, Commit

**Files:**
- Modify: `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`
- Modify: `roadmap.md`

- [x] **Step 1: Keep E2E coverage green**

Update existing E2E assertions only if the clock UI changes accessible text.

- [x] **Step 2: Run full verification**

Run `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e`.

- [x] **Step 3: Run built-in browser verification**

Use the Codex in-app browser to create a match and confirm both player clocks render.

- [ ] **Step 4: Update roadmap and commit**

Mark checkpoint 6 complete and commit with `git commit -m "feat: add shared clocks"`.
