# Fair Two-Board Game Roadmap

Last updated: 2026-05-28

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

### 10. Seven More Board Games

- [x] Add seven additional game plug-ins without changing generic match orchestration.
  Evidence: Started on 2026-05-28 in gate worktree `.worktrees/add-seven-games-gate` on branch `codex/add-seven-games-gate`. Design saved to `docs/superpowers/specs/2026-05-28-seven-board-games-design.md`; implementation plan saved to `docs/superpowers/plans/2026-05-28-seven-board-games.md`. Baseline verification before implementation passed with `npm run typecheck` and `npm test`.
- [x] Implement domain rules and tests for Gomoku, Hex, Reversi, Breakthrough, Mancala, Dots and Boxes, and Order and Chaos.
  Evidence: Gomoku commit `430c744`, Hex commit `c115149`, Reversi commit `fa5e01b`, Breakthrough commit `60018a5`, Mancala commit `96afae5`, Dots and Boxes commit `0078bf2`, and Order and Chaos commit `a34d19b` merged into gate; focused domain tests passed in their worker worktrees.
- [x] Integrate all seven games into server registry, web game picker, board renderers, API tests, web tests, and e2e flows.
  Evidence: Updated `packages/domain/src/index.ts`, `apps/server/src/matches/gameRegistry.ts`, `apps/server/src/matches/routes.ts`, `apps/server/tests/matches.test.ts`, `apps/web/src/types.ts`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/styles.css`, and `tests/e2e/tictactoe.spec.ts`; added SVG thumbnails under `apps/web/public/game-thumbnails/`.
- [x] Verify and record final gate branch commit.
  Evidence: Final verification passed with `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-28. Unit totals: shared 2, domain 95, server 42, web 17. Playwright passed 6 Chromium tests, including opening moves for all seven added games. Built-in browser verification was attempted after starting the local dev server, but no in-app browser backend was available (`agent.browsers.list()` returned `[]`), so Playwright browser automation is the UI verification evidence. Gate commit: `3fca2f0`.

Checkpoint 6 implementation commit: `df84fe5`.

### 7. Chess

- [x] Implement chess as a rules adapter using `chess.js`.
  Evidence: Added `chess.js` to `@fairgame/domain` and implemented `packages/domain/src/games/chess.ts` with coordinate moves, FEN state, color-to-seat mapping, and generic outcomes.
- [x] Support legal moves, check, checkmate, stalemate, draws, promotion, castling, and en passant.
  Evidence: Added `packages/domain/src/games/chess.test.ts` covering legal/illegal moves, Fool's Mate checkmate, stalemate, castling, en passant, and promotion.
- [x] Add chess-specific UI interactions and move history.
  Evidence: Added Chess to the game selector, server chess board views with squares and move history, an 8x8 web chess renderer, click source/destination move input, and per-board move history.
  Follow-up 2026-05-28: Replaced the custom 8x8 web chess renderer with `react-chessboard` while keeping server-authoritative `chess.js` move validation, FEN state, click source/destination input, drag/drop input, and per-board move history.
- [x] Verify both-board chess scoring and match completion.
  Evidence: Added server tests for a two-board Fool's Mate match scoring `1 - 1`, plus Playwright coverage for creating a Chess match and making `e2-e4`. Full verification passed with `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-27. Built-in browser verification loaded `http://192.168.4.149:5173/`, created a Chess match, confirmed Board A `e2` was enabled for Player 1, Board B `e2` was disabled, made `e2-e4`, confirmed a white pawn on `e4`, and confirmed move history showed `e4`.
  Follow-up 2026-05-28: Re-verified with `npm run typecheck`, `npm test`, `npm run build`, `PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e`, and an in-app browser smoke test that created a Chess match, rendered two `react-chessboard` boards, made `e2-e4`, and showed `e4` in move history.

Checkpoint: chess works as another game plugged into the same fair-match system.

Checkpoint 7 implementation commit: `1746f23`.

### 8. UX Hardening

- [x] Improve active-board and active-player affordances.
  Evidence: Added active-board styling and `Your move` affordances for TicTacToe, Connect Four, and Chess board renderers; built-in browser verification confirmed Board A as the only active board for Player 1 while Board B was disabled.
- [x] Add player names, rematch, copy invite link, and match history view.
  Evidence: Added generic player-name metadata to match snapshots and `MatchView`, setup name inputs, copy-invite feedback, completed-match rematch control, and local recent-match history.
- [x] Improve desktop and mobile layouts.
  Evidence: Added match action layout, recent-match panel styling, active-board focus treatment, screen-reader-only utility text, and tightened board panel affordances in `apps/web/src/styles.css`.
- [x] Add browser tests for create, join, play, finish, reconnect, and spectator flows.
  Evidence: Added web tests for player-name inputs, copy invite, recent history, and rematch; existing Playwright E2E coverage remained green for create/join/play/finish, reconnect/refresh/spectator, Connect Four, and Chess smoke flows. Full verification passed with `npm install` and fresh `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-27. Built-in browser verification loaded `http://192.168.4.149:5173/`, created a TicTacToe match as `Clara`, confirmed `Clara (Player 1)`, active Board A, disabled Board B cells, `Copy invite` -> `Copied`, and recent-match history.

Checkpoint: the product is comfortable to use repeatedly, not just technically playable.

Checkpoint 8 implementation commit: `cbd1cd7`.

Post-checkpoint UX feedback revision (2026-05-27):

- [x] Replace typed player-name and match-code setup with a lobby-first quick create/join flow.
  Evidence: Referenced `archive/attempts/fairgame-gpt5/web/src/ui/GameLobby.tsx` for the compact lobby pattern. Changed `fairgame-rebuild/apps/server/src/matches/matchService.ts`, `fairgame-rebuild/apps/server/src/matches/matchView.ts`, `fairgame-rebuild/apps/server/src/matches/routes.ts`, `fairgame-rebuild/apps/server/tests/matches.test.ts`, `fairgame-rebuild/apps/web/src/api.ts`, `fairgame-rebuild/apps/web/src/types.ts`, `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, `fairgame-rebuild/apps/web/src/styles.css`, and `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`. Added `GET /api/matches` for newest open matches, removed normal lobby name/code inputs, capped and scrolled the open-game list, and changed E2E joins to click the listed game row.
  Verification: Red tests failed first with missing `GET /api/matches` and existing name/code UI. After implementation, `npm run typecheck`, `npm test`, `npm run build`, and `PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e` passed on 2026-05-27. Built-in browser verification loaded `http://127.0.0.1:5173/`, confirmed no name/code inputs, created TicTacToe match `6d65f9f8-4613-4a07-ab0b-d276d80d5cfc`, joined it from a second browser tab by clicking `Join 6d65f9f8-4613-4a07-ab0b-d276d80d5cfc`, and confirmed the second tab entered as Player 2.

- [x] Hide internal GUIDs from the lobby and stop tests from polluting open games.
  Evidence: Updated `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, and `fairgame-rebuild/tests/e2e/tictactoe.spec.ts` so open/recent/match views display friendly labels while keeping match ids only in internal data attributes and invite-copy state. Updated the Chess smoke E2E to join Player 2 so repeated runs no longer leave never-joined Chess rows in the persistent dev lobby. Cleared 14 existing local test-created open Chess rows through the local API.
  Verification: `npm run typecheck && npm test && npm run build && PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e` passed on 2026-05-27. Built-in browser verification loaded `http://127.0.0.1:5173/`, confirmed `No open games.`, and confirmed recent rows render as `Recent game 1` / `Recent game 2` without visible GUIDs.

- [x] Split game selection from game-specific lobbies.
  Evidence: Updated `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, `fairgame-rebuild/apps/web/src/styles.css`, and `fairgame-rebuild/tests/e2e/tictactoe.spec.ts` so the first screen is a game picker and each game opens its own filtered lobby with create, open-game join, and recent-match rows scoped to that game.
  Verification: Red App tests failed first against the old combined lobby. After implementation, `npm run typecheck`, `npm test`, `npm run build`, and `PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e` passed on 2026-05-27. Built-in browser verification loaded `http://127.0.0.1:5173/`, confirmed the game picker, opened the Chess lobby, confirmed `Create Chess match` and Chess-scoped open games, then returned the browser to the picker for manual testing.

- [x] Add GPT-generated images to game-picker cards.
  Evidence: Generated project-bound PNG thumbnails for TicTacToe, Connect Four, and Chess with the built-in GPT image tool, saved them under `fairgame-rebuild/apps/web/public/game-thumbnails/`, removed the earlier SVG thumbnails, and updated `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, and `fairgame-rebuild/apps/web/src/styles.css` so each card shows its generated bitmap preview.
  Verification: Red App test failed first because the app still referenced `.svg` image sources. After implementation, `npm test -w @fairgame/web -- App`, `npm run typecheck`, `npm run build`, `npm test`, and `PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e` passed on 2026-05-28. Built-in browser verification loaded `http://127.0.0.1:5173/`, confirmed all three preview images loaded from `.png` paths with nonzero natural dimensions, and captured the updated picker.

- [x] Add simple quick-pairing and custom total-time creation controls.
  Evidence: Updated `fairgame-rebuild/apps/server/src/matches/matchService.ts`, `fairgame-rebuild/apps/server/src/matches/matchView.ts`, `fairgame-rebuild/apps/server/src/matches/routes.ts`, `fairgame-rebuild/apps/server/tests/matches.test.ts`, `fairgame-rebuild/apps/web/src/api.ts`, `fairgame-rebuild/apps/web/src/types.ts`, `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, and `fairgame-rebuild/apps/web/src/styles.css`. Match creation now accepts a per-match `clockInitialMs`, validates game-specific total-time ranges, creates clocks with `incrementMs: 0`, shows 3/5/10 minute quick-create buttons, exposes a compact custom minutes stepper, hides native number-input spinner buttons, preserves match time on rematch, and displays time controls in open-game rows. Current custom ranges are TicTacToe 1-10 minutes, Connect Four 2-20 minutes, and Chess 3-60 minutes.
  Verification: Red server and web tests failed first because custom clock input, quick pairing controls, open-game time display, compact minutes UI, and game-specific ranges were missing. After implementation, `npm test -w @fairgame/server -- matches`, `npm test -w @fairgame/web -- App.test.tsx`, `npm run typecheck`, `npm test`, `npm run build`, and `PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e` passed on 2026-05-28. Built-in browser verification loaded `http://127.0.0.1:5173/`, opened TicTacToe, Connect Four, and Chess lobbies, confirmed no `Minutes per side` label, confirmed ranges `1-10 min`, `2-20 min`, and `3-60 min`, and later confirmed the focused minutes field no longer shows native up/down spinner buttons.

- [x] Add route-aware app navigation and browser back/forward support.
  Evidence: Updated `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, `fairgame-rebuild/apps/web/src/styles.css`, and `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`. Root cause: lobby selection was held only in React state, match URLs used `history.replaceState`, and the app did not listen for `popstate`. This first pass used query-backed routes for browser history; the next item replaces those with path-style canonical URLs.
  Verification: Red App tests failed first with missing `?game=chess` history and no match-to-lobby back entry. After implementation, `npm test -w @fairgame/web -- App`, `npm run typecheck && npm test && npm run build`, and `PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e` passed on 2026-05-28. Built-in browser verification loaded `http://127.0.0.1:5173/`, confirmed primary navigation, opened `?game=chess`, and returned to `/` with the Games nav.

- [x] Replace query-parameter routes with path-style URLs.
  Evidence: Updated `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, and `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`. Canonical routes are now `/games/:gameType` and `/matches/:matchId`; copied invite links use `/matches/:matchId`; old `?game=` and `?match=` links are still accepted and immediately replaced with canonical path URLs.
  Verification: Red App tests failed first because the app still emitted `/?game=chess`, `/?match=match-nav`, and copied `?match=` invite links. After implementation, `npm test -w @fairgame/web -- App` and `npm run typecheck && npm test && npm run build && PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e` passed on 2026-05-28. Built-in browser verification confirmed `http://127.0.0.1:5173/games/chess` and canonicalized `http://127.0.0.1:5173/?match=7c5a04e4-d29e-4104-ab80-287407ac7a8c` to `http://127.0.0.1:5173/matches/7c5a04e4-d29e-4104-ab80-287407ac7a8c`.

### 9. Production Hardening

- [x] Add authentication if needed.
  Evidence: Account authentication is deliberately deferred because the product has no account-owned data yet; seat ownership remains the authorization boundary. Added typed production config and secure-cookie defaults so HTTP-only seat cookies are secure by default in production.
- [x] Add deployment configuration.
  Evidence: Added single-process static web serving, production same-origin API URLs, Node-runnable ESM builds, `Dockerfile`, `.dockerignore`, `.env.example`, and `fairgame-rebuild/docs/deployment.md`.
- [x] Add logging, health checks, error reporting, rate limits, and stale game cleanup.
  Evidence: Added `helmet`, `pino-http`, API rate limits, CORS allow-list handling, `/ready`, stable JSON API 404/error responses, startup cleanup scheduling, and stale snapshot pruning for completed or never-joined matches while preserving event history.
- [x] Add database migrations or equivalent schema-management process.
  Evidence: Added a PGlite migration runner with `schema_migrations`, recorded `001_initial_persistence`, repository health checks, and tests proving migration idempotency. Full verification passed with `npm install` and fresh `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-27. Built-in browser verification loaded the compiled production server at `http://127.0.0.1:4100/`, created a TicTacToe match, confirmed same-origin API behavior, and verified `/ready`.

Checkpoint: the product can be operated beyond local development.

Checkpoint 9 implementation commit: `54193e2`.

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
