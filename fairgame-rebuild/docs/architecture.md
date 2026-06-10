# Architecture

FairGame is a fair two-board board-game platform. A match is two independent games
of the same game between the same two players, played side by side: Player 1
(`seat1`) moves first on board `A`, Player 2 (`seat2`) moves first on board `B`.
Each board has its own turn, legal moves, and result; the match result is the sum
of both board scores (win = 1, draw = ½ each). There is no global "current board" —
a player may be to-move on both boards, one board, or neither.

The product rules shown to players are in the README under "How a match works".
This document is the contributor map: where things live, the contracts between
layers, and how to add a new game.

## Repository layout

| Path | What it is |
| --- | --- |
| `AGENTS.md` (repo root) | Agent working rules, including the mandatory worktree gate. Read before editing anything. |
| `roadmap.md` (repo root) | Durable execution roadmap and evidence log. Update it when starting/finishing roadmap-level work. |
| `docs/superpowers/` (repo root) | Specs and implementation plans written before larger checkpoints. |
| `fairgame-rebuild/` | The product itself — an npm workspace (this folder is the workspace root). |

Inside `fairgame-rebuild/`:

| Path | What it is |
| --- | --- |
| `packages/shared` | Tiny base types shared everywhere: `SeatId` (`"seat1" \| "seat2"`), `BoardId` (`"A" \| "B"`), generic `BoardOutcome`. |
| `packages/domain` | Pure game-agnostic engine + per-game rules modules. No I/O, fully unit-tested. |
| `apps/server` | Express + Socket.IO server. Owns canonical match state, persistence, clocks, rate limits. |
| `apps/web` | React + Vite client. Game picker, per-game lobbies, the two-board match room, browser-side bots. |
| `tests/e2e` | Playwright end-to-end tests (`tests/e2e/tictactoe.spec.ts` covers all games' core flows). |
| `docs/` | This file plus `deployment.md` (Vercel + Northflank + Neon setup). |

## Non-negotiable design constraints

- The server owns canonical match state. Clients send commands, never state.
- Each board is independent: its own turn, its own result.
- The framework is game-agnostic. Checkmate, columns, captures, draw offers, etc.
  live inside a game's rules module; the framework only understands the generic
  `BoardOutcome` (`in_progress` / `draw` / `win` / `canceled`) and scoring.
  Game-specific outcome reasons are carried as opaque strings.
- `canceled` is a whole-match outcome, not a board outcome.
- Generic match UI (room, two-board layout, clocks, score) is framework-owned;
  board rendering and move-input semantics are game-owned.

## packages/domain — engine and game rules

Everything a game must implement is the `GameRules<TState, TMove>` interface in
`packages/domain/src/types.ts`:

- `createInitialState({ firstSeat, seats })`
- `getSeatsToAct(state)` — which seats may act right now (drives turn UI and clocks)
- `validateMove({ state, move, seat })` / optional `canSubmitMove` pre-check
- `applyMove({ state, move, seat })` — pure state transition
- `getOutcome(state)` — generic `BoardOutcome`

The fair-match engine (`engine.ts`) composes two boards: `createFairMatch` builds
board `A` with `seat1` first and board `B` with `seat2` first; `applyMoveToMatch`
routes a command to one board and rejects `match-not-active`, `board-not-active`,
`seat-not-to-act`, plus game-specific reasons. Scoring (`scoring.ts`) folds the two
`BoardOutcome`s into a `MatchOutcome` with a `MatchScore`.

`clocks.ts` is the pure shared-clock model: one clock per seat for the whole match,
and a seat's clock runs whenever that seat is to-move on at least one unfinished
board (both clocks can run at once). Timeouts resolve the remaining boards.

Game modules live in `packages/domain/src/games/` (one file + one test file per
game). Chess wraps `chess.js` and also owns board-control commands (resign, draw
offer/accept/decline, takeback) as game-level moves, which keeps those concepts out
of the framework.

## apps/server

- `src/games/registry.ts` — the server-side game registry. Each game provides a
  `SupportedGameDefinition`: label, clock minute range, optional bot capability,
  `createMatch`, `parseMove` (untrusted JSON → typed move), `getSeatsToAct`,
  `applyMove`, and `toBoardView` (state → a `MatchBoardView` variant, the
  client-facing projection keyed by `kind`). `src/matches/gameRegistry.ts`
  re-exports it.
- `src/matches/matchService.ts` — orchestration: create/join/move commands, seat
  claims, clock advancement, automated-seat handling, persistence writes, update
  listeners feeding realtime.
- `src/matches/matchView.ts` — projects internal state into the `MatchView` sent
  to clients (boards as `MatchBoardView`s, score, clock view, player metadata).
- `src/matches/routes.ts` — REST API (see table below).
- `src/seatAgents/` — `AutomatedSeat` model for bot opponents (`browser-stockfish`
  for Chess, `random-legal` for other games). The server creates and authorizes
  the bot seat; the bot's brain runs in the player's browser.
- `src/realtime.ts` — Socket.IO: client emits `watch-match { matchId }`, server
  emits `match:update` with a fresh `MatchView` on every accepted command.
- `src/persistence/postgresMatchRepository.ts` — Postgres (Neon in production)
  with both an append-only event log (`match_events`) and current snapshots
  (`match_snapshots`), plus a `schema_migrations` runner. Active matches are
  rehydrated from snapshots on startup; stale snapshots are pruned while event
  history is preserved.
- `src/app.ts` — helmet, pino-http, JSON body limit, per-IP rate limit,
  `/health`, `/ready`, stable JSON 404/error shapes, and (in production) static
  serving of the built web app with an SPA fallback.
- `src/config.ts` — typed env config. `DATABASE_URL` is required; see
  `.env.example` for the full list (`PORT`, `FAIRGAME_RATE_LIMIT_MAX`,
  `FAIRGAME_SECURE_COOKIES`, `FAIRGAME_WEB_DIST_DIR`, ...).

### HTTP and realtime API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/matches` | Newest open (joinable) matches for the lobby. |
| `POST /api/matches` | Create a match (`gameType`, optional `clockInitialMs`, optional `bot.difficulty`). Sets the seat-claim cookie, returns a `SeatSession`. |
| `POST /api/matches/:id/join` | Claim the open seat. Sets the seat-claim cookie. |
| `GET /api/matches/:id/session` | Restore seat from the HTTP-only cookie after refresh; `seat: null` means spectator. |
| `GET /api/matches/:id` | Read-only match view. |
| `POST /api/matches/:id/moves` | Submit a move (or game-owned board control) for the caller's seat on one board. |
| `POST /api/matches/:id/agent-moves` | Submit a move on behalf of the match's authorized automated seat (used by the browser bots). |
| `POST /api/matches/:id/bot-moves` | Older chess-specific automated-seat path; same authorization model. |
| `GET /health`, `GET /ready` | Liveness / readiness (readiness checks the database). |
| Socket.IO `watch-match` → `match:update` | Live match updates; the web app also polls active matches every 2s as a fallback. |

Seat continuity uses refresh-safe, HTTP-only seat-claim cookies — there are no
accounts. Whoever holds the cookie for a seat is that player; everyone else who
opens the match URL is a read-only spectator.

## apps/web

- `src/App.tsx` — almost all framework UI lives here: path routes `/` (game
  picker), `/games/:gameType` (per-game lobby: quick pairing, human/bot toggle,
  custom minutes, open games, recent matches), `/matches/:matchId` (the match
  room: summary, shared clock strip, the two boards, rematch), browser
  back/forward handling, the first-time "How two-board matches work" panel
  (localStorage key `fairgame.howToPlaySeen`), socket + polling wiring, and Chess
  Zen mode (`z`).
- `src/games/registry.tsx` — the web-side plugin list (`WebGamePlugin`): label,
  thumbnail (`public/game-thumbnails/*.png`), clock range, optional bot
  capability, and `renderBoard`.
- `src/games/renderers.tsx` — `BoardRenderer` switches on `board.kind` and renders
  the game-specific board. Chess is the rich one (react-chessboard, legal-move
  dots, premoves, annotations, per-board replay/keyboard shortcuts, board
  controls); most other games are simple grids.
- `src/games/bots/` — browser bot brains: Stockfish 18 lite WASM for Chess,
  random-legal pickers for the other games. `src/browserChessBot.ts` is the
  controller that watches bot matches and submits moves through the server's
  agent endpoint.
- `src/types.ts` — client mirrors of the server view types (`MatchView`, the
  `MatchBoardView` union, `SeatSession`, clock views).
- `src/api.ts` — thin fetch wrappers; in dev it targets `:4000` directly, in
  production it is same-origin (Vercel proxies `/api/*` and `/socket.io/*` to the
  backend per `vercel.json`).

## Adding a new game

Follow the existing games file-by-file; Gomoku is the simplest complete example.

1. **Domain**: add `packages/domain/src/games/<game>.ts` implementing
   `GameRules<TState, TMove>` plus `<game>.test.ts` (legal/illegal moves, win,
   draw, wrong-seat rejection). Export it from `packages/domain/src/index.ts`.
2. **Server registry**: add a `SupportedGameDefinition` entry in
   `apps/server/src/games/registry.ts`: game type id, label, clock minute range,
   `parseMove` validation for untrusted JSON, and a `toBoardView` projection
   (define a new `...BoardView` type with a unique `kind` and add it to
   `MatchBoardView`). Add API coverage in `apps/server/tests/matches.test.ts`
   (including an invalid-move-shape case).
3. **Web**: mirror the new board view in `apps/web/src/types.ts`; add a renderer
   branch in `apps/web/src/games/renderers.tsx`; register the plugin in
   `apps/web/src/games/registry.tsx` with a thumbnail in
   `apps/web/public/game-thumbnails/`; optionally add a random-legal bot in
   `apps/web/src/games/bots/`. Add DOM tests in `apps/web/src/App.test.tsx`.
4. **E2E**: extend the added-games opening-move case list in
   `tests/e2e/tictactoe.spec.ts`.
5. Nothing in the engine, match service, routes, persistence, clocks, or match
   room layout should need to change — if it does, the design constraint above is
   being violated.

## Testing and verification

From `fairgame-rebuild/`:

```bash
npm run typecheck   # tsc project references
npm test            # vitest across all workspaces (domain, server, web, shared)
npm run build       # packages + server + web production build
npm run test:e2e    # Playwright (starts dev servers via npm run dev:e2e)
```

Gotchas:

- The server refuses to start without `DATABASE_URL` (copy `.env.example` to
  `.env`). Task worktrees need their own `npm install` and a copy of `.env`.
- The full parallel e2e run can trip the server's per-IP rate limit
  (`FAIRGAME_RATE_LIMIT_MAX`, default 120/min) because every test shares
  127.0.0.1 and active matches poll every 2s. If you see "rate limit exceeded"
  alerts in failures, rerun with `--workers=1` or `-g "<test name>"` slices and
  compare against `main` before assuming a regression.
- Repo convention is red/green TDD with browser verification for UI changes;
  evidence (commands, screenshots, commit hashes) is recorded per checkpoint in
  the top-level `roadmap.md`.
