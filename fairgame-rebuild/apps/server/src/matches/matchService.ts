import {
  advanceMatchClock,
  completeClockMove,
  createMatchClock,
  setClockRunningSeats,
  toClockView,
  type ClockConfig,
  type MatchClock,
  getMatchOutcome
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
} from "./gameRegistry.js";
import {
  selectDebugChessBotCommand,
  type DebugChessBotCommand,
  type DebugChessBotConfig
} from "./debugChessBot.js";
import type { MatchEventInput, MatchRepository, SerializedStoredMatch } from "./matchRepository.js";
import { toMatchView, type MatchView, type OpenMatchView } from "./matchView.js";

type StoredMatch = {
  match: SupportedFairMatch;
  joinedSeats: Set<SeatId>;
  seatClaims: Map<SeatId, string>;
  playerNames: Map<SeatId, string>;
  lastActivityAtMs: number;
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
  readonly claim?: SeatClaim;
};

type MoveResult =
  | { readonly ok: true; readonly match: MatchView }
  | { readonly ok: false; readonly status: 400 | 404 | 409; readonly reason: string; readonly match?: MatchView };

const defaultClockConfig: ClockConfig = {
  initialMs: 5 * 60 * 1_000,
  incrementMs: 0
};

const disabledDebugChessBot: DebugChessBotConfig = {
  enabled: false,
  name: "Debug Bot",
  moveDelayMs: 2_000,
  seat: "seat2"
};

export class MatchService {
  private readonly matches = new Map<string, StoredMatch>();
  private readonly createId: () => string;
  private readonly createSecret: () => string;
  private readonly repository: MatchRepository<SupportedGameState> | null;
  private readonly clockConfig: ClockConfig | null;
  private readonly debugChessBot: DebugChessBotConfig;
  private readonly nowMs: () => number;
  private readonly listeners = new Set<(match: MatchView) => void>();
  private readonly debugChessBotMatchIds = new Set<string>();
  private readonly debugChessBotTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private isApplyingDebugChessBotMove = false;

  constructor(
    options: {
      readonly createId?: () => string;
      readonly createSecret?: () => string;
      readonly repository?: MatchRepository<SupportedGameState>;
      readonly clockConfig?: ClockConfig | null;
      readonly debugChessBot?: DebugChessBotConfig;
      readonly nowMs?: () => number;
    } = {}
  ) {
    this.createId = options.createId ?? randomUUID;
    this.createSecret = options.createSecret ?? randomUUID;
    this.repository = options.repository ?? null;
    this.clockConfig = options.clockConfig === undefined ? defaultClockConfig : options.clockConfig;
    this.debugChessBot = options.debugChessBot ?? disabledDebugChessBot;
    this.nowMs = options.nowMs ?? Date.now;
  }

  async loadFromRepository(): Promise<void> {
    if (!this.repository) return;
    const snapshots = await this.repository.loadSnapshots();
    this.matches.clear();

    for (const snapshot of snapshots) {
      this.matches.set(snapshot.match.id, deserializeStoredMatch(snapshot, this.nowMs()));
    }

    for (const stored of this.matches.values()) {
      await this.maybeStartDebugChessBot(stored);
    }
  }

  async createMatch(
    gameType: SupportedGameType,
    playerName?: string,
    clockConfig?: ClockConfig
  ): Promise<CreateMatchResult> {
    const game = getGameDefinition(gameType);
    if (!game) {
      throw new Error(`Unsupported game type: ${gameType}`);
    }

    const nowMs = this.nowMs();
    const match = game.createMatch(this.createId());
    const matchClockConfig = clockConfig ?? this.clockConfig;
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
      lastActivityAtMs: nowMs,
      clock: matchClockConfig ? createMatchClock(matchClockConfig, nowMs) : null
    };
    this.matches.set(match.id, storedMatch);
    await this.persistChange(storedMatch, {
      matchId: match.id,
      eventType: "match.created",
      payload: { gameType, seat: "seat1", clockConfig: matchClockConfig }
    });

    await this.maybeStartDebugChessBot(storedMatch);

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

    return this.claimSecondSeat(id, stored, playerName);
  }

  listOpenMatches(): OpenMatchView[] {
    return [...this.matches.values()]
      .filter((stored) => getMatchOutcome(stored.match).status === "in_progress" && !stored.joinedSeats.has("seat2"))
      .sort((left, right) => right.lastActivityAtMs - left.lastActivityAtMs)
      .slice(0, 12)
      .map((stored) => {
        const game = getGameDefinition(stored.match.gameType);
        if (!game) {
          throw new Error(`Unsupported game type in open match list: ${stored.match.gameType}`);
        }

        return {
          id: stored.match.id,
          gameType: game.gameType,
          gameLabel: game.label,
          clockInitialMs: stored.clock?.config.initialMs ?? null,
          clockIncrementMs: stored.clock?.config.incrementMs ?? null,
          joinedSeats: stored.joinedSeats.size,
          maxSeats: stored.match.seats.length,
          updatedAtMs: stored.lastActivityAtMs
        };
      });
  }

  async pruneStaleMatches(nowMs: number, maxAgeMs: number): Promise<string[]> {
    const pruned: string[] = [];

    for (const [matchId, stored] of this.matches) {
      if (nowMs - stored.lastActivityAtMs <= maxAgeMs) continue;
      const outcome = getMatchOutcome(stored.match);
      const isCompleted = outcome.status !== "in_progress";
      const isNeverJoined = !stored.joinedSeats.has("seat2");
      if (!isCompleted && !isNeverJoined) continue;

      if (this.repository) {
        await this.repository.appendEvent({
          matchId,
          eventType: "match.pruned",
          payload: {
            reason: isCompleted ? "completed" : "never-joined",
            lastActivityAtMs: stored.lastActivityAtMs,
            prunedAtMs: nowMs
          }
        });
        await this.repository.deleteSnapshot(matchId);
      }
      this.matches.delete(matchId);
      this.clearDebugChessBotTimer(matchId);
      pruned.push(matchId);
    }

    return pruned;
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

    const seat = this.validateSeatClaim(stored, claimValue);
    if (seat) {
      return {
        seat,
        match: this.createMatchView(stored)
      };
    }

    if (!stored.joinedSeats.has("seat2")) {
      return this.claimSecondSeat(id, stored);
    }

    return {
      seat: null,
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
    if (!this.areAllSeatsJoined(stored)) {
      return { ok: false, status: 409, reason: "match-not-ready", match: this.createMatchView(stored, nowMs) };
    }

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
    stored.lastActivityAtMs = nowMs;
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
    if (!this.isApplyingDebugChessBotMove) {
      await this.runOrScheduleDebugChessBot(stored);
    }

    return {
      ok: true,
      match: this.createMatchView(stored)
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

  private async claimSecondSeat(
    id: string,
    stored: StoredMatch,
    playerName?: string
  ): Promise<CreateMatchResult> {
    const nowMs = this.nowMs();
    stored.joinedSeats.add("seat2");
    stored.playerNames.set("seat2", sanitizePlayerName(playerName, "Player 2"));
    stored.clock = stored.clock
      ? setClockRunningSeats(stored.clock, getActiveSeats(stored.match), nowMs)
      : null;
    stored.lastActivityAtMs = nowMs;
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
    return toMatchView(
      stored.match,
      stored.clock ? toClockView(stored.clock, nowMs) : null,
      stored.playerNames,
      stored.joinedSeats.size,
      this.areAllSeatsJoined(stored)
    );
  }

  private areAllSeatsJoined(stored: StoredMatch): boolean {
    return stored.match.seats.every((seat) => stored.joinedSeats.has(seat));
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
    stored.lastActivityAtMs = clock.updatedAtMs;
    this.clearDebugChessBotTimer(stored.match.id);
    await this.persistChange(stored, {
      matchId: stored.match.id,
      eventType: "clock.timeout",
      payload: { expiredSeats }
    });
    this.emitMatchUpdated(this.createMatchView(stored, clock.updatedAtMs));
  }

  private async maybeStartDebugChessBot(stored: StoredMatch): Promise<void> {
    if (!this.debugChessBot.enabled || stored.match.gameType !== "chess") return;
    if (getMatchOutcome(stored.match).status !== "in_progress") return;

    if (!stored.joinedSeats.has(this.debugChessBot.seat)) {
      this.debugChessBotMatchIds.add(stored.match.id);
      await this.claimSecondSeat(stored.match.id, stored, this.debugChessBot.name);
    } else if (stored.playerNames.get(this.debugChessBot.seat) === this.debugChessBot.name) {
      this.debugChessBotMatchIds.add(stored.match.id);
    }

    await this.runOrScheduleDebugChessBot(stored);
  }

  private async runOrScheduleDebugChessBot(stored: StoredMatch): Promise<void> {
    if (!this.getDebugChessBotCommand(stored)) return;
    if (this.debugChessBot.moveDelayMs <= 0) {
      await this.playImmediateDebugChessBotTurns(stored);
      return;
    }

    this.scheduleDebugChessBotTurn(stored);
  }

  private scheduleDebugChessBotTurn(stored: StoredMatch): void {
    if (this.debugChessBotTimers.has(stored.match.id)) return;

    const timer = setTimeout(() => {
      this.debugChessBotTimers.delete(stored.match.id);
      void this.playScheduledDebugChessBotTurn(stored.match.id);
    }, this.debugChessBot.moveDelayMs);
    if (typeof timer === "object" && timer && "unref" in timer && typeof timer.unref === "function") {
      timer.unref();
    }
    this.debugChessBotTimers.set(stored.match.id, timer);
  }

  private async playScheduledDebugChessBotTurn(matchId: string): Promise<void> {
    const stored = this.matches.get(matchId);
    if (!stored || this.isApplyingDebugChessBotMove) return;

    const command = this.getDebugChessBotCommand(stored);
    if (!command) return;

    this.isApplyingDebugChessBotMove = true;
    try {
      await this.applyDebugChessBotCommand(stored, command);
    } finally {
      this.isApplyingDebugChessBotMove = false;
    }

    const latest = this.matches.get(matchId);
    if (latest) {
      await this.runOrScheduleDebugChessBot(latest);
    }
  }

  private async playImmediateDebugChessBotTurns(stored: StoredMatch): Promise<void> {
    if (this.isApplyingDebugChessBotMove) return;

    this.isApplyingDebugChessBotMove = true;
    try {
      for (let moveCount = 0; moveCount < 8; moveCount += 1) {
        const command = this.getDebugChessBotCommand(stored);
        if (!command) return;

        const result = await this.applyDebugChessBotCommand(stored, command);
        if (!result.ok) return;
      }
    } finally {
      this.isApplyingDebugChessBotMove = false;
    }
  }

  private getDebugChessBotCommand(stored: StoredMatch): DebugChessBotCommand | null {
    if (!this.debugChessBot.enabled) return null;
    if (!this.debugChessBotMatchIds.has(stored.match.id)) return null;
    if (!this.areAllSeatsJoined(stored)) return null;
    if (getMatchOutcome(stored.match).status !== "in_progress") return null;
    return selectDebugChessBotCommand(this.createMatchView(stored), this.debugChessBot.seat);
  }

  private applyDebugChessBotCommand(stored: StoredMatch, command: DebugChessBotCommand): Promise<MoveResult> {
    return this.applyMove({
      id: stored.match.id,
      boardId: command.boardId,
      seat: this.debugChessBot.seat,
      move: command.move
    });
  }

  private clearDebugChessBotTimer(matchId: string): void {
    const timer = this.debugChessBotTimers.get(matchId);
    if (!timer) return;
    clearTimeout(timer);
    this.debugChessBotTimers.delete(matchId);
  }
}

function serializeStoredMatch(stored: StoredMatch): SerializedStoredMatch<SupportedGameState> {
  return {
    match: stored.match,
    joinedSeats: [...stored.joinedSeats],
    seatClaims: [...stored.seatClaims.entries()],
    playerNames: [...stored.playerNames.entries()],
    lastActivityAtMs: stored.lastActivityAtMs,
    clock: stored.clock
  };
}

function deserializeStoredMatch(snapshot: SerializedStoredMatch<SupportedGameState>, fallbackActivityAtMs: number): StoredMatch {
  return {
    match: snapshot.match,
    joinedSeats: new Set(snapshot.joinedSeats),
    seatClaims: new Map(snapshot.seatClaims),
    playerNames: new Map(snapshot.playerNames ?? [
      ["seat1", "Player 1"],
      ["seat2", "Player 2"]
    ]),
    lastActivityAtMs: snapshot.lastActivityAtMs ?? fallbackActivityAtMs,
    clock: snapshot.clock ?? null
  };
}

function sanitizePlayerName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 40) : fallback;
}
