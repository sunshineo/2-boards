import {
  applyMoveToMatch,
  createFairMatch,
  ticTacToeRules,
  type TicTacToeMove,
  type TicTacToeState
} from "@fairgame/domain";
import type { BoardId, SeatId } from "@fairgame/shared";
import { randomUUID } from "node:crypto";

import { toMatchView, type MatchView } from "./matchView";

type StoredMatch = {
  match: ReturnType<typeof createTicTacToeMatch>;
  joinedSeats: Set<SeatId>;
};

type CreateMatchResult = {
  readonly seat: SeatId;
  readonly match: MatchView;
};

type MoveResult =
  | { readonly ok: true; readonly match: MatchView }
  | { readonly ok: false; readonly status: 400 | 404; readonly reason: string; readonly match?: MatchView };

function createTicTacToeMatch(id: string) {
  return createFairMatch<TicTacToeState, TicTacToeMove>({ id, rules: ticTacToeRules });
}

export class MatchService {
  private readonly matches = new Map<string, StoredMatch>();
  private readonly createId: () => string;

  constructor(options: { readonly createId?: () => string } = {}) {
    this.createId = options.createId ?? randomUUID;
  }

  createMatch(): CreateMatchResult {
    const match = createTicTacToeMatch(this.createId());
    this.matches.set(match.id, {
      match,
      joinedSeats: new Set(["seat1"])
    });

    return {
      seat: "seat1",
      match: toMatchView(match)
    };
  }

  joinMatch(id: string): CreateMatchResult | null | { readonly error: "seat-unavailable"; readonly match: MatchView } {
    const stored = this.matches.get(id);
    if (!stored) return null;

    if (stored.joinedSeats.has("seat2")) {
      return {
        error: "seat-unavailable",
        match: toMatchView(stored.match)
      };
    }

    stored.joinedSeats.add("seat2");
    return {
      seat: "seat2",
      match: toMatchView(stored.match)
    };
  }

  getMatch(id: string): MatchView | null {
    const stored = this.matches.get(id);
    return stored ? toMatchView(stored.match) : null;
  }

  applyMove(input: {
    readonly id: string;
    readonly boardId: BoardId;
    readonly seat: SeatId;
    readonly move: TicTacToeMove;
  }): MoveResult {
    const stored = this.matches.get(input.id);
    if (!stored) {
      return { ok: false, status: 404, reason: "match-not-found" };
    }

    const result = applyMoveToMatch(stored.match, ticTacToeRules, {
      boardId: input.boardId,
      seat: input.seat,
      move: input.move
    });

    if (!result.ok) {
      return {
        ok: false,
        status: 400,
        reason: result.reason,
        match: toMatchView(result.match)
      };
    }

    stored.match = result.match;
    return {
      ok: true,
      match: toMatchView(stored.match)
    };
  }
}
