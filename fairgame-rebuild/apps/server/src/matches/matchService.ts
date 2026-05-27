import type { BoardId, SeatId } from "@fairgame/shared";
import { randomUUID } from "node:crypto";

import {
  getGameDefinition,
  type SupportedFairMatch,
  type SupportedGameState,
  type SupportedGameType
} from "./gameRegistry";
import type { MatchEventInput, MatchRepository, SerializedStoredMatch } from "./matchRepository";
import { toMatchView, type MatchView } from "./matchView";

type StoredMatch = {
  match: SupportedFairMatch;
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

export class MatchService {
  private readonly matches = new Map<string, StoredMatch>();
  private readonly createId: () => string;
  private readonly createSecret: () => string;
  private readonly repository: MatchRepository<SupportedGameState> | null;
  private readonly listeners = new Set<(match: MatchView) => void>();

  constructor(
    options: {
      readonly createId?: () => string;
      readonly createSecret?: () => string;
      readonly repository?: MatchRepository<SupportedGameState>;
    } = {}
  ) {
    this.createId = options.createId ?? randomUUID;
    this.createSecret = options.createSecret ?? randomUUID;
    this.repository = options.repository ?? null;
  }

  async loadFromRepository(): Promise<void> {
    if (!this.repository) return;
    const snapshots = await this.repository.loadSnapshots();
    this.matches.clear();

    for (const snapshot of snapshots) {
      this.matches.set(snapshot.match.id, deserializeStoredMatch(snapshot));
    }
  }

  async createMatch(gameType: SupportedGameType): Promise<CreateMatchResult> {
    const game = getGameDefinition(gameType);
    if (!game) {
      throw new Error(`Unsupported game type: ${gameType}`);
    }

    const match = game.createMatch(this.createId());
    const seatClaims = new Map<SeatId, string>();
    const claim = this.createSeatClaim(match.id, "seat1", seatClaims);
    const storedMatch: StoredMatch = {
      match,
      joinedSeats: new Set(["seat1"]),
      seatClaims
    };
    this.matches.set(match.id, storedMatch);
    await this.persistChange(storedMatch, {
      matchId: match.id,
      eventType: "match.created",
      payload: { gameType, seat: "seat1" }
    });

    return {
      seat: "seat1",
      match: toMatchView(match),
      claim
    };
  }

  async joinMatch(
    id: string
  ): Promise<CreateMatchResult | null | { readonly error: "seat-unavailable"; readonly match: MatchView }> {
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
    await this.persistChange(stored, {
      matchId: id,
      eventType: "seat.joined",
      payload: { seat: "seat2" }
    });
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

  async applyMove(input: {
    readonly id: string;
    readonly boardId: BoardId;
    readonly seat: SeatId;
    readonly move: unknown;
  }): Promise<MoveResult> {
    const stored = this.matches.get(input.id);
    if (!stored) {
      return { ok: false, status: 404, reason: "match-not-found" };
    }

    const game = getGameDefinition(stored.match.gameType);
    if (!game) {
      return { ok: false, status: 400, reason: "unsupported-game", match: toMatchView(stored.match) };
    }

    const move = game.parseMove(input.move);
    if (!move) {
      return { ok: false, status: 400, reason: "invalid-move", match: toMatchView(stored.match) };
    }

    const result = game.applyMove(stored.match, {
      boardId: input.boardId,
      seat: input.seat,
      move
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
    await this.persistChange(stored, {
      matchId: input.id,
      eventType: "move.applied",
      payload: {
        boardId: input.boardId,
        seat: input.seat,
        move
      }
    });
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

  private async persistChange(stored: StoredMatch, event: MatchEventInput) {
    if (!this.repository) return;
    await this.repository.appendEvent(event);
    await this.repository.saveSnapshot(serializeStoredMatch(stored));
  }
}

function serializeStoredMatch(stored: StoredMatch): SerializedStoredMatch<SupportedGameState> {
  return {
    match: stored.match,
    joinedSeats: [...stored.joinedSeats],
    seatClaims: [...stored.seatClaims.entries()]
  };
}

function deserializeStoredMatch(snapshot: SerializedStoredMatch<SupportedGameState>): StoredMatch {
  return {
    match: snapshot.match,
    joinedSeats: new Set(snapshot.joinedSeats),
    seatClaims: new Map(snapshot.seatClaims)
  };
}
