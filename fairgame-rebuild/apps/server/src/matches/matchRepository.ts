import type { FairMatch, MatchClock } from "@fairgame/domain";
import type { BoardId, SeatId } from "@fairgame/shared";

export type SerializedStoredMatch<TState = unknown> = {
  readonly match: FairMatch<TState>;
  readonly joinedSeats: readonly SeatId[];
  readonly seatClaims: readonly (readonly [SeatId, string])[];
  readonly playerNames?: readonly (readonly [SeatId, string])[];
  readonly lastActivityAtMs?: number;
  readonly clock?: MatchClock | null;
};

export type MatchEventInput<TPayload = unknown> = {
  readonly matchId: string;
  readonly eventType: "match.created" | "seat.joined" | "move.applied" | "clock.timeout" | "match.pruned";
  readonly payload: TPayload;
};

export type MoveAppliedPayload<TMove = unknown> = {
  readonly boardId: BoardId;
  readonly seat: SeatId;
  readonly move: TMove;
};

export type MatchRepository<TState = unknown> = {
  initialize(): Promise<void>;
  healthCheck(): Promise<void>;
  loadSnapshots(): Promise<SerializedStoredMatch<TState>[]>;
  saveSnapshot(snapshot: SerializedStoredMatch<TState>): Promise<void>;
  deleteSnapshot(matchId: string): Promise<void>;
  appendEvent(event: MatchEventInput): Promise<void>;
};
