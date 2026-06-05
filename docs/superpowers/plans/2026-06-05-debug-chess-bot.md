# Debug Chess Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-debug Chess bot so a solo tester can create a Chess match, have Player 2 auto-join as a bot, and receive bot moves while debug mode is enabled.

**Architecture:** Keep the bot server-side so normal browser play still uses canonical match commands, clocks, persistence, and realtime updates. Gate the feature behind server config that defaults off and is disabled in production. The bot controls `seat2`, auto-joins newly created Chess matches, chooses deterministic legal coordinate moves from the existing Chess board projection, and declines pending draw/takeback requests so test games continue.

**Tech Stack:** TypeScript, Express, Vitest, existing `MatchService`, existing `chess.js`-backed domain rules, Vite/React frontend only for verification.

---

### Task 1: Red Tests For Debug Bot Config And Server Behavior

**Files:**
- Modify: `fairgame-rebuild/apps/server/tests/config.test.ts`
- Modify: `fairgame-rebuild/apps/server/tests/matches.test.ts`

- [x] **Step 1: Write failing config tests**

Add expectations that `loadServerConfig()` parses `FAIRGAME_DEBUG_CHESS_BOT=true` and `FAIRGAME_DEBUG_CHESS_BOT_NAME=Local Bot` in development, while `NODE_ENV=production` forces the flag off.

- [x] **Step 2: Write failing server behavior tests**

Add `MatchService`/API tests proving a debug-enabled Chess match auto-joins `seat2` as `Debug Bot`, immediately makes a legal Board B opening move, and replies on Board A after Player 1 plays `e2-e4`.

- [x] **Step 3: Run red tests**

Run: `npm test -w @fairgame/server -- config matches`

Expected: FAIL because config has no `debugChessBot` field and `MatchService` has no debug bot option.

Result: FAIL as expected on 2026-06-05. `config.debugChessBot` was `undefined`, debug Chess creation kept `joinedSeats: 1`, and a Player 1 Chess move returned `409 match-not-ready`.

### Task 2: Implement Server Debug Chess Bot

**Files:**
- Create: `fairgame-rebuild/apps/server/src/matches/debugChessBot.ts`
- Modify: `fairgame-rebuild/apps/server/src/config.ts`
- Modify: `fairgame-rebuild/apps/server/src/index.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`

- [x] **Step 1: Add config parsing**

Add `debugChessBot: { enabled: boolean; name: string; seat: "seat2" }` to `ServerConfig`. It should default off, parse `FAIRGAME_DEBUG_CHESS_BOT`, use `FAIRGAME_DEBUG_CHESS_BOT_NAME` with fallback `Debug Bot`, and force `enabled: false` when `NODE_ENV=production`.

- [x] **Step 2: Add deterministic bot move selection**

Create `selectDebugChessBotCommand(match, seat)` in `debugChessBot.ts`. It should return no move unless the match is Chess and in progress, decline opponent draw/takeback requests first, then choose a coordinate move from `legalMoves` by a deterministic score that prefers mate/check, captures, promotion, central pawn moves such as `e2-e4`/`e7-e5`, and stable lexical tie-breaking.

- [x] **Step 3: Wire the bot into MatchService**

Add a `debugChessBot` constructor option. On debug-enabled Chess creation, claim `seat2` with the configured bot name, then play available bot turns. After non-bot moves, play available bot turns again and return the post-bot match view. Keep default behavior unchanged when the option is disabled.

- [x] **Step 4: Pass config from the local server entrypoint**

In `apps/server/src/index.ts`, construct `MatchService` with `debugChessBot: config.debugChessBot`.

- [x] **Step 5: Run green server tests**

Run: `npm test -w @fairgame/server -- config matches`

Expected: PASS.

Result: PASS on 2026-06-05. `tests/config.test.ts` and `tests/matches.test.ts` passed 42 tests.

### Task 3: Document Local Debug Mode

**Files:**
- Modify: `fairgame-rebuild/README.md`
- Modify: `fairgame-rebuild/.env.example`

- [x] **Step 1: Document the flag**

Add a README section showing local usage:

```bash
FAIRGAME_DEBUG_CHESS_BOT=true npm run dev
```

Explain that it only affects local/development server runs, auto-seats Player 2 as a bot for Chess, and stays off in production.

- [x] **Step 2: Add commented env example**

Add disabled example variables for `FAIRGAME_DEBUG_CHESS_BOT` and `FAIRGAME_DEBUG_CHESS_BOT_NAME`.

### Task 4: Verification And Roadmap Evidence

**Files:**
- Modify: `roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-05-debug-chess-bot.md`

- [x] **Step 1: Run full verification**

Run: `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` from `fairgame-rebuild`.

Result: PASS on 2026-06-05. `git diff --check`, `npm run typecheck`, `npm test` (shared 2, domain 103, server 54, web 37), and `npm run build` all passed.

- [ ] **Step 2: Manually verify local debug mode**

Start local dev servers with `FAIRGAME_DEBUG_CHESS_BOT=true npm run dev`, open `http://localhost:5173`, create a Chess match, verify Player 2 is the bot, Board B has a bot move, play Board A `e2-e4`, and verify the bot replies on Board A.

- [x] **Step 2: Manually verify local debug mode**

Result: PASS on 2026-06-05 using Codex in-app Browser at `http://localhost:5174` with a disposable in-memory API on `http://localhost:4000` because the local `.env` has a blank `DATABASE_URL`. Created a Chess match through the UI; API state showed `players.seat2.name` as `Debug Bot`, Board B bot opening move `e2-e4`, then after clicking Board A `e2-e4`, Board A history showed Player 1 `e4` followed by bot `e5`. Smoke ports `4000`, `5173`, and `5174` were clear after cleanup.

- [x] **Step 3: Record evidence**

Update this plan and `roadmap.md` with files changed, verification commands/results, and commit hash if a commit is created.

Result: Evidence recorded in this plan and `roadmap.md` on 2026-06-05. Feature commit: `4a10490ce4ff1c7ac0ab4c8241259282ea676f26`.
