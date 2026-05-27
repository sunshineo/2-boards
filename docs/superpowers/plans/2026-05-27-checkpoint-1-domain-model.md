# Checkpoint 1 Domain Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the generic fair-match domain model and pure match engine with tests for the core two-board fairness invariants.

**Architecture:** Add focused files in `packages/domain/src`: `types.ts` for generic contracts, `scoring.ts` for board/match scoring, `engine.ts` for match creation and move application, and tests using a tiny fixture rules adapter. Keep game-specific move semantics inside the fixture/rules adapter, not the engine.

**Tech Stack:** TypeScript, Vitest, existing npm workspace.

---

### Task 1: Generic Types

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/types.ts`
- Modify: `fairgame-rebuild/packages/domain/src/index.ts`

- [ ] **Step 1: Add generic match and rules types**

Create types for `FairMatch`, `FairBoard`, `GameRules`, `ApplyMoveCommand`,
`ApplyMoveResult`, `MatchScore`, and `MatchOutcome`.

- [ ] **Step 2: Export the types**

Update `index.ts` to export from `types.ts`.

### Task 2: Scoring

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/scoring.ts`
- Test: `fairgame-rebuild/packages/domain/src/scoring.test.ts`

- [ ] **Step 1: Write scoring tests**

Cover win scoring, draw scoring, completed match winner, tied match, and canceled match.

- [ ] **Step 2: Implement scoring**

Implement `scoreBoardOutcome`, `createEmptyScore`, `addScores`, and `getMatchOutcome`.

- [ ] **Step 3: Run scoring tests**

Run:

```bash
npm test -w @fairgame/domain -- scoring
```

Expected: scoring tests pass.

### Task 3: Match Engine

**Files:**
- Create: `fairgame-rebuild/packages/domain/src/engine.ts`
- Test: `fairgame-rebuild/packages/domain/src/engine.test.ts`
- Modify: `fairgame-rebuild/packages/domain/src/index.ts`

- [ ] **Step 1: Write engine tests**

Cover board starter assignment, independent board movement, wrong-seat rejection,
game validation rejection, completed-match rejection, and whole-match cancellation.

- [ ] **Step 2: Implement engine**

Implement `createFairMatch`, `applyMoveToMatch`, `getBoard`, and preserve the existing
`createBootstrapBoardAssignments` export using the same board assignment constants.

- [ ] **Step 3: Run engine tests**

Run:

```bash
npm test -w @fairgame/domain -- engine
```

Expected: engine tests pass.

### Task 4: Workspace Verification

**Files:**
- Modify: `roadmap.md`

- [ ] **Step 1: Run full verification**

Run from `fairgame-rebuild`:

```bash
npm run typecheck && npm test && npm run build && npm run test:e2e
```

Expected: all commands pass.

- [ ] **Step 2: Update roadmap**

Mark checkpoint 1 items complete and record changed files, verification results, and commit hash.

- [ ] **Step 3: Commit checkpoint 1**

Run from `/Volumes/T9/code/2-boards`:

```bash
git add roadmap.md docs/superpowers fairgame-rebuild/packages/domain fairgame-rebuild/packages/shared fairgame-rebuild/apps/server fairgame-rebuild/apps/web
git commit -m "feat: add fair match domain engine"
```

Expected: commit succeeds.
