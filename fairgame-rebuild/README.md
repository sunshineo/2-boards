# FairGame Rebuild

FairGame is a fair two-board board-game platform. A match contains two independent
boards of the same game: Player 1 starts on board A, and Player 2 starts on board B.
The match result is derived from both board results.

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

Start local development with a Chess bot opponent:

```bash
FAIRGAME_DEBUG_CHESS_BOT=true npm run dev
```

When enabled outside production, newly created Chess matches auto-seat Player 2 as
the debug bot and the bot plays simple deterministic legal moves. Production mode
forces this off even if the environment variable is present.

Run the built app as a single production server:

```bash
npm run build
NODE_ENV=production DATABASE_URL='postgresql://...' FAIRGAME_WEB_DIST_DIR=apps/web/dist npm run dev:server
```

See `docs/deployment.md` for Docker, health checks, environment variables, and Neon/Postgres persistence.

The active rebuild follows `/Volumes/T9/code/2-boards/roadmap.md`.
