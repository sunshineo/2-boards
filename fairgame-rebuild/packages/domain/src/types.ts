import type { BoardId, BoardOutcome, SeatId } from "@fairgame/shared";

export type SeatPair = readonly [SeatId, SeatId];

export type FairBoard<TState> = {
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly state: TState;
  readonly outcome: BoardOutcome;
};

export type FairMatch<TState> = {
  readonly id: string;
  readonly gameType: string;
  readonly seats: SeatPair;
  readonly boards: readonly [FairBoard<TState>, FairBoard<TState>];
};

export type MatchScore = Readonly<Record<SeatId, number>>;

export type MatchOutcome =
  | { readonly status: "in_progress"; readonly score: MatchScore }
  | { readonly status: "completed"; readonly score: MatchScore; readonly winner: SeatId | null }
  | { readonly status: "canceled"; readonly reason: string };

export type ValidationResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export type GameRules<TState, TMove> = {
  readonly gameType: string;
  createInitialState(input: { readonly firstSeat: SeatId; readonly seats: SeatPair }): TState;
  getSeatsToAct(state: TState): readonly SeatId[];
  validateMove(input: {
    readonly state: TState;
    readonly move: TMove;
    readonly seat: SeatId;
  }): ValidationResult;
  applyMove(input: { readonly state: TState; readonly move: TMove; readonly seat: SeatId }): TState;
  getOutcome(state: TState): BoardOutcome;
};

export type ApplyMoveCommand<TMove> = {
  readonly boardId: BoardId;
  readonly seat: SeatId;
  readonly move: TMove;
};

export type ApplyMoveRejectionReason =
  | "match-not-active"
  | "board-not-found"
  | "board-not-active"
  | "seat-not-to-act"
  | string;

export type ApplyMoveResult<TState> =
  | { readonly ok: true; readonly match: FairMatch<TState> }
  | { readonly ok: false; readonly reason: ApplyMoveRejectionReason; readonly match: FairMatch<TState> };
