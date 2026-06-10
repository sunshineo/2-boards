# FairGame Rebuild

FairGame is a fair two-board board-game platform. A match contains two independent
boards of the same game: Player 1 starts on board A, and Player 2 starts on board B.
The match result is derived from both board results.

## How a match works

- **One match, two boards.** Every match is two games of the same game between the
  same two players, played side by side — one game on each board. The boards are
  independent: each has its own turn and result, and a player may be to-move on
  both boards, one, or neither, and can answer them in either order.
- **Both sides get the first move.** Each player moves first on one of the two
  boards, so the usual first-move advantage cancels out.
- **One clock covers both boards.** Each player has a single clock for the whole
  match, shared across both boards. It counts down whenever that player is to-move
  on either board (possibly both at once), so time has to be budgeted across the
  two games.
- **Two results, one winner.** Each board is worth one point: 1 for a win, ½ each
  for a draw. If a player's clock runs out, they lose every board that has not
  finished yet. The higher combined score after both boards finish wins the match.

The web app shows this explanation automatically the first time a player opens a
match, and it can be reopened anytime with the "How it works" button in the header.

For the codebase map, layer contracts, and the add-a-new-game guide, see
`docs/architecture.md`.

## Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Start local development servers:

```bash
npm run dev
```

The server loads `fairgame-rebuild/.env` automatically for local runs and refuses
to start without `DATABASE_URL`; copy `.env.example` to `.env` and fill it in.

The Chess lobby includes Bot mode. The server creates and authorizes the bot
match, but Stockfish runs in the player's browser and submits validated bot
moves back through the normal server-owned match flow.

Run the built app as a single production server:

```bash
npm run build
NODE_ENV=production DATABASE_URL='postgresql://...' FAIRGAME_WEB_DIST_DIR=apps/web/dist npm run dev:server
```

See `docs/deployment.md` for Docker, health checks, environment variables, and Neon/Postgres persistence.

The active rebuild follows `roadmap.md` at the repository root; `AGENTS.md` there
documents the agent workflow, including the mandatory worktree gate.
