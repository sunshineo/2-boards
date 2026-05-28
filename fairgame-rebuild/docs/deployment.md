# Deployment

FairGame can run as one Node process serving the React build, REST API, and Socket.IO.

## Build

```bash
npm install
npm run build
```

## Run Production Locally

```bash
NODE_ENV=production \
PORT=4000 \
FAIRGAME_DB_DIR=.data/pglite \
FAIRGAME_WEB_DIST_DIR=apps/web/dist \
npm run dev:server
```

For a compiled server, run:

```bash
NODE_ENV=production \
PORT=4000 \
FAIRGAME_DB_DIR=.data/pglite \
FAIRGAME_WEB_DIST_DIR=apps/web/dist \
node apps/server/dist/index.js
```

## Docker

```bash
docker build -t fairgame .
docker run --rm -p 4000:4000 -v fairgame-data:/data fairgame
```

## Environment

- `PORT`: HTTP port.
- `FAIRGAME_DB_DIR`: local PGlite data directory.
- `FAIRGAME_WEB_DIST_DIR`: built web directory. Set to `apps/web/dist` locally or `/app/apps/web/dist` in the Docker image.
- `FAIRGAME_ALLOWED_ORIGINS`: comma-separated browser origins allowed to call the API. Leave empty for local development.
- `FAIRGAME_SECURE_COOKIES`: defaults to `true` in production and `false` otherwise.
- `FAIRGAME_TRUST_PROXY`: set to `true` behind a TLS-terminating proxy.
- `FAIRGAME_RATE_LIMIT_WINDOW_MS` and `FAIRGAME_RATE_LIMIT_MAX`: API rate limit settings.
- `FAIRGAME_STALE_MATCH_MAX_AGE_MS`: age threshold for completed or never-joined match cleanup.
- `FAIRGAME_CLEANUP_INTERVAL_MS`: cleanup interval. Set to `0` to disable the scheduler.
- `FAIRGAME_JSON_BODY_LIMIT`: Express JSON body size limit.
- `FAIRGAME_LOG_LEVEL`: server request log level.

## Health Checks

- `GET /health`: process health and static product metadata.
- `GET /ready`: dependency readiness, including persistence.

## Neon Path

PGlite remains the local database. When the project moves online, add a Neon/Postgres
repository that implements the existing `MatchRepository` interface. The migration table and
SQL are intentionally Postgres-shaped so the schema-management path can be reused.
