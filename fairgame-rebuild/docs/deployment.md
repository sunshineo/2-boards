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

## Current Northflank Deployment

This project is currently deployed on Northflank as a combined service. Northflank builds the
Docker image from GitHub and deploys the same container as one Node process serving the React
build, REST API, and Socket.IO.

- Northflank project: `two-boards`
- Northflank service: `two-boards`
- Service type: combined service
- Deployment region: `us-central`
- GitHub repository: `https://github.com/sunshineo/2-boards`
- Git branch: `main`
- CI/CD: enabled. Pushing to `main` triggers a Northflank build and deployment.
- Build type: Dockerfile, not buildpack
- Docker build context: `/fairgame-rebuild`
- Dockerfile path: `/fairgame-rebuild/Dockerfile`
- Public URL: `https://p01--two-boards--6wlsqmd2hdrc.code.run`
- Public port: `p01`, internal port `4000`, protocol `HTTP`, public enabled
- Health check: HTTP readiness probe on port `4000`, path `/health`

The port must stay public `HTTP`. Socket.IO starts over HTTP and upgrades to WebSocket, so a
private port or raw `TCP` port will not serve the Northflank public URL correctly.

### Northflank CLI

Install and log in:

```bash
npm install -g @northflank/cli
northflank login
northflank context use project --id two-boards
```

Useful inspection commands:

```bash
northflank list projects
northflank list services --project two-boards --output json
northflank get service --project two-boards --service two-boards --output json
northflank get service ports --project two-boards --service two-boards --output json
northflank get service health-checks --project two-boards --service two-boards --output json
northflank get service builds --project two-boards --service two-boards --output json
northflank get service containers --project two-boards --service two-boards --output json
northflank get service logs --project two-boards --service two-boards --types runtime --lineLimit 100
```

When inspecting runtime environment variables, do not print secret values. Confirm key presence
only. The production service currently needs these runtime variables set:

- `DATABASE_URL`: Neon Postgres connection string. This is secret.
- `NODE_ENV`: `production`
- `PORT`: `4000`
- `FAIRGAME_WEB_DIST_DIR`: `/app/apps/web/dist`
- `FAIRGAME_TRUST_PROXY`: `true`
- `FAIRGAME_SECURE_COOKIES`: `true`

### Northflank Port Configuration

The current public port configuration is equivalent to:

```json
{
  "ports": [
    {
      "name": "p01",
      "internalPort": 4000,
      "protocol": "HTTP",
      "public": true,
      "domains": [],
      "security": {
        "policies": [],
        "credentials": []
      },
      "disableNfDomain": false
    }
  ]
}
```

If the public URL returns a Northflank `404`, check whether the port was accidentally left
private. If it returns intermittent `503`, check container rollout state, port protocol, and the
server keep-alive settings below.

### Proxy Keep-Alive

The Node server sets explicit HTTP keep-alive and headers timeouts because Northflank sits behind
a proxy/load balancer. Node's short default keep-alive timeout can cause intermittent proxy `503`
responses when the proxy tries to reuse a backend connection that Node has already closed.

Defaults:

- `FAIRGAME_HTTP_KEEP_ALIVE_TIMEOUT_MS=70000`
- `FAIRGAME_HTTP_HEADERS_TIMEOUT_MS=75000`

Keep `FAIRGAME_HTTP_HEADERS_TIMEOUT_MS` greater than `FAIRGAME_HTTP_KEEP_ALIVE_TIMEOUT_MS`.

## Vercel Frontend

The React/Vite frontend can be deployed separately on Vercel while the API and Socket.IO backend
remain on Northflank. The Vercel configuration lives in `fairgame-rebuild/vercel.json`.

Current Vercel deployment:

- Vercel project: `fairgame-rebuild`
- Production URL: `https://fairgame-rebuild.vercel.app`
- GitHub repository: `https://github.com/sunshineo/2-boards`
- Production branch: `main`
- Backend origin: `https://p01--two-boards--6wlsqmd2hdrc.code.run`

Vercel project settings should use:

- Root directory: `fairgame-rebuild`
- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build:packages && npm run build -w @fairgame/web`
- Output directory: `apps/web/dist`

Do not set `VITE_API_URL` for this deployment. The frontend should use same-origin requests, and
`vercel.json` rewrites proxy these paths to Northflank:

- `/api/:path*` -> `https://p01--two-boards--6wlsqmd2hdrc.code.run/api/:path*`
- `/socket.io/:path*` -> `https://p01--two-boards--6wlsqmd2hdrc.code.run/socket.io/:path*`

This keeps browser requests and seat cookies on the Vercel domain while Northflank continues to
run the long-lived Express and Socket.IO server.

Deploy manually from the app root when needed:

```bash
cd fairgame-rebuild
vercel deploy .
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
- `FAIRGAME_HTTP_KEEP_ALIVE_TIMEOUT_MS`: Node HTTP keep-alive timeout. Defaults to `70000`.
- `FAIRGAME_HTTP_HEADERS_TIMEOUT_MS`: Node HTTP headers timeout. Defaults to `75000`.
- `FAIRGAME_JSON_BODY_LIMIT`: Express JSON body size limit.
- `FAIRGAME_LOG_LEVEL`: server request log level.

## Health Checks

- `GET /health`: process health and static product metadata.
- `GET /ready`: dependency readiness, including persistence.

## Neon

Create a Neon Postgres database in the same region as the app when possible. For a Northflank
service in US East, use Neon `aws-us-east-1` when available. Store the Neon connection string in
the deployment environment as `DATABASE_URL`.
