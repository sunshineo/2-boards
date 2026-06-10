# Fair Two-Board Game Roadmap

Last updated: 2026-06-09

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
  Evidence: User approved moving the old pre-rebuild attempts out of the repo on 2026-05-27 and initializing a top-level Git repo. The old attempts were kept outside version control as personal reference material and are no longer referenced by this repository.
- [x] Create the clean new project folder at the repository root.
  Evidence: Created `fairgame-rebuild/` with npm workspace structure for `packages/shared`, `packages/domain`, `apps/server`, `apps/web`, and `tests/e2e`.
- [x] Initialize a Git repository at the repository root.
  Evidence: `git init` created the top-level repo; old attempts are not tracked.
- [x] Choose test runner, app structure, and initial scripts.
  Evidence: Chose Vitest, Playwright, TypeScript project references, React/Vite web app, Express/Socket.IO-ready server app, npm workspace scripts in `fairgame-rebuild/package.json`.
- [x] Set up Playwright end-to-end testing and a documented browser verification command.
  Evidence: Added `fairgame-rebuild/playwright.config.ts` and `tests/e2e/bootstrap.spec.ts`; `npm run test:e2e` passed with 1 Chromium test. Built-in browser verification loaded `http://192.168.4.149:5173/` and confirmed `FairGame Rebuild`, `Board A`, and `Board B`.
- [x] Add initial README and development commands.
  Evidence: Added `fairgame-rebuild/README.md`; verification commands passed from `fairgame-rebuild`: `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.

Checkpoint: the workspace has a top-level Git repo, the new product has a clean folder,
and browser-based testing is available before UI-heavy work begins.

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
  Evidence: Create/join routes set HTTP-only seat-claim cookies; `GET /api/matches/:id/session` restores Player 1/Player 2 after reload. 2026-05-28 follow-up: opening a match URL without a valid seat cookie now claims Player 2 while the second seat is open.
- [x] Add spectator/read-only state.
  Evidence: After both seats are joined, session restore without a valid seat cookie returns `seat: null`; read-only board cells prevent spectator moves.
- [x] Add Playwright coverage for refresh, reconnect, and spectator behavior.
  Evidence: Updated `tests/e2e/tictactoe.spec.ts` to verify Player 1 reload, Player 2 reload, live updates without manual refresh, and read-only spectator updates. Full verification passed with `npm install && npm run typecheck && npm test && npm run build && npm run test:e2e`. Built-in browser verification loaded `http://192.168.4.149:5173/?match=7966176c-f64a-4554-85cf-cdcf5e449e45`, confirmed `Spectator`, both boards, visible invite URL, and disabled board A cell. 2026-05-28 follow-up: TicTacToe E2E now has Player 2 join by opening `/matches/:id` directly; verification passed with `npm run typecheck`, `npm test`, `npm run build`, and `PLAYWRIGHT_REUSE_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_API_URL=http://127.0.0.1:4100 npm run test:e2e`.

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
  Evidence: Updated `packages/domain/src/index.ts`, `apps/server/src/matches/gameRegistry.ts`, `apps/server/src/matches/routes.ts`, `apps/server/tests/matches.test.ts`, `apps/web/src/types.ts`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/styles.css`, and `tests/e2e/tictactoe.spec.ts`; added high-fidelity GPT-generated PNG thumbnails under `apps/web/public/game-thumbnails/`.
- [x] Verify and record final gate branch commit.
  Evidence: Final verification passed with `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-28. Unit totals after review fixes: shared 2, domain 96, server 44, web 18. Playwright passed 6 Chromium tests, including opening moves for all seven added games. Built-in browser verification was attempted after starting the local dev server, but no in-app browser backend was available (`agent.browsers.list()` returned `[]`), so Playwright browser automation is the UI verification evidence. Gate feature commit: `299a5d5`; review-fix code commit: `8884b9f`.
- [x] Address code review feedback before handoff.
  Evidence: Commit `8884b9f` corrected Breakthrough first-seat orientation on mirrored boards, aligned server playable Breakthrough move projection, rendered Dots and Boxes as a dot/edge/box grid with owned boxes, added invalid move-shape API coverage for the seven added games, and updated e2e assertions for the grid UI. Verification passed with `npm run typecheck && npm test && npm run build && npm run test:e2e` on 2026-05-28.
- [x] Replace low-fidelity added-game thumbnails with high-fidelity generated images.
  Evidence: Commit `3c06916` replaced the seven new-game SVG thumbnails with GPT-generated 1672x941 PNGs for Gomoku, Hex, Reversi, Breakthrough, Mancala, Dots and Boxes, and Order and Chaos, and updated app/test image paths. Verification passed with `npm test -w @fairgame/web -- App && npm run typecheck && npm run build` on 2026-05-28.

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
  Follow-up 2026-06-05: Chess board panels no longer render visible `Board A`/`Board B` headings; board IDs remain available through section labels while the larger status badge carries the header. Active `Your move` statuses reuse the running-clock green background and border, while inactive statuses stay white. Verification passed with `npm test -w @fairgame/web -- App -t "shows active Chess targets"`, `npm test -w @fairgame/web -- App`, `npm test -w @fairgame/web`, `npm run typecheck`, and `npm run build`. Built-in browser verification at `http://localhost:5176/games/chess` confirmed zero `Board A`/`Board B` heading roles, hidden board labels at `1x1`, active status styling at `rgb(223, 240, 207)` with border `rgb(106, 161, 39)`, a post-move transition to white `Opponent to move`, and no header overlap.
  Follow-up 2026-06-05: Active Chess `Your move` status badges now slowly pulse their green background and glow without changing size, with reduced-motion users receiving a static badge. Updated `apps/web/src/styles.css` and added `apps/web/src/styles.test.ts`; red CSS contract test first failed because the pulse animation did not exist. Verification passed with `npm test -w @fairgame/web -- styles`, `npm test -w @fairgame/web -- App`, `npm test -w @fairgame/web`, `npm run typecheck`, and `npm run build`. Built-in browser verification at `http://localhost:5176/games/chess` confirmed `animation-name: chess-turn-status-pulse`, `animation-duration: 2.8s`, infinite easing, and computed background/glow changes during the pulse.
  Follow-up 2026-06-05: Adjusted the active Chess status pulse to animate the whole badge fill instead of the outer glow. The glow now stays fixed at `2px`, while `background-color` pulses from light green to stronger green. Verification passed with `npm test -w @fairgame/web -- styles`, `npm test -w @fairgame/web`, `npm run typecheck`, and `npm run build`; browser verification confirmed changing computed background colors with unchanged `box-shadow`.
  Follow-up 2026-06-05: Increased the active Chess status pulse contrast so the full badge fill now moves from green to pure white and back to green. Verification passed with `npm test -w @fairgame/web -- styles`, `npm test -w @fairgame/web`, `npm run typecheck`, and `npm run build`; browser verification confirmed the active status reached `rgb(255, 255, 255)` during the pulse and returned toward green with the `2px` shadow unchanged.
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
  Evidence: Referenced an earlier prototype's compact lobby pattern. Changed `fairgame-rebuild/apps/server/src/matches/matchService.ts`, `fairgame-rebuild/apps/server/src/matches/matchView.ts`, `fairgame-rebuild/apps/server/src/matches/routes.ts`, `fairgame-rebuild/apps/server/tests/matches.test.ts`, `fairgame-rebuild/apps/web/src/api.ts`, `fairgame-rebuild/apps/web/src/types.ts`, `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, `fairgame-rebuild/apps/web/src/styles.css`, and `fairgame-rebuild/tests/e2e/tictactoe.spec.ts`. Added `GET /api/matches` for newest open matches, removed normal lobby name/code inputs, capped and scrolled the open-game list, and changed E2E joins to click the listed game row.
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

### 11. Lichess-Like Chess Experience

- [x] Make the Chess experience closer to lichess-style play while preserving the two-board model.
  Evidence: Started and completed on 2026-06-03 in worktree `.worktrees/lichess-like-chess` on branch `codex/lichess-like-chess`. Implementation plan saved to `docs/superpowers/plans/2026-06-03-lichess-like-chess.md`. Changed `packages/domain/src/games/chess.ts`, `packages/domain/src/games/chess.test.ts`, `apps/server/src/matches/gameRegistry.ts`, `apps/server/tests/matches.test.ts`, `apps/web/src/types.ts`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/styles.css`, and `tests/e2e/tictactoe.spec.ts`. Added server-projected legal chess moves, turn color, check state, checked king square, move number, richer chess board interaction, last-move, legal-target, checked-king, current-move highlighting, per-board flip controls, board-local move replay, per-board resign controls, per-board draw-offer controls, promotion choice handling, player/captured-material rows with board-local clocks and material advantage, per-board move history, and an active-match polling fallback guarded against move races. Removed the generic top clock strip for Chess once board-local clocks were present. Verification passed with `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. Playwright e2e passed in focused slices against a disposable built API backed by `pg-mem` and Vite: `browser history|player can make an opening Chess move`, `two players can finish both TicTacToe boards`, `two players can finish both Connect Four boards|Connect Four columns contain all six slots`, and `players can make opening moves in the added board games`. Manual Playwright smoke created a Chess match, joined Player 2, verified Board A `White (You)`, Board B `Black (You)`, selected `e2`, verified `e4` as a legal destination, played `e4`, and confirmed Board A move history showed `e4`; screenshot saved at `/tmp/fairgame-chess-smoke.png`. Follow-up Playwright smoke verified no generic `Clocks` region for Chess, full player labels in the two-board layout, and board-local clocks ticking from `5:00` to `4:59`; screenshot saved at `/tmp/fairgame-chess-board-clocks-wide.png`. Material-balance smoke played `e4 d5 exd5` on Board A, verified Board A White material advantage `+1`, and saved `/tmp/fairgame-chess-material-advantage.png`. Checked-king smoke played `e4 f5 Qh5+`, verified `Board A square e8 black king in check` had `checked-king` plus the red inset ring, and saved `/tmp/fairgame-chess-checked-king-ring.png`. Current-move smoke played `e4 e5`, verified `Board A current move e5` had `current-move`, and saved `/tmp/fairgame-chess-current-move.png`. Flip-control smoke verified initial orientations Board A `white` and Board B `black`, then verified flipping Board A changed only Board A and flipping Board B changed only Board B; screenshot saved at `/tmp/fairgame-chess-flip-board.png`. Move-replay smoke played `e4 e5`, reviewed Board A ply 1 with Board A noninteractive and Board B still live, returned Board A to live, and saved `/tmp/fairgame-chess-move-replay.png`. Resign smoke created and joined a Chess match, resigned Board A as Player 1, verified Board A showed `Opponent won` with its resign control disabled, verified Board B stayed live with its resign control enabled, and saved `/tmp/fairgame-chess-resign.png`. Draw-offer smoke created and joined a Chess match, offered a draw on Board A, verified the own-offer `Draw offered` disabled state, accepted the draw as Player 2 through the local API, verified Board A showed `Draw`, verified Board B stayed live with `Offer Draw Board B` enabled, and saved `/tmp/fairgame-chess-draw-offer.png`. Board-control history smoke created and joined a Chess match, submitted a black `drawOffer` on Board A before any white move, verified Board A move history showed `offers draw` with `current-move`, verified Board B stayed in progress with `Offer Draw Board B` enabled and `White to move`, and saved `/tmp/fairgame-chess-control-history.png`. Review-mode check-highlight follow-up added a focused DOM regression test proving an older reviewed Chess ply hides the live `checked-king` class and `in check` square label; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. Implementation commit: `dab79ed5a75c264ffd1ed94bea2f916da4aae3f6`.

  Follow-up 2026-06-04: Non-move history records now stay visible/current but are not replayable. Added a focused DOM regression test proving a board-control record such as `offers draw` is disabled and cannot enter board review mode; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Chess board headings now show explicit review status while replaying older moves. Added a focused DOM regression test proving Board A shows `Reviewing move 1` instead of the live `Your move` status while reviewing, and restores `Your move` after returning live; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Chess turn pills now switch to a neutral `Review` state while replaying older moves instead of leaking live turn/check text. Added a focused DOM regression test proving a reviewed Board A no longer shows live `Black in check`; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Chess player rows now suppress live `to-move` highlighting while replaying older moves. Added a focused DOM regression test proving Board A has no `.to-move` row in review mode and restores the live highlight after returning live; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Chess board headings now include game-specific outcome reasons for wins and draws. Added focused DOM regression tests proving a resigned board shows `Opponent won by resignation` and an accepted draw shows `Draw by agreement`; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Completed Chess boards now use a neutral result pill that includes game-specific outcome reasons instead of stale live-turn color state. Added focused DOM regression tests proving Board A result pills show `Won by resignation` and `Draw by agreement` with the `result` class and without `w`/`b` classes; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-05: Chess now uses one shared two-player clock strip for both boards again while each board keeps its own legal-move indicator dots, move history, and board controls. Updated `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, and `apps/web/src/styles.css`; removed board-local clock labels from Chess player rows; widened and compacted the Chess match layout so the two boards use the available viewport width/height, stack responsively, and keep the mobile control row visible without horizontal page overflow. Red web tests first failed because Chess still suppressed the shared `Clocks` region; a follow-up red test failed because selected legal destinations did not render explicit `.chess-legal-move-dot` markers. Verification passed with `git diff --check`, `npm run typecheck`, `npm test -w @fairgame/web -- App.test.tsx -t "shows active Chess targets"`, `npm test -w @fairgame/web -- App.test.tsx`, `npm test`, and `npm run build`. Built-in browser verification used Vite at `http://127.0.0.1:5178/`; desktop showed two large boards, one shared `Clocks` strip, zero board-local clock elements, no horizontal overflow, and after selecting the Board A `g1` knight, two visible green dots on `f3` and `h3` (`rgba(52, 168, 83, 0.86)`, `25x25` on a `726x726` board); mobile `390x844` showed a `348x348` Board A, no horizontal page overflow, and the same two visible green legal-move dots scaled to `12x12`. Commit: `c194b84`.

  Follow-up 2026-06-05: Running shared clock cards now expose `data-clock-state="running"` and use a green-tinted background so they are visually distinct from paused clock cards. Updated `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, and `apps/web/src/styles.css`; red web test first failed because clock cards had no `data-clock-state`. Verification passed with `npm test -w @fairgame/web -- App.test.tsx -t "ticks running clocks"`, `git diff --check`, `npm run typecheck`, `npm test -w @fairgame/web -- App.test.tsx`, and `npm run build`. Built-in browser verification on `http://127.0.0.1:5178/matches/4d8d3407-8ab2-4876-a890-2d327c939178` showed the paused clock at `rgb(255, 255, 255)` and the running clock at `rgb(223, 240, 207)` with green border `rgb(106, 161, 39)`.

  Follow-up 2026-06-05: Removed the Chess board Flip button, keyboard flip shortcut, header turn indicator, and bottom player/material rows so the board panels spend less vertical space on repeated color/seat labels. Updated `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, and `apps/web/src/styles.css`; red Chess tests first failed because the old Flip buttons, turn indicators, and result/draw pills still rendered. Verification passed with `npm test -w @fairgame/web -- App.test.tsx -t "Chess"`, `git diff --check`, `npm run typecheck`, `npm test -w @fairgame/web -- App.test.tsx`, and `npm run build`. Built-in browser verification on `http://127.0.0.1:5178/matches/4bf7636b-bb06-41a6-9b2e-828497320f5b` showed two boards, zero Flip buttons, zero turn indicators, zero player rows, fixed orientations (`Board A` white and `Board B` black for the current seat), move history as the only board detail, and no horizontal overflow.

  Follow-up 2026-06-04: Clicking the latest/current Chess move now keeps that board at the live interactive position instead of entering review mode for the same position. Added a focused DOM regression test proving Board A stays `data-review-ply="live"` and interactive after clicking `Board A current move e5`, while older move review still hides live check markers; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Chess clock row `running` styling is now board-local and review-aware while preserving the shared seat clock time projection. Added a focused DOM regression test proving Board A White clock keeps the `running` class when White is to move on Board A, while Board B Black clock can display the same ticking shared seat time without the `running` class when Black is not to move on Board B; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Chess board last-move highlighting now survives non-coordinate control records such as draw offers. Added a focused DOM regression test proving `offers draw` remains the current disabled history record while Board A still labels/classes `e2` and `e4` as the last move from the latest coordinate move; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Pending Chess draw offers now surface in board headings instead of being hidden behind ordinary turn status. Added focused DOM regression tests proving own offers show `Draw offer sent` and incoming offers show `Opponent offers draw` while keeping board-local draw controls; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Pending Chess draw offers now use a neutral `Draw offered` turn pill instead of stale side-to-move text. Added focused DOM regression tests proving sent and received draw offers render the `draw-offer` pill class without `w` or `b` turn-color classes; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Chess now has board-local takeback requests closer to lichess' standard action set, while preserving two-board independence. Added domain, server, and web regression tests proving takeback request, accept, and decline commands are Chess-owned board controls; accepting a Board A takeback rewinds only Board A to the prior coordinate position, leaves Board B live, and removes the taken-back coordinate move from Board A move history. Verification passed with `npm test -w @fairgame/domain -- chess.test.ts`, `npm run build:packages`, `npm test -w @fairgame/server -- matches.test.ts`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. Playwright smoke with an in-memory API and Vite created and joined a Chess match, played `e4` on Board A, requested and accepted a Board A takeback, verified Board A returned the pawn to `e2`, verified Board B stayed live, and saved `/tmp/fairgame-chess-takeback.png`.

  Follow-up 2026-06-04: Chess draw offers and resignations now use lichess-style confirmation before submitting destructive board actions. Added focused DOM regression tests proving the first click arms Board A-only `Confirm Draw Offer` / `Confirm Resign` controls without posting a move and without arming Board B, while the second click submits the existing server command; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. Playwright smoke with an in-memory API and Vite created and joined a Chess match, verified the Board A confirmation states, submitted draw offer and resignation on second click, verified Board B stayed live, and saved `/tmp/fairgame-chess-confirm-actions.png`.

  Follow-up 2026-06-04: Chess move histories now include board-local previous/next replay controls. Added a focused DOM regression test proving Board A can step from the live latest coordinate move back to the prior replayable ply and then forward to live again, while Board B replay controls remain independent and disabled without Board B moves; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke with an in-memory API and Vite created and joined a Chess match, applied `e4 e5` on Board A, verified Board A Prev entered `data-review-ply="1"` while Board B stayed live, verified Board A Next returned to `data-review-ply="live"` and interactive, and saved `/tmp/fairgame-chess-replay-navigation.png`.

  Follow-up 2026-06-04: Chess board panels now support lichess-style keyboard replay shortcuts scoped to the focused board. Added a focused DOM regression test proving Board A and Board B are keyboard-focusable, Board B ArrowLeft does not alter Board A replay state, and Board A ArrowLeft/ArrowRight steps only Board A between the prior replayable ply and the live latest move; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke with an in-memory API and Vite created and joined a Chess match, applied `e4 e5` on Board A, verified Board B ArrowLeft did not affect either board, verified Board A ArrowLeft/h entered `data-review-ply="1"` while Board B stayed live, verified Board A ArrowRight/l returned live and interactive, and saved `/tmp/fairgame-chess-keyboard-replay.png`.

  Follow-up 2026-06-04: Chess move histories now include board-local First/Last replay controls and focused-board start/end shortcuts, matching lichess-style navigation while preserving two-board independence. Added a focused DOM regression test proving Board A First enters `data-review-ply="0"` with the starting FEN, Latest returns Board A to the live latest move, Board B first/latest controls stay disabled without Board B moves, Board B ArrowUp does not affect Board A, and Board A ArrowUp/k plus ArrowDown/j jump only Board A between start and live. Verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke with an in-memory API and Vite created and joined a Chess match, applied `e4 e5` on Board A, verified First/Latest and ArrowUp/ArrowDown/k/j behavior, verified replay cards stayed within each board panel after the four-button layout change, and saved `/tmp/fairgame-chess-first-latest-replay.png`.

  Follow-up 2026-06-04: Chess board panels now support the lichess-style `f` flip shortcut scoped to the focused board, preserving two-board independence. Added a focused DOM regression test proving pressing `f` on Board B flips only Board B and pressing `f` on Board A flips only Board A; verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke created a Chess match, verified initial orientations Board A `white` and Board B `black`, pressed `f` on Board B and verified only Board B flipped to `white`, pressed `f` on Board A and verified only Board A flipped to `black`, saved `/tmp/fairgame-chess-keyboard-flip.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.

  Follow-up 2026-06-04: Chess now has a two-board Zen mode inspired by lichess' `z` shortcut, removing app chrome and the match summary while keeping both boards, clocks, move history, and board controls visible. Added a focused DOM regression test proving `z` toggles `data-zen-mode`, hides the heading, primary navigation, and match summary, keeps both Chess boards mounted, and restores the normal shell when pressed again. Verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke created a Chess match, verified Zen on/off behavior through `z`, saved `/tmp/fairgame-chess-zen-mode.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.

  Follow-up 2026-06-04: Chess board panels now support lichess-style scroll-wheel replay navigation scoped to the board under the cursor. Added a focused DOM regression test proving wheel-up over Board B does not affect Board A, wheel-up over Board A enters Board A replay ply 1, and wheel-down over Board A returns Board A to live while Board B stays live. Verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke created and joined a Chess match, seeded `e4 e5` on Board A, verified board-scoped wheel replay behavior, saved `/tmp/fairgame-chess-wheel-replay.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.

  Follow-up 2026-06-04: Chess boards now support lichess-style right-click annotation circles scoped to each board. Added a focused DOM regression test proving right-clicking Board A `e4` creates a green circle only on Board A, shift-right-clicking Board B `e4` creates a red circle only on Board B, and repeating the same Board A gesture removes only Board A's circle. Verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke created a Chess match, verified Board A/Board B annotation labels and classes stayed independent, verified toggling Board A off left Board B's red circle intact, saved `/tmp/fairgame-chess-annotation-circles.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.

  Follow-up 2026-06-04: Chess boards now support lichess-style right-click drag annotation arrows scoped to each board. Added a focused DOM regression test proving right-dragging Board A `e2` to `e4` creates a green arrow only on Board A, shift-right-dragging Board B `e7` to `e5` creates a red arrow only on Board B, drag gestures do not create unwanted circles, and repeating the same Board A arrow gesture removes only Board A's arrow. Verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. During verification, a full-suite run exposed an intermittent Zen shortcut listener race; fixed it by mounting the window key listener once and reading current Chess-match state from a ref, then reran and passed the same verification commands. Standalone Playwright smoke with an in-memory API and Vite verified true right-button drag arrows, Board A/Board B independence, no unwanted circle creation, Board A arrow toggle removal, saved `/tmp/fairgame-chess-annotation-arrows.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.

  Follow-up 2026-06-04: Chess boards now support lichess-style empty-square left-click clearing for board-local annotations. Added a focused DOM regression test proving Board A can clear its own annotation circle and arrow by left-clicking an empty square while Board B's circle and arrow remain intact. Verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke verified Board A circle clearing while Board B's circle remained and saved `/tmp/fairgame-chess-annotation-clear-circles.png`. Standalone Playwright smoke verified Board A circle/arrow clearing while Board B's red circle and red arrow remained, saved `/tmp/fairgame-chess-annotation-clear.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.

  Follow-up 2026-06-04: Chess promotion now uses a lichess-style destination-square picker instead of a fixed corner dialog. Added a focused DOM regression test proving Board A's promotion chooser anchors to the target square with board-orientation metadata and square grid variables. Verification passed with `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. Standalone Playwright smoke with Vite and mocked API routes opened a deterministic Board A promotion position, clicked `a7` to `a8`, verified the chooser was anchored to `a8` at the top-left of Board A, clicked `Promote to queen`, verified the submitted move payload included `promotion: "q"`, saved `/tmp/fairgame-chess-promotion-picker.png`, then stopped Vite and confirmed port 5174 was clear.

  Follow-up 2026-06-04: Chess boards now support board-local premoves for the waiting player, closer to lichess' move-ahead interaction while preserving two-board independence. Added a focused DOM regression test proving Black can queue `e7-e5` on waiting Board B without posting immediately, Board B shows `premove-source` and `premove-target` states, Board A is unaffected, and the queued move auto-submits only after Board B becomes actionable with a matching server-projected legal move. Verification passed with `npm test -w @fairgame/web -- App.test.tsx -t "queues and submits a board-local Chess premove"`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke with a disposable built frontend/API fixture created a Chess match, queued Board B `e7-e5`, verified the premove labels/classes while Board B remained noninteractive, triggered the board-ready update, verified the submitted payload was `{ boardId: "B", seat: "seat1", move: { from: "e7", to: "e5" } }`, verified the premove highlights cleared when Board B became actionable, saved `/tmp/fairgame-chess-premove.png`, and confirmed port 4175 was clear after stopping the smoke server.

  Follow-up 2026-06-04: Board-local Chess premoves can now be canceled before they submit, matching the control players expect after queueing a move ahead. Added a focused DOM regression test proving right-clicking the queued Board B premove target clears `premove-source` and `premove-target`, does not create an annotation during the cancel gesture, does not submit a move, and allows a subsequent normal right-click annotation on the same square. Verification passed with `npm test -w @fairgame/web -- App.test.tsx -t "cancels a queued board-local Chess premove"`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-04: Chess board panels now support board-scoped Escape cancellation for transient move-entry state. Added a focused DOM regression test proving Escape on Board B clears a queued `e7-e5` premove before it submits, restoring normal square labels and leaving the move endpoint untouched. Verification passed with `npm test -w @fairgame/web -- App.test.tsx -t "cancels a queued board-local Chess premove with Escape"`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`.

  Follow-up 2026-06-09: Fixed the Chess premove target helper to use `chess.js` attack data for waiting-player premove destinations, so a player can queue a recapture onto a currently own-occupied square and the queued premove remains server-authoritative at submit time. Added click-elsewhere premove cancellation for any third square outside the queued source/target. Files changed: `packages/domain/src/games/chess.ts`, `apps/web/src/games/renderers.tsx`, `apps/web/src/App.test.tsx`, and `roadmap.md`. Verification passed with `npm run build:packages`, `npm test -w @fairgame/web -- App.test.tsx -t 'recapture premove|clicking a different square'`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build`. In-app browser smoke on `http://localhost:5173/` created and joined a local Chess match, queued Board B `e7-e5`, verified `premove-source`/`premove-target`, clicked Board B `a6`, verified both premove highlights cleared, closed the tab, then stopped the local dev server and confirmed ports 4000 and 5173 were clear. Commit hash: pending.

  Final closure 2026-06-04: Audited the broad Chess/domain/server/web diff and found no blocking correctness issue. Fresh final verification passed with `git diff --check`, `npm run typecheck`, `npm test` (shared 2, domain 103, server 51, web 37), and `npm run build`. Final in-app browser smoke against a disposable in-memory API and Vite created and joined a Chess match, played Board A `e2-e4`, queued Board B black `e7-e5` as a premove, submitted Board B White `e2-e4` through the local API, verified the Board B premove auto-submitted with move history `e5`, verified focused Board A `f` flipped only Board A, toggled Zen mode with `z`, saved `/tmp/fairgame-chess-final-smoke.png`, and confirmed ports 4100 and 5174 were clear afterward. Implementation commit: `dab79ed5a75c264ffd1ed94bea2f916da4aae3f6`.

### 12. Local Debug Opponent

- [x] Add a local-only debug Chess bot so solo testing can create a Chess match, auto-seat Player 2 as a bot, and receive bot moves without enabling the behavior in production.
  Evidence: Started and completed on 2026-06-05 in worktree `.worktrees/debug-chess-bot` on branch `codex/debug-chess-bot`. Implementation plan saved to `docs/superpowers/plans/2026-06-05-debug-chess-bot.md`. Changed `fairgame-rebuild/apps/server/src/config.ts`, `fairgame-rebuild/apps/server/src/index.ts`, `fairgame-rebuild/apps/server/src/matches/debugChessBot.ts`, `fairgame-rebuild/apps/server/src/matches/matchService.ts`, `fairgame-rebuild/apps/server/tests/config.test.ts`, `fairgame-rebuild/apps/server/tests/matches.test.ts`, `fairgame-rebuild/README.md`, `fairgame-rebuild/.env.example`, and this roadmap. Baseline verification before implementation passed with `npm install`, `npm run typecheck`, and `npm test`. Red tests failed as expected with `npm test -w @fairgame/server -- config matches`. Final verification passed with `git diff --check`, `npm run typecheck`, `npm test` (shared 2, domain 103, server 54, web 37), and `npm run build`. Browser smoke used Codex in-app Browser at `http://localhost:5174` with a disposable in-memory API on `http://localhost:4000` because local `DATABASE_URL` is blank; created a Chess match, verified `seat2` as `Debug Bot`, Board B bot `e4`, Player 1 Board A `e4`, bot Board A `e5`, and confirmed ports `4000`, `5173`, and `5174` were clear after cleanup. Feature commit: `4a10490ce4ff1c7ac0ab4c8241259282ea676f26`.
  Follow-up 2026-06-05: Added configurable debug bot think delay through `FAIRGAME_DEBUG_CHESS_BOT_MOVE_DELAY_MS` so the bot clock can visibly tick before replies. The server now returns player moves immediately and schedules delayed bot replies asynchronously. Verification passed with red/green `npm test -w @fairgame/server -- config matches`, `git diff --check`, `npm run typecheck`, and `npm test -w @fairgame/server`.
  Follow-up 2026-06-05: Superseded the local-only server heuristic bot with a production-ready browser Stockfish Chess bot. The old `DEBUG_CHESS_BOT` path was removed; the new flow creates bot matches with `seat2` as `Stockfish <Difficulty>`, runs Stockfish 18 lite single-threaded WASM in the player's browser, and submits bot actions through a server-authorized `/api/matches/:id/bot-moves` endpoint. Spec: `docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md`; plan: `docs/superpowers/plans/2026-06-05-browser-stockfish-bot.md`; implementation commits through final UI-state audit: `da702a3`, `f0424dd`, `e478d90`, `f655843`, `0f771dd`, `19cb133`, `6978cb5`. Fresh verification passed with `npm test -w @fairgame/web -- App`, `npm run typecheck`, `npm test`, and `npm run build`; in-app browser verification at `http://localhost:5176/games/chess` created Normal bot games, displayed `Stockfish Normal`, observed the bot clock decrement while Stockfish thought, verified resume-after-refresh during the bot turn, and confirmed automatic draw/takeback declines.
  Follow-up 2026-06-05: Removed the browser Chess bot frontend/backend feature flags so Chess bot mode is always available in production. Updated server config/router wiring, web lobby creation logic, README/env examples, and the browser Stockfish design spec. Red server test first failed because default bot match creation returned `409 browser-bot-disabled`; verification passed with `npm test -w @fairgame/server -- browserChessBot`, `npm test -w @fairgame/server -- config`, `npm run typecheck`, `npm test`, and `npm run build`.

### 13. First-Time Player Instructions

- [x] Explain the two-board format to first-time players inside the app.
  Evidence: Started and completed on 2026-06-09 in worktree `.worktrees/how-to-play-guide` on branch `codex/how-to-play-guide`, responding to user feedback that seeing two boards of the same game with no instructions was confusing. Added a framework-level `HowToPlayPanel` in `fairgame-rebuild/apps/web/src/App.tsx` that auto-shows above the match content the first time a player opens any match (persisted through localStorage key `fairgame.howToPlaySeen`, dismissed with a `Got it` button), a `How it works` header button that reopens or closes the panel from the picker, lobby, and match views, and a one-line two-board tagline on the game picker. Copy is game-aware through `gameLabel`, uses seated-player wording for players and neutral wording for spectators, stays game-agnostic (no game-specific concepts), and the panel hides in Chess Zen mode. Documented the format in `fairgame-rebuild/README.md` under `How a match works`. Files changed: `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, `fairgame-rebuild/apps/web/src/styles.css`, `fairgame-rebuild/README.md`, and this roadmap.
  Verification: Red web tests failed first because the instructions region, header control, and picker tagline did not exist (`npm test -w @fairgame/web -- App.test.tsx -t "two-board instructions"`: 3 failed, 1 trivially passing absence test). After implementation the focused run passed (4 tests), and full verification passed with `npm run typecheck`, `npm test` (shared 2, domain 104, server 65, web 86), and `npm run build`. Playwright e2e passed in slices: `npm run test:e2e -- --workers=1` (5 of 6) plus `npm run test:e2e -- -g "added board games"` (1 of 1, passing in isolation); full-parallel e2e runs trip the server `FAIRGAME_RATE_LIMIT_MAX` default of 120 requests/min and fail identically on unmodified `main`, so that is a pre-existing suite capacity issue, not a regression. Playwright browser smoke against `npm run dev:e2e` verified the picker tagline, manual open/close from the header on the picker with generic copy, auto-show with TicTacToe copy on a first match, `Got it` dismissal persisting across reload via `fairgame.howToPlaySeen`, and a 390x844 mobile layout with no horizontal overflow; screenshots saved to `/tmp/fairgame-howto-picker.png`, `/tmp/fairgame-howto-picker-open.png`, `/tmp/fairgame-howto-match.png`, and `/tmp/fairgame-howto-mobile.png`; ports 4000 and 5173 confirmed clear after cleanup. Feature commit: `6a31cdf51c6dc242f01f671533d80f1423cc3dcd`.

  Follow-up 2026-06-09: Reworked the four instruction points per user feedback. Folded board independence ("each has its own turn and result, play them in either order") into point 1 instead of its own point; replaced the standalone independence point with a new clock point explaining that each player has a single clock shared across both boards that ticks whenever they are to-move on either board (verified against `packages/domain/src/clocks.ts`: clock is keyed by seat, runs at 1× even when to-move on both boards, and UI matches always use `incrementMs: 0`); and completed point 4 with the missing timeout rule — when a player's clock runs out they lose every unfinished board (verified against `getTimeoutBoardOutcome`/`applyTimeoutToMatch` in `apps/server/src/games/registry.ts`: single expiry → opponent wins all in-progress boards by `timeout`, simultaneous expiry → those boards draw by `mutual-timeout`). Clock and timeout copy is seated-player vs spectator voice-aware. Mirrored the new structure in `fairgame-rebuild/README.md`. Files changed: `fairgame-rebuild/apps/web/src/App.tsx`, `fairgame-rebuild/apps/web/src/App.test.tsx`, `fairgame-rebuild/README.md`, and this roadmap. Verification: red web tests first (3 failed on the changed copy assertions), then `npm test -w @fairgame/web -- App.test.tsx -t "two-board instructions"` passed (4), and full `npm run typecheck`, `npm test` (shared 2, domain 104, server 65, web 86), and `npm run build` passed. Browser smoke pending live check via the running dev server. Follow-up commit: `15532ab`.

### 14. Contributor Documentation

- [x] Document the codebase so a new contributor or agent can understand the project without reading the full roadmap or source.
  Evidence: Started and completed on 2026-06-09 in worktree `.worktrees/contributor-docs` on branch `codex/contributor-docs`. Added `fairgame-rebuild/docs/architecture.md` covering the product model, repository and workspace layout, design constraints, the `GameRules` and server/web game-plugin contracts, the HTTP and Socket.IO API surface, persistence and clock models, bot architecture, a step-by-step add-a-new-game guide, and testing commands with known gotchas (required `DATABASE_URL`, worktree `npm install` + `.env`, and the full-parallel e2e rate-limit flake). Refreshed `AGENTS.md` for the repository's current home: replaced stale external-drive absolute paths with repo-relative wording, removed the index row for a folder no longer present, dropped completed bootstrap-era instructions, and linked the architecture doc. Fixed the stale roadmap path in `fairgame-rebuild/README.md`, linked the architecture doc, and documented the `DATABASE_URL`/.env requirement. Added a root `CLAUDE.md` symlink to `AGENTS.md` so Claude Code auto-loads the worktree gate and project rules.
  Verification: `git diff --check` clean; a grep audit confirmed the living docs (`AGENTS.md`, `fairgame-rebuild/README.md`, `fairgame-rebuild/docs/`) contained no stale absolute paths; `ls -la CLAUDE.md` confirmed the symlink resolves to `AGENTS.md`, and a live Claude Code session loaded the rules through it. Docs-only change with no application code touched, so unit/build verification was not rerun. Feature commit: `2914722`.

  Follow-up 2026-06-09: Removed all remaining references to the old external-drive location and to the pre-rebuild attempts folder, per user request. Deleted the bootstrap-era plan and spec documents that were entirely about that one-time migration (`docs/superpowers/plans/2026-05-27-checkpoint-0-bootstrap.md`, `docs/superpowers/specs/2026-05-27-checkpoint-0-bootstrap-design.md`), removed the obsolete ignore entry from `.gitignore`, removed the `Lessons From Prior Attempts` section and reworded checkpoint 0 and lobby-revision evidence in this roadmap, reworded stale working-directory lines in `docs/superpowers/plans/2026-05-27-checkpoint-1-domain-model.md` and `docs/superpowers/plans/2026-05-28-seven-board-games.md`, and dropped the historical attempts note from `AGENTS.md`. Verification: repo-wide grep for the old drive path and the attempts folder name returned no matches outside `.worktrees/`; `git diff --check` clean.
