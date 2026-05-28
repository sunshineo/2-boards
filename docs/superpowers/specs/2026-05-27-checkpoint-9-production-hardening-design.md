# Checkpoint 9 Production Hardening Design

## Goal

Make the local rebuild operable outside development without changing the game rules or
adding premature account authentication.

## Scope

This checkpoint adds:

- typed runtime configuration for server ports, database path, CORS, cookies, rate limits,
  logging, stale cleanup, and static web serving;
- security middleware, secure production cookie defaults, JSON body limits, request logging,
  rate limits, and centralized error handling;
- `/ready` readiness checks that prove the persistence layer is usable;
- schema migrations for PGlite, shaped so the SQL remains portable to Neon/Postgres later;
- stale match cleanup for completed matches and never-joined matches while preserving the
  event log;
- deployment assets and docs for a single Node process that can serve the built React app,
  API, and Socket.IO server.

## Authentication Decision

Account authentication is not needed yet. The current product has no profile data, private
match list, payments, or cross-device identity. Seat ownership remains the authorization
boundary, using HTTP-only seat cookies. Production mode should make those cookies secure by
default and should document that account auth becomes necessary when saved identities,
private match discovery, or online matchmaking are added.

## Architecture

`apps/server/src/config.ts` owns environment parsing and defaults. `index.ts` builds a
`ServerConfig`, opens persistence, loads snapshots, starts cleanup scheduling, and wires
Socket.IO with the configured allowed origins.

`createApp()` receives explicit operational options instead of reading environment variables
directly. Middleware stays generic: security headers, CORS, rate limits, request logging,
body parsing, health/readiness routes, match routes, optional static web serving, and final
error handling.

Persistence keeps the existing event-log-plus-snapshot model. Initialization becomes a small
migration runner with a `schema_migrations` table. Cleanup deletes stale snapshots from the
fast-load path and appends a `match.pruned` event; it does not delete the event log.

## Data Flow

On startup:

1. Parse config.
2. Open PGlite and run migrations.
3. Load snapshots into `MatchService`.
4. Start HTTP and Socket.IO.
5. Start a cleanup interval if configured.

On each request, the server attaches a request id, logs method/path/status/duration, applies
security headers and CORS, parses JSON with a fixed size limit, and lets route handlers return
structured errors.

## Deployment Model

The deployable unit is a single Node server. `npm run build` produces server JavaScript and
web static assets. In production, `FAIRGAME_WEB_DIST_DIR` points the server at
`apps/web/dist`; unknown non-API routes fall back to `index.html` so refreshes work.

Local production smoke testing should run the built server with a temporary PGlite directory.
When the app goes online with Neon, a Postgres-backed repository should implement the same
`MatchRepository` interface and reuse the migration SQL shape.

## Testing

Tests cover:

- config parsing and production cookie defaults;
- security headers, CORS allow-list behavior, body size behavior, and API rate limits;
- readiness success and dependency failure;
- migration recording and repository health checks;
- stale cleanup pruning snapshots while preserving event counts;
- built static web serving and production API base URL behavior.

Full checkpoint verification must include typecheck, all Vitest suites, production build,
Playwright E2E, and a Codex in-app browser smoke test against the built production server.

## Self-Review

- No account system is introduced before there is user-owned data.
- Game modules and match orchestration remain unchanged except for cleanup metadata.
- Operational behavior is controlled through config and documented environment variables.
- The migration table creates a concrete bridge from PGlite to future Neon/Postgres.
