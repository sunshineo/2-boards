import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { PGlite } from "@electric-sql/pglite";

import type { MatchEventInput, MatchRepository, SerializedStoredMatch } from "../matches/matchRepository";

type SnapshotRow<TState> = {
  match_id: string;
  payload: SerializedStoredMatch<TState> | string;
};

type EventCountRow = {
  count: string;
};

export class PgliteMatchRepository<TState = unknown> implements MatchRepository<TState> {
  private constructor(private readonly db: PGlite) {}

  static async open<TState = unknown>(dataDir: string): Promise<PgliteMatchRepository<TState>> {
    await mkdir(dirname(dataDir), { recursive: true });
    const db = await PGlite.create(dataDir);
    const repository = new PgliteMatchRepository<TState>(db);
    await repository.initialize();
    return repository;
  }

  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS match_events (
        id BIGSERIAL PRIMARY KEY,
        match_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS match_events_match_id_idx
        ON match_events(match_id);

      CREATE TABLE IF NOT EXISTS match_snapshots (
        match_id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  async loadSnapshots(): Promise<SerializedStoredMatch<TState>[]> {
    const result = await this.db.query<SnapshotRow<TState>>(
      "SELECT match_id, payload FROM match_snapshots ORDER BY updated_at ASC"
    );
    return result.rows.map((row) => parsePayload(row.payload));
  }

  async saveSnapshot(snapshot: SerializedStoredMatch<TState>): Promise<void> {
    await this.db.query(
      `
      INSERT INTO match_snapshots(match_id, payload, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (match_id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
      `,
      [snapshot.match.id, JSON.stringify(snapshot)]
    );
  }

  async appendEvent(event: MatchEventInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO match_events(match_id, event_type, payload)
      VALUES ($1, $2, $3::jsonb)
      `,
      [event.matchId, event.eventType, JSON.stringify(event.payload)]
    );
  }

  async countEvents(matchId: string): Promise<number> {
    const result = await this.db.query<EventCountRow>(
      "SELECT count(*)::text AS count FROM match_events WHERE match_id = $1",
      [matchId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

function parsePayload<TState>(payload: SerializedStoredMatch<TState> | string): SerializedStoredMatch<TState> {
  return typeof payload === "string" ? (JSON.parse(payload) as SerializedStoredMatch<TState>) : payload;
}
