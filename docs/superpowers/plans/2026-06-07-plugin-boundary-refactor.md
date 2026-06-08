# Plugin Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FairGame framework/plugin boundary explicit across domain move authorization, server game definitions, automated seats, and web game rendering.

**Architecture:** The domain framework owns the two-board match engine, scoring, and clocks. Each game plugin owns rules, move parsing, board projection, clock metadata, optional create controls, board rendering, and optional automation such as Stockfish.

**Tech Stack:** TypeScript, Express, React, Vite, Vitest, chess.js, react-chessboard, Socket.IO.

---

## Baseline

- [x] Worktree ready at `.worktrees/architect-plugin-boundary` on branch `codex/architect-plugin-boundary`.
- [x] Dependencies installed with `npm install` in `fairgame-rebuild`.
- [x] Baseline verification passed: `npm run typecheck && npm test`.

## Tasks

- [x] **Task 1: Add explicit game move authorization to the domain engine.**
  - Files: `fairgame-rebuild/packages/domain/src/types.ts`, `fairgame-rebuild/packages/domain/src/engine.ts`, `fairgame-rebuild/packages/domain/src/engine.test.ts`, `fairgame-rebuild/packages/domain/src/games/chess.ts`.
  - Red test: prove `applyMoveToMatch` accepts a Chess board-control move from a non-turn seat through game-owned validation.
  - Implementation: add an optional `canSubmitMove` hook to `GameRules`; the engine uses it before falling back to `getSeatsToAct`.
  - Verification: `npm test -w @fairgame/domain -- engine.test.ts chess.test.ts` passed with 23 tests.

- [x] **Task 2: Split server game support into plugin modules.**
  - Files: new `fairgame-rebuild/apps/server/src/games/*.ts`, modified `fairgame-rebuild/apps/server/src/matches/gameRegistry.ts`, `fairgame-rebuild/apps/server/src/matches/routes.ts`, server tests.
  - Red test: prove clock ranges are read from game plugin metadata rather than a route-local game switch.
  - Implementation: create `GameServerPlugin`, per-game plugin files, a registry facade, and plugin-owned `clockRange`.
  - Verification: `npm run build:packages && npm test -w @fairgame/server -- gameRegistry.test.ts matches.test.ts browserChessBot.test.ts` passed with 46 server tests.

- [x] **Task 3: Generalize Chess bot plumbing into automated seats.**
  - Files: new `fairgame-rebuild/apps/server/src/matches/seatAgents.ts`, modified route/service/repository/view/API/web types, compatibility wrapper for existing `browserChessBot` helpers if useful.
  - Red test: prove match creation and snapshots expose a generic `automatedSeat` while retaining compatible `bot` response metadata for the current browser.
  - Implementation: rename server storage and service options from Chess-specific bot concepts to `automatedSeat`/`seatAgent`, with the Chess plugin still providing the Stockfish create option.
  - Verification: `npm test -w @fairgame/server -- browserChessBot.test.ts matches.test.ts gameRegistry.test.ts && npm test -w @fairgame/web -- api.test.ts` passed with 52 focused tests.

- [x] **Task 4: Extract web game metadata and board rendering into plugins.**
  - Files: new `fairgame-rebuild/apps/web/src/games/*`, modified `fairgame-rebuild/apps/web/src/App.tsx`, web tests.
  - Red test: prove App delegates board rendering through a game plugin registry and exposes Chess create controls through plugin metadata.
  - Implementation: move game options/time ranges and `BoardRenderer`/board components into `apps/web/src/games`, leaving `App.tsx` as route, lobby, match-shell, socket, and session orchestration.
  - Verification: `npm test -w @fairgame/web -- registry.test.tsx App.test.tsx api.test.ts browserChessBot.test.ts` passed with 58 focused tests.

- [x] **Task 5: Final verification and evidence.**
  - Files: this plan, `roadmap.md` if the work is recorded as roadmap evidence.
  - Verification: `git diff --check`, `npm run typecheck`, `npm test`, `npm run build`.
  - Evidence:
    - `git diff --check && npm run typecheck && npm test && npm run build` passed.
    - `npm run test:e2e` did not reach browser tests in this shell because the official dev server requires `DATABASE_URL`; direct server startup reproduced `Error: DATABASE_URL is required.` before port 4000 was bound.
    - Supplementary browser verification against worktree-local temporary servers passed: `PLAYWRIGHT_REUSE_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:5177 PLAYWRIGHT_API_URL=http://localhost:4210 npm run test:e2e` passed with 6 Playwright tests after starting an ephemeral no-persistence API and Vite dev server.
    - Primary changed areas: domain `GameRules.canSubmitMove`, Chess board-control authorization, server `games` registry and clock metadata, generic `seatAgents` automated-seat service/API path, web API/types automated-seat compatibility, and web `games` registry/renderers.
    - Implementation commit: `ccb50f3` (`Clarify game plugin boundaries`).
