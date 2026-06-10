# FairGame Rebuild

FairGame is a fair two-board board-game platform. A match contains two independent
boards of the same game: Player 1 starts on board A, and Player 2 starts on board B.
The match result is derived from both board results.

## How a match works

- Every match is two games of the same game between the same two players, played
  side by side — one game on each board.
- Each player makes the first move on one of the two boards, so the usual
  first-move advantage cancels out.
- The boards are independent. A player may be to-move on both boards, one board,
  or neither, and can answer the boards in any order.
- Each board is worth one point: 1 for a win, ½ each for a draw. The higher
  combined score after both boards finish wins the match.

The web app shows this explanation automatically the first time a player opens a
match, and it can be reopened anytime with the "How it works" button in the header.

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

The server loads `fairgame-rebuild/.env` automatically for local runs.

The Chess lobby includes Bot mode. The server creates and authorizes the bot
match, but Stockfish runs in the player's browser and submits validated bot
moves back through the normal server-owned match flow.

Run the built app as a single production server:

```bash
npm run build
NODE_ENV=production DATABASE_URL='postgresql://...' FAIRGAME_WEB_DIST_DIR=apps/web/dist npm run dev:server
```

See `docs/deployment.md` for Docker, health checks, environment variables, and Neon/Postgres persistence.

The active rebuild follows `/Volumes/T9/code/2-boards/roadmap.md`.
