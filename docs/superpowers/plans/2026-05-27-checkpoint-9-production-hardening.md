# Checkpoint 9 Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FairGame deployable and operable beyond local development without adding premature account authentication.

**Architecture:** Add typed runtime config, operational middleware, readiness checks, PGlite migrations, stale snapshot cleanup, and single-process static web serving. Keep account authentication deferred; seat cookies remain the current authorization boundary and become secure by default in production.

**Tech Stack:** TypeScript, Express, Socket.IO, PGlite, React/Vite, Vitest, Playwright, Docker.

---

### Task 1: Runtime Config And Security Middleware

**Files:**
- Create: `fairgame-rebuild/apps/server/src/config.ts`
- Modify: `fairgame-rebuild/apps/server/src/app.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/routes.ts`
- Create: `fairgame-rebuild/apps/server/tests/config.test.ts`
- Modify: `fairgame-rebuild/apps/server/tests/health.test.ts`
- Modify: `fairgame-rebuild/apps/server/package.json`
- Modify: `fairgame-rebuild/package-lock.json`

- [x] **Step 1: Write failing config and middleware tests**

Add tests for production cookie defaults, allowed CORS origins, security headers, and rate limiting.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/server -- config health`.

Evidence: Command failed because `../src/config` does not exist yet.

- [x] **Step 3: Install operational middleware dependencies**

Run `npm install -w @fairgame/server helmet express-rate-limit pino pino-http`.

Evidence: Command installed 18 packages and reported 0 vulnerabilities.

- [x] **Step 4: Implement typed config and app middleware**

Add `loadServerConfig(env, cwd)` with explicit defaults and inject config into `createApp()`.
Wire `helmet`, JSON body limit, CORS allow-list, `pino-http`, and API rate limiting. Pass
`secureCookies` into the match router so production seat cookies use `secure: true`.

- [x] **Step 5: Verify green**

Run `npm test -w @fairgame/server -- config health`.

Evidence: Command passed 7 tests on 2026-05-27.

### Task 2: Readiness, Error Handling, And Repository Health

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/app.ts`
- Modify: `fairgame-rebuild/apps/server/src/persistence/pgliteMatchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/tests/health.test.ts`

- [x] **Step 1: Write failing readiness tests**

Verify `/ready` returns `200` when persistence health passes and `503` when it fails without leaking internals.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/server -- health`.

Evidence: Command failed because `/ready` and JSON API 404 handling do not exist yet.

- [x] **Step 3: Add repository health and centralized errors**

Add `healthCheck()` to the repository contract and PGlite implementation. Add `/ready`, an API
404 handler, and a final Express error handler that logs request-scoped errors and returns
`{ "error": "internal-error" }`.

- [x] **Step 4: Verify green**

Run `npm test -w @fairgame/server -- health`.

Evidence: Command passed 8 tests on 2026-05-27.

### Task 3: Schema Migrations

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/persistence/pgliteMatchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/tests/persistence.test.ts`

- [x] **Step 1: Write failing migration tests**

Verify repository initialization records `001_initial_persistence` and does not duplicate it after reopening the same database.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/server -- persistence`.

Evidence: Command failed because `repository.listAppliedMigrations` does not exist yet.

- [x] **Step 3: Implement migration runner**

Create `schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`.
Run an ordered migration list inside `initialize()`, using idempotent SQL for existing tables and
indexes, and expose `listAppliedMigrations()` for tests.

- [x] **Step 4: Verify green**

Run `npm test -w @fairgame/server -- persistence`.

Evidence: Command passed 2 tests on 2026-05-27.

### Task 4: Stale Match Cleanup

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/matches/matchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`
- Modify: `fairgame-rebuild/apps/server/src/persistence/pgliteMatchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/src/index.ts`
- Modify: `fairgame-rebuild/apps/server/tests/matches.test.ts`
- Modify: `fairgame-rebuild/apps/server/tests/persistence.test.ts`

- [x] **Step 1: Write failing cleanup tests**

Verify completed stale matches and never-joined stale matches are removed from snapshots, active
two-seat in-progress matches are retained, and event history remains.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/server -- matches persistence`.

Evidence: Command failed because `service.pruneStaleMatches` does not exist yet.

- [x] **Step 3: Implement cleanup state and repository pruning**

Persist `lastActivityAtMs` in snapshots. Add `MatchService.pruneStaleMatches(nowMs, maxAgeMs)`
that removes completed matches and one-seat never-joined matches older than the threshold. Add
`deleteSnapshot(matchId)` to the repository and append `match.pruned` before deleting snapshots.
Schedule cleanup in `index.ts` when `FAIRGAME_CLEANUP_INTERVAL_MS` is greater than zero.

- [x] **Step 4: Verify green**

Run `npm test -w @fairgame/server -- matches persistence`.

Evidence: Command passed 24 tests on 2026-05-27.

### Task 5: Single-Process Deployment Assets

**Files:**
- Modify: `fairgame-rebuild/apps/server/src/app.ts`
- Modify: `fairgame-rebuild/apps/server/src/index.ts`
- Modify: `fairgame-rebuild/apps/web/src/api.ts`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`
- Create: `fairgame-rebuild/Dockerfile`
- Create: `fairgame-rebuild/.dockerignore`
- Create: `fairgame-rebuild/.env.example`
- Create: `fairgame-rebuild/docs/deployment.md`
- Modify: `fairgame-rebuild/README.md`

- [x] **Step 1: Write failing serving and API-base tests**

Verify the built server can serve `index.html` for non-API routes and the web API base URL uses same-origin in production builds.

- [x] **Step 2: Run red**

Run `npm test -w @fairgame/server -- health` and `npm test -w @fairgame/web`.

Evidence: Server command failed because built web serving does not exist; web command failed because production API URLs still default to port 4000.

- [x] **Step 3: Implement static serving and deployment docs**

Serve `FAIRGAME_WEB_DIST_DIR` when configured, fall back to `index.html` for non-API routes,
and update web API base URL to use same-origin outside Vite development unless `VITE_API_URL`
is set. Add Docker and environment docs for the single-process deployment.

- [x] **Step 4: Verify green**

Run `npm test -w @fairgame/server -- health` and `npm test -w @fairgame/web`.

Evidence: Server health tests passed 9 tests and web tests passed 9 tests on 2026-05-27.

### Task 6: Full Verification, Browser Check, Roadmap, Commit

**Files:**
- Modify: `roadmap.md`
- Modify: `docs/superpowers/plans/2026-05-27-checkpoint-9-production-hardening.md`

- [x] **Step 1: Run full verification**

Run `npm install` and `npm run typecheck && npm test && npm run build && npm run test:e2e`.

Evidence: `npm install` reported 0 vulnerabilities. Fresh `npm run typecheck && npm test && npm run build && npm run test:e2e` passed on 2026-05-27: shared 2 tests, domain 44 tests, server 35 tests, web 9 tests, production build, and 3 Chromium E2E tests. The E2E harness now waits for both Vite and `/ready`, preventing API-startup races.

- [x] **Step 2: Run built production server browser verification**

Run the built server with a temporary PGlite directory and `FAIRGAME_WEB_DIST_DIR=apps/web/dist`.
Use the Codex in-app browser to load the production server, create a TicTacToe match, verify API
and Socket.IO behavior, and verify `/ready`.

Evidence: Started `node apps/server/dist/index.js` with `NODE_ENV=production`, `PORT=4100`, `FAIRGAME_WEB_DIST_DIR=apps/web/dist`, temporary PGlite storage, and local `FAIRGAME_SECURE_COOKIES=false`. Built-in browser loaded `http://127.0.0.1:4100/`, created a TicTacToe match through same-origin API calls, confirmed Board A active and Board B disabled, and loaded `/ready` with `{"ok":true,"project":"FairGame"}`. This also verified the compiled server's Node ESM imports are runnable.

- [x] **Step 3: Update roadmap and commit**

Mark checkpoint 9 complete, record verification evidence, and commit with
`git commit -m "feat: harden production operations"`.

Evidence: Checkpoint 9 implementation commit `54193e2`.
