# Deployment

FairGame can run as one Node process serving the React build, REST API, and Socket.IO.
The server always uses a Postgres database through `DATABASE_URL`.

## Build

```bash
npm install
npm run build
```

## Run Production Locally

```bash
NODE_ENV=production \
PORT=4000 \
DATABASE_URL='postgresql://fairgame:password@ep-example.us-east-1.aws.neon.tech/fairgame?sslmode=require' \
FAIRGAME_WEB_DIST_DIR=apps/web/dist \
npm run dev:server
```

For a compiled server, run:

```bash
NODE_ENV=production \
PORT=4000 \
DATABASE_URL='postgresql://fairgame:password@ep-example.us-east-1.aws.neon.tech/fairgame?sslmode=require' \
FAIRGAME_WEB_DIST_DIR=apps/web/dist \
node apps/server/dist/index.js
```

## Docker

```bash
docker build -t fairgame .
docker run --rm -p 4000:4000 \
  -e DATABASE_URL='postgresql://fairgame:password@ep-example.us-east-1.aws.neon.tech/fairgame?sslmode=require' \
  fairgame
```

## Environment

- `PORT`: HTTP port.
- `DATABASE_URL`: required Postgres connection string. Use the Neon connection string with `sslmode=require`.
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

## Neon

Create a Neon Postgres database in the same region as the app when possible. For a Northflank
service in US East, use Neon `aws-us-east-1` when available. Store the Neon connection string in
the deployment environment as `DATABASE_URL`.
