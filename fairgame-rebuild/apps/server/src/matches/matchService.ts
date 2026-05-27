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
  seatClaims: Map<SeatId, string>;
};

type CreateMatchResult = {
  readonly seat: SeatId;
  readonly match: MatchView;
  readonly claim: SeatClaim;
};

export type SeatClaim = {
  readonly matchId: string;
  readonly seat: SeatId;
  readonly secret: string;
};

export type RestoredSession = {
  readonly seat: SeatId | null;
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
  private readonly createSecret: () => string;
  private readonly listeners = new Set<(match: MatchView) => void>();

  constructor(options: { readonly createId?: () => string; readonly createSecret?: () => string } = {}) {
    this.createId = options.createId ?? randomUUID;
    this.createSecret = options.createSecret ?? randomUUID;
  }

  createMatch(): CreateMatchResult {
    const match = createTicTacToeMatch(this.createId());
    const seatClaims = new Map<SeatId, string>();
    const claim = this.createSeatClaim(match.id, "seat1", seatClaims);
    this.matches.set(match.id, {
      match,
      joinedSeats: new Set(["seat1"]),
      seatClaims
    });

    return {
      seat: "seat1",
      match: toMatchView(match),
      claim
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
    const claim = this.createSeatClaim(id, "seat2", stored.seatClaims);
    const match = toMatchView(stored.match);
    this.emitMatchUpdated(match);

    return {
      seat: "seat2",
      match,
      claim
    };
  }

  getMatch(id: string): MatchView | null {
    const stored = this.matches.get(id);
    return stored ? toMatchView(stored.match) : null;
  }

  restoreSession(id: string, claimValue: string | null): RestoredSession | null {
    const stored = this.matches.get(id);
    if (!stored) return null;

    return {
      seat: this.validateSeatClaim(stored, claimValue),
      match: toMatchView(stored.match)
    };
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
    const match = toMatchView(stored.match);
    this.emitMatchUpdated(match);

    return {
      ok: true,
      match
    };
  }

  onMatchUpdated(listener: (match: MatchView) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private createSeatClaim(matchId: string, seat: SeatId, claims: Map<SeatId, string>): SeatClaim {
    const secret = this.createSecret();
    claims.set(seat, secret);
    return { matchId, seat, secret };
  }

  private validateSeatClaim(stored: StoredMatch, claimValue: string | null): SeatId | null {
    if (!claimValue) return null;
    const [seat, secret] = claimValue.split(".");
    if ((seat !== "seat1" && seat !== "seat2") || !secret) return null;
    return stored.seatClaims.get(seat) === secret ? seat : null;
  }

  private emitMatchUpdated(match: MatchView) {
    for (const listener of this.listeners) {
      listener(match);
    }
  }
}
