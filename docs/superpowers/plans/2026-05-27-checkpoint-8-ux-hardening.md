# Checkpoint 8 UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add practical UX polish for repeated play and clearer turns.

**Architecture:** Store player names as match metadata in the server, keep invite copy/history in the web client, and style active boards without changing domain rules.

**Tech Stack:** TypeScript, React/Vite, Express, Vitest, Playwright.

---

### Task 1: Player Name Metadata

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/matches/matchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchView.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/routes.ts`
- Modify: `fairgame-rebuild/apps/server/tests/matches.test.ts`

- [x] **Step 1: Write failing server tests**

Verify create and join accept `playerName` and project names in `match.players`.

- [x] **Step 2: Run red**

Run `npm run typecheck && npm test -w @fairgame/server -- matches`.

- [x] **Step 3: Implement metadata**

Persist `playerNames`, sanitize blank names to `Player 1` / `Player 2`, and include
`players` in `MatchView`.

- [x] **Step 4: Verify green**

Rerun the targeted server command.

### Task 2: Web Polish

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/types.ts`
- Modify: `fairgame-rebuild/apps/web/src/api.ts`
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/styles.css`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`

- [x] **Step 1: Write failing web tests**

Verify player-name inputs, copy invite feedback, recent match history, and rematch button.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/web`.

- [x] **Step 3: Implement web polish**

Add name inputs, pass names to API, save recent matches to localStorage, copy invite
links, show rematch on completed matches, and add active-board styling.

- [x] **Step 4: Verify green**

Rerun web tests.

Evidence: `npm test -w @fairgame/web` passed 6 tests on 2026-05-27.

### Task 3: Full Verification, Browser Check, Roadmap, Commit

**Files:**
- Modify: `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`
- Modify: `roadmap.md`

- [x] **Step 1: Keep E2E coverage green**

Update selectors if new labels make old assertions ambiguous.

- [x] **Step 2: Run full verification**

Run `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e`.

- [x] **Step 3: Run built-in browser verification**

Use the Codex in-app browser to create a named match and confirm copy invite plus active
board affordance.

Evidence: `npm install` found 0 vulnerabilities. Fresh `npm run typecheck && npm test && npm run build && npm run test:e2e` passed on 2026-05-27: shared 2 tests, domain 44 tests, server 22 tests, web 6 tests, production build, and 3 Chromium E2E tests. Built-in browser verification loaded `http://192.168.4.149:5173/`, created a TicTacToe match as `Clara`, confirmed `Clara (Player 1)`, Board A as the only active board, disabled Board B cells, `Copy invite` -> `Copied`, and recent-match history.

- [x] **Step 4: Update roadmap and commit**

Mark checkpoint 8 complete and commit with `git commit -m "feat: harden match ux"`.

Evidence: Checkpoint 8 implementation commit `cbd1cd7`.
