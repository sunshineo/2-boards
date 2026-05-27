# Fair Two-Board Game Roadmap

Last updated: 2026-05-27

## Product Goal

Build a fair two-board board-game platform where two players play the same game on
two simultaneous boards. Player 1 moves first on one board. Player 2 moves first on
the other. Each board is an independent normal game, and the match result is derived
from the combined board results.

## Core Rule

Every match has exactly two boards:

- Board A: Player 1 starts.
- Board B: Player 2 starts.

There is no global `currentBoard`. Each board has its own turn, legal moves, state,
and result. A player may be to-move on both boards, one board, or neither.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked
- `[-]` Skipped or superseded

When a roadmap item changes status, update its evidence line with the relevant files,
commit hash if available, and verification command/result.

## Non-Negotiable Design Constraints

- The server owns canonical match state.
- Clients send commands, not direct state mutations.
- Each board has its own independent turn and result.
- Match scoring is derived from board results.
- Game rules are plug-ins; match orchestration is shared.
- The framework should not know game-specific concepts such as checkmate, castling,
  columns, marks, captures, or draw offers. Those belong inside each game rules module.
- Start with the simplest game, but do not build a TicTacToe-only architecture.
- Add complexity only after the previous layer is working and tested.
- Browser verification is required for implemented UI flows. Use Codex's built-in
  browser tooling, not the user's Chrome browser, unless the user explicitly requests
  Chrome for that task.
- End-to-end tests should be introduced early and expanded with each playable flow.

## Technical Defaults

- Package manager: `npm`.
- Local database: PGlite.
- Future hosted database path: Neon Postgres.
- Persistence model: both event log and snapshots. Append commands/events for auditability
  and replay, and store current snapshots for simple loading.

## Generic Outcome Model

The fair-match framework should understand only generic board outcomes:

```ts
type BoardOutcome =
  | { status: "in_progress" }
  | { status: "draw"; reason: string }
  | { status: "win"; winner: SeatId; loser: SeatId; reason: string }
  | { status: "canceled"; reason: string };
```

Outcome reasons may be game-specific, such as `checkmate`, `three-in-row`,
`four-in-row`, `resignation`, or `timeout`. The framework may display those reasons,
but it should not interpret game-specific meanings beyond generic scoring and match
completion.

Generic scoring:

- Board win: winner receives `1`, loser receives `0`.
- Board draw: both seats receive `0.5`.
- Match score is the sum of both board scores.
- `canceled` applies to the whole match, not to one board.

Seat continuity before accounts should use a refresh-safe seat claim. A secure HTTP-only
cookie is the preferred mechanism for normal browser play; local storage can be reserved
for development or fallback use if needed.

The framework owns match layout, room state, two-board placement, timers, scoring, and
generic result display. Each game owns its board renderer, move input semantics, and
game-specific result wording.

## Testing Strategy

Testing should be layered from the beginning:

- Unit tests prove domain rules, board independence, scoring, and game-specific legal moves.
- Integration tests prove server commands, persistence, reconnect behavior, and error handling.
- End-to-end tests prove real browser flows such as create, join, play, finish, refresh,
  reconnect, and spectator views.
- Manual browser verification should happen after meaningful UI changes by starting the
  local server and opening the app with Codex's built-in browser tooling.
- Playwright should be the default E2E test framework unless a stronger local reason emerges.

## Execution Workflow

Work through the roadmap one checkpoint at a time:

- Select the next unchecked roadmap checkpoint.
- Use the Superpowers brainstorming/spec workflow when the checkpoint needs product or
  architecture decisions.
- Write a durable implementation plan before touching code.
- Execute the plan step by step.
- Run unit, integration, and E2E verification appropriate to the checkpoint.
- Manually verify implemented UI flows with Codex's built-in browser tooling after starting
  the local dev server.
- Commit the completed checkpoint in the rebuild project's Git repo.
- Update this roadmap with status, files changed, verification results, and commit hash.
- Move to the next checkpoint only after the current checkpoint is verified and recorded.

## Roadmap

### 0. Project Bootstrap And Workspace

- [x] Decide whether to rebuild in a clean new folder or evolve an existing attempt.
  Evidence: User confirmed clean new folder on 2026-05-27; `AGENTS.md` records this decision.
- [x] Decide how to organize old attempts and Git ownership.
  Evidence: User approved moving old attempts into an ignored archive folder and initializing a top-level Git repo on 2026-05-27.
- [x] Create `archive/attempts/` and move old project folders there.
  Evidence: Moved `board2`, `chess-llm-claude`, `chess-with-llm`, `chess2`, `claude-fairgame`, `claude-fairgame2`, `claude-fairgame3`, `fairgame`, `fairgame-gpt5`, `fairgame-old`, `fairgame0`, `fairgame1`, `fairgame2`, and `fairgame3` into `archive/attempts/`.
- [x] Add `/archive/attempts/` to the top-level `.gitignore`.
  Evidence: `.gitignore` ignores `/archive/attempts/`; `git status --short --ignored` reports `!! archive/attempts/`.
- [x] Add a tracked `archive/README.md` explaining the archived attempts.
  Evidence: `archive/README.md` documents the ignored archive and key reference projects.
- [x] Update `AGENTS.md` and `roadmap.md` references after moving old attempts.
  Evidence: `AGENTS.md` top-level index now lists `archive`, `docs`, and `fairgame-rebuild`; roadmap lessons reference `archive/attempts/...` paths.
- [x] Create the clean new project folder under `/Volumes/T9/code/2-boards`.
  Evidence: Created `fairgame-rebuild/` with npm workspace structure for `packages/shared`, `packages/domain`, `apps/server`, `apps/web`, and `tests/e2e`.
- [x] Initialize a Git repository at `/Volumes/T9/code/2-boards`.
  Evidence: `git init` created the top-level repo; archived attempts are ignored and not tracked.
- [x] Choose test runner, app structure, and initial scripts.
  Evidence: Chose Vitest, Playwright, TypeScript project references, React/Vite web app, Express/Socket.IO-ready server app, npm workspace scripts in `fairgame-rebuild/package.json`.
- [x] Set up Playwright end-to-end testing and a documented browser verification command.
  Evidence: Added `fairgame-rebuild/playwright.config.ts` and `tests/e2e/bootstrap.spec.ts`; `npm run test:e2e` passed with 1 Chromium test. Built-in browser verification loaded `http://192.168.4.149:5173/` and confirmed `FairGame Rebuild`, `Board A`, and `Board B`.
- [x] Add initial README and development commands.
  Evidence: Added `fairgame-rebuild/README.md`; verification commands passed from `fairgame-rebuild`: `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.

Checkpoint: the workspace has a top-level Git repo, archived attempts are local references
only, the new product has a clean folder, and browser-based testing is available before
UI-heavy work begins.

Checkpoint 0 implementation commit: `6c933e3`.

### 1. Domain Model And Match Engine

- [x] Define generic match, player, board, move, result, and scoring types.
  Evidence: Added `packages/domain/src/types.ts` with `FairMatch`, `FairBoard`, `GameRules`, `ApplyMoveCommand`, `ApplyMoveResult`, `MatchScore`, and `MatchOutcome`.
- [x] Implement the server-side fair-match engine that composes two independent boards.
  Evidence: Added `packages/domain/src/engine.ts` and `packages/domain/src/scoring.ts`; `createFairMatch` creates board A with `seat1` first and board B with `seat2` first; `applyMoveToMatch` applies valid moves to one board only.
- [x] Add tests for board assignment, independent turns, illegal move rejection, and match scoring.
  Evidence: Added `packages/domain/src/engine.test.ts` and `packages/domain/src/scoring.test.ts`; `npm test -w @fairgame/domain -- scoring engine` passed 13 tests; full verification passed with `npm run typecheck && npm test && npm run build && npm run test:e2e`.

Checkpoint: the core fairness model is proven without relying on UI behavior.

Checkpoint 1 implementation commit: `534a28b`.

### 2. TicTacToe Playable Slice

- [x] Implement TicTacToe through the generic game-rules interface.
  Evidence: Added `packages/domain/src/games/tictactoe.ts` and tests; `ticTacToeRules` owns cells, turns, occupied-cell validation, win detection, and draw detection.
- [x] Build create/join/play flow for a two-player TicTacToe match.
  Evidence: Added in-memory server match service and REST API under `/api/matches`; added React create/join/play flow in `apps/web/src/App.tsx`.
- [x] Show two boards, board-level turn state, board results, and match result.
  Evidence: Web UI shows board A/B, per-board to-move/result labels, current seat, score, and match outcome.
- [x] Verify that two players can finish both boards and receive the correct combined result.
  Evidence: Playwright two-context flow completed board A and board B with final `1 - 1` draw match; server API tests verify final combined score.
- [x] Add Playwright coverage for the basic TicTacToe create, join, play, and finish flow.
  Evidence: Replaced bootstrap E2E with `tests/e2e/tictactoe.spec.ts`; full verification passed with `npm run typecheck && npm test && npm run build && npm run test:e2e`. Built-in browser verification loaded `http://192.168.4.149:5173/`, created a match, confirmed board A/B visibility, Player 1 seat, board A cell enabled, and board B cell disabled.

Checkpoint: the product is playable end-to-end with the simplest supported game.

Checkpoint 2 implementation commit: `36fc701`.

### 3. Real-Time Room Flow

- [x] Add real-time state updates for both players.
  Evidence: Added Socket.IO room watching in `apps/server/src/realtime.ts`, match update listeners in `MatchService`, and `socket.io-client` subscriptions in the web app.
- [x] Add invite link or join code.
  Evidence: Existing join code remains visible; web match view now shows an invite URL using `?match=<id>`.
- [x] Add refresh/reconnect handling.
  Evidence: Create/join routes set HTTP-only seat-claim cookies; `GET /api/matches/:id/session` restores Player 1/Player 2 after reload.
- [x] Add spectator/read-only state.
  Evidence: Session restore without a valid seat cookie returns `seat: null`; web UI shows `Spectator` and disables board cells.
- [x] Add Playwright coverage for refresh, reconnect, and spectator behavior.
  Evidence: Updated `tests/e2e/tictactoe.spec.ts` to verify Player 1 reload, Player 2 reload, live updates without manual refresh, and read-only spectator updates. Full verification passed with `npm install && npm run typecheck && npm test && npm run build && npm run test:e2e`. Built-in browser verification loaded `http://192.168.4.149:5173/?match=7966176c-f64a-4554-85cf-cdcf5e449e45`, confirmed `Spectator`, both boards, visible invite URL, and disabled board A cell.

Checkpoint: multiple clients converge on the same server state during and after refresh.

Checkpoint 3 implementation commit: `4c7f421`.

### 4. Persistence And Recovery

- [x] Persist matches and moves in durable PGlite storage.
  Evidence: Added PGlite-backed match persistence under `fairgame-rebuild/apps/server/src/persistence`, wired `MatchService` to persist create/join/move commands, and configured startup hydration from `FAIRGAME_DB_DIR` or `.data/pglite`.
- [x] Decide and document the persistence shape: event log, snapshots, or both.
  Evidence: User chose both event log and snapshots on 2026-05-27; technical defaults document this decision.
- [x] Implement append-only event storage for match commands/events.
  Evidence: Added `match_events` schema and repository `appendEvent()` calls for `match.created`, `seat.joined`, and `move.applied`.
- [x] Implement current match snapshots as the fast load path.
  Evidence: Added `match_snapshots` schema and repository `saveSnapshot()` / `loadSnapshots()` methods storing serializable match, joined-seat, and seat-claim state.
- [x] Restore active matches after server restart.
  Evidence: Server startup opens PGlite, calls `matchService.loadFromRepository()`, and hydrates active matches before registering realtime handlers.
- [x] Add verification for create, move, restart, reload, continue.
  Evidence: Added `apps/server/tests/persistence.test.ts`; full verification passed with `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-27.

Checkpoint: matches survive process restarts without losing canonical state.

Checkpoint 4 implementation commit: `7e9d7cd`.

### 5. Connect Four

- [x] Implement Connect Four through the same game-rules interface.
  Evidence: Added `packages/domain/src/games/connectFour.ts` with a `GameRules` implementation and added a server game registry so `MatchService` delegates game creation, move parsing, move application, and board projection.
- [x] Add Connect Four legal move, win, draw, and illegal move tests.
  Evidence: Added `packages/domain/src/games/connectFour.test.ts` covering initial state, gravity, wrong-seat rejection, full columns, vertical/horizontal/diagonal wins, and draw detection.
- [x] Extend the UI game selector and board renderer without changing match orchestration.
  Evidence: Added a setup-time game selector, typed game/move API calls, discriminated board views, a Connect Four column renderer, server API tests, and Playwright coverage for finishing both Connect Four boards. Full verification passed with `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-27. Built-in browser verification loaded `http://192.168.4.149:5173/`, created a Connect Four match, confirmed board A/B visibility, Board A column 1 enabled for Player 1, Board B column 1 disabled for Player 1, and Board A disabled after Player 1 moved.

Checkpoint: a second game proves the match engine is genuinely reusable.

Checkpoint 5 implementation commit: `abbd04c`.

### 6. Clock System

- [x] Add shared player clocks.
  Evidence: Added pure domain clock types/functions in `packages/domain/src/clocks.ts`, persisted clock snapshots, and projected `match.clock` through the server and web UI.
- [x] Make a player's clock run when that player is to-move on at least one unfinished board.
  Evidence: `MatchService` starts clocks only after both seats join, uses the game registry to compute active seats from unfinished boards, and supports both seats running at once.
- [x] Add increments and timeout handling.
  Evidence: Accepted moves charge elapsed time, add increment to the mover, recompute running seats, and resolve unfinished boards by `timeout` or `mutual-timeout` when clocks expire.
- [x] Test clock behavior when a player is to-move on zero, one, or two boards.
  Evidence: Added `packages/domain/src/clocks.test.ts` and server tests with injected time for no-running, one-running, two-running, post-move increment, and timeout behavior. Full verification passed with `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-27. Built-in browser verification loaded `http://192.168.4.149:5173/`, created a TicTacToe match, confirmed both player clocks showed `5:00` paused before Player 2 joined, and confirmed Board A was playable for Player 1.

Checkpoint: timed matches work without breaking independent board turns.

Checkpoint 6 implementation commit: `df84fe5`.

### 7. Chess

- [x] Implement chess as a rules adapter using `chess.js`.
  Evidence: Added `chess.js` to `@fairgame/domain` and implemented `packages/domain/src/games/chess.ts` with coordinate moves, FEN state, color-to-seat mapping, and generic outcomes.
- [x] Support legal moves, check, checkmate, stalemate, draws, promotion, castling, and en passant.
  Evidence: Added `packages/domain/src/games/chess.test.ts` covering legal/illegal moves, Fool's Mate checkmate, stalemate, castling, en passant, and promotion.
- [x] Add chess-specific UI interactions and move history.
  Evidence: Added Chess to the game selector, server chess board views with squares and move history, an 8x8 web chess renderer, click source/destination move input, and per-board move history.
- [x] Verify both-board chess scoring and match completion.
  Evidence: Added server tests for a two-board Fool's Mate match scoring `1 - 1`, plus Playwright coverage for creating a Chess match and making `e2-e4`. Full verification passed with `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-27. Built-in browser verification loaded `http://192.168.4.149:5173/`, created a Chess match, confirmed Board A `e2` was enabled for Player 1, Board B `e2` was disabled, made `e2-e4`, confirmed a white pawn on `e4`, and confirmed move history showed `e4`.

Checkpoint: chess works as another game plugged into the same fair-match system.

Checkpoint 7 implementation commit: `1746f23`.

### 8. UX Hardening

- [ ] Improve active-board and active-player affordances.
  Evidence: Not started.
- [ ] Add player names, rematch, copy invite link, and match history view.
  Evidence: Not started.
- [ ] Improve desktop and mobile layouts.
  Evidence: Not started.
- [ ] Add browser tests for create, join, play, finish, reconnect, and spectator flows.
  Evidence: Not started.

Checkpoint: the product is comfortable to use repeatedly, not just technically playable.

### 9. Production Hardening

- [ ] Add authentication if needed.
  Evidence: Not started.
- [ ] Add deployment configuration.
  Evidence: Not started.
- [ ] Add logging, health checks, error reporting, rate limits, and stale game cleanup.
  Evidence: Not started.
- [ ] Add database migrations or equivalent schema-management process.
  Evidence: Not started.

Checkpoint: the product can be operated beyond local development.

## Lessons From Prior Attempts

- `archive/attempts/fairgame-gpt5` has the best compact two-board model, but client-side PouchDB writes
  should not be reused as the authority model.
- `archive/attempts/board2` has useful chess-rule reference code and tests, but the new chess path should
  prefer `chess.js` unless there is a deliberate reason to own the engine.
- `archive/attempts/chess2` demonstrates real double-board chess, color assignment, scoring, and timer
  ideas, but its custom chess rules are risky.
- `archive/attempts/claude-fairgame` has useful timer ideas, especially around shared vs separate clocks
  and increments.
- `archive/attempts/fairgame2` has a useful compositional `DualBoardGame` idea, but the game logic and
  tests are not reliable enough to reuse directly.
- `archive/attempts/fairgame-old` shows the main design mistake to avoid: one global turn/current-board
  model for two independent boards.
