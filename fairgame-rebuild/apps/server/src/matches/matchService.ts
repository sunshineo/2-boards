import {
  advanceMatchClock,
  completeClockMove,
  createMatchClock,
  setClockRunningSeats,
  toClockView,
  type ClockConfig,
  type MatchClock
} from "@fairgame/domain";
import type { BoardId, SeatId } from "@fairgame/shared";
import { randomUUID } from "node:crypto";

import {
  applyTimeoutToMatch,
  getActiveSeats,
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
  playerNames: Map<SeatId, string>;
  clock: MatchClock | null;
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

const defaultClockConfig: ClockConfig = {
  initialMs: 5 * 60 * 1_000,
  incrementMs: 2_000
};

export class MatchService {
  private readonly matches = new Map<string, StoredMatch>();
  private readonly createId: () => string;
  private readonly createSecret: () => string;
  private readonly repository: MatchRepository<SupportedGameState> | null;
  private readonly clockConfig: ClockConfig | null;
  private readonly nowMs: () => number;
  private readonly listeners = new Set<(match: MatchView) => void>();

  constructor(
    options: {
      readonly createId?: () => string;
      readonly createSecret?: () => string;
      readonly repository?: MatchRepository<SupportedGameState>;
      readonly clockConfig?: ClockConfig | null;
      readonly nowMs?: () => number;
    } = {}
  ) {
    this.createId = options.createId ?? randomUUID;
    this.createSecret = options.createSecret ?? randomUUID;
    this.repository = options.repository ?? null;
    this.clockConfig = options.clockConfig === undefined ? defaultClockConfig : options.clockConfig;
    this.nowMs = options.nowMs ?? Date.now;
  }

  async loadFromRepository(): Promise<void> {
    if (!this.repository) return;
    const snapshots = await this.repository.loadSnapshots();
    this.matches.clear();

    for (const snapshot of snapshots) {
      this.matches.set(snapshot.match.id, deserializeStoredMatch(snapshot));
    }
  }

  async createMatch(gameType: SupportedGameType, playerName?: string): Promise<CreateMatchResult> {
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
      seatClaims,
      playerNames: new Map([
        ["seat1", sanitizePlayerName(playerName, "Player 1")],
        ["seat2", "Player 2"]
      ]),
      clock: this.clockConfig ? createMatchClock(this.clockConfig, this.nowMs()) : null
    };
    this.matches.set(match.id, storedMatch);
    await this.persistChange(storedMatch, {
      matchId: match.id,
      eventType: "match.created",
      payload: { gameType, seat: "seat1" }
    });

    return {
      seat: "seat1",
      match: this.createMatchView(storedMatch),
      claim
    };
  }

  async joinMatch(
    id: string,
    playerName?: string
  ): Promise<CreateMatchResult | null | { readonly error: "seat-unavailable"; readonly match: MatchView }> {
    const stored = this.matches.get(id);
    if (!stored) return null;

    if (stored.joinedSeats.has("seat2")) {
      return {
        error: "seat-unavailable",
        match: this.createMatchView(stored)
      };
    }

    stored.joinedSeats.add("seat2");
    stored.playerNames.set("seat2", sanitizePlayerName(playerName, "Player 2"));
    stored.clock = stored.clock
      ? setClockRunningSeats(stored.clock, getActiveSeats(stored.match), this.nowMs())
      : null;
    const claim = this.createSeatClaim(id, "seat2", stored.seatClaims);
    const match = this.createMatchView(stored);
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

  async getMatch(id: string): Promise<MatchView | null> {
    const stored = this.matches.get(id);
    if (!stored) return null;
    await this.applyClockTimeoutIfNeeded(stored, this.nowMs());
    return this.createMatchView(stored);
  }

  async restoreSession(id: string, claimValue: string | null): Promise<RestoredSession | null> {
    const stored = this.matches.get(id);
    if (!stored) return null;
    await this.applyClockTimeoutIfNeeded(stored, this.nowMs());

    return {
      seat: this.validateSeatClaim(stored, claimValue),
      match: this.createMatchView(stored)
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

    const nowMs = this.nowMs();
    if (await this.applyClockTimeoutIfNeeded(stored, nowMs)) {
      return { ok: false, status: 400, reason: "clock-expired", match: this.createMatchView(stored, nowMs) };
    }

    const game = getGameDefinition(stored.match.gameType);
    if (!game) {
      return { ok: false, status: 400, reason: "unsupported-game", match: this.createMatchView(stored, nowMs) };
    }

    const move = game.parseMove(input.move);
    if (!move) {
      return { ok: false, status: 400, reason: "invalid-move", match: this.createMatchView(stored, nowMs) };
    }

    const advancedClock = stored.clock ? advanceMatchClock(stored.clock, nowMs) : null;
    if (advancedClock && advancedClock.expiredSeats.length > 0) {
      await this.expireMatchByClock(stored, advancedClock.clock, advancedClock.expiredSeats);
      return { ok: false, status: 400, reason: "clock-expired", match: this.createMatchView(stored, nowMs) };
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
        match: this.createMatchView(stored, nowMs)
      };
    }

    stored.match = result.match;
    stored.clock = advancedClock
      ? completeClockMove(advancedClock.clock, input.seat, getActiveSeats(stored.match), nowMs)
      : null;
    const match = this.createMatchView(stored, nowMs);
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

  private createMatchView(stored: StoredMatch, nowMs = this.nowMs()): MatchView {
    return toMatchView(stored.match, stored.clock ? toClockView(stored.clock, nowMs) : null, stored.playerNames);
  }

  private async applyClockTimeoutIfNeeded(stored: StoredMatch, nowMs: number): Promise<boolean> {
    if (!stored.clock) return false;
    const result = advanceMatchClock(stored.clock, nowMs);
    if (result.expiredSeats.length === 0) return false;

    await this.expireMatchByClock(stored, result.clock, result.expiredSeats);
    return true;
  }

  private async expireMatchByClock(
    stored: StoredMatch,
    clock: MatchClock,
    expiredSeats: readonly SeatId[]
  ): Promise<void> {
    stored.clock = clock;
    stored.match = applyTimeoutToMatch(stored.match, expiredSeats);
    await this.persistChange(stored, {
      matchId: stored.match.id,
      eventType: "clock.timeout",
      payload: { expiredSeats }
    });
    this.emitMatchUpdated(this.createMatchView(stored, clock.updatedAtMs));
  }
}

function serializeStoredMatch(stored: StoredMatch): SerializedStoredMatch<SupportedGameState> {
  return {
    match: stored.match,
    joinedSeats: [...stored.joinedSeats],
    seatClaims: [...stored.seatClaims.entries()],
    playerNames: [...stored.playerNames.entries()],
    clock: stored.clock
  };
}

function deserializeStoredMatch(snapshot: SerializedStoredMatch<SupportedGameState>): StoredMatch {
  return {
    match: snapshot.match,
    joinedSeats: new Set(snapshot.joinedSeats),
    seatClaims: new Map(snapshot.seatClaims),
    playerNames: new Map(snapshot.playerNames ?? [
      ["seat1", "Player 1"],
      ["seat2", "Player 2"]
    ]),
    clock: snapshot.clock ?? null
  };
}

function sanitizePlayerName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 40) : fallback;
}
