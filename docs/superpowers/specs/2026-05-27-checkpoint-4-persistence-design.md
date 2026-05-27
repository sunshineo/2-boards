# Checkpoint 4 Persistence And Recovery Design

## Goal

Persist active TicTacToe matches to local PGlite so matches survive server process
restart. Persistence must use both append-only events and current snapshots.

## Scope

This checkpoint includes:

- PGlite dependency and local data directory;
- schema migration for `match_events` and `match_snapshots`;
- repository interface separating persistence from match orchestration;
- append-only events for create, join, and applied moves;
- current snapshots after each state-changing command;
- startup load from snapshots;
- tests that create, move, restart the service/repository, reload, and continue.

This checkpoint does not include hosted Neon, multi-process concurrency, auth, accounts,
or database migrations beyond the initial schema.

## Persistence Shape

Events are the audit/replay trail:

```sql
match_events(id, match_id, event_type, payload, created_at)
```

Snapshots are the fast load path:

```sql
match_snapshots(match_id, payload, updated_at)
```

Snapshot payload contains the serializable in-memory match record:

- generic fair match state;
- joined seats;
- seat-claim secrets.

Persisting seat claims keeps refresh continuity working after server restart.

## Service Boundary

`MatchService` owns command orchestration and active in-memory state. It should accept
an optional repository. When a repository is present:

- `loadFromRepository()` hydrates active matches from snapshots;
- create/join/move append a domain event;
- create/join/move save a current snapshot after successful state changes.

Routes await mutating service methods. Realtime broadcasting happens after persistence
succeeds so connected clients do not observe uncommitted state.

## PGlite Adapter

The PGlite adapter lives under `apps/server/src/persistence`. It implements the match
repository interface and can later be replaced by a Neon Postgres adapter with the same
methods.

Local default data path:

```text
fairgame-rebuild/.data/pglite
```

The `.data/` directory must be ignored by Git.

## Verification

Tests should prove:

- schema initializes;
- create writes a snapshot and `match.created` event;
- move writes a new snapshot and `move.applied` event;
- a new service instance can load existing snapshots;
- after reload, a match can continue from the restored state.
