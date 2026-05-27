import { describe, expect, it } from "vitest";

import { applyMoveToMatch, createFairMatch } from "./engine";
import { getMatchOutcome } from "./scoring";
import type { GameRules } from "./types";

type FixtureState = {
  seatsToAct: ("seat1" | "seat2")[];
  moves: string[];
  outcome:
    | { status: "in_progress" }
    | { status: "draw"; reason: string }
    | { status: "win"; winner: "seat1" | "seat2"; loser: "seat1" | "seat2"; reason: string }
    | { status: "canceled"; reason: string };
};

type FixtureMove = {
  value: string;
};

const fixtureRules: GameRules<FixtureState, FixtureMove> = {
  gameType: "fixture",
  createInitialState({ firstSeat }) {
    return {
      seatsToAct: [firstSeat],
      moves: [],
      outcome: { status: "in_progress" }
    };
  },
  getSeatsToAct(state) {
    return state.seatsToAct;
  },
  validateMove({ move }) {
    if (move.value === "illegal") {
      return { ok: false, reason: "fixture-illegal" };
    }
    return { ok: true };
  },
  applyMove({ state, move, seat }) {
    const nextSeat = seat === "seat1" ? "seat2" : "seat1";
    const nextOutcome =
      move.value === "win"
        ? { status: "win" as const, winner: seat, loser: nextSeat, reason: "fixture-win" }
        : move.value === "draw"
          ? { status: "draw" as const, reason: "fixture-draw" }
          : move.value === "cancel"
            ? { status: "canceled" as const, reason: "fixture-cancel" }
            : { status: "in_progress" as const };

    return {
      seatsToAct: nextOutcome.status === "in_progress" ? [nextSeat] : [],
      moves: [...state.moves, `${seat}:${move.value}`],
      outcome: nextOutcome
    };
  },
  getOutcome(state) {
    return state.outcome;
  }
};

describe("fair match engine", () => {
  it("creates the two-board starter assignment", () => {
    const match = createFairMatch({ id: "match-1", rules: fixtureRules });

    expect(match.boards).toEqual([
      {
        id: "A",
        firstSeat: "seat1",
        state: { seatsToAct: ["seat1"], moves: [], outcome: { status: "in_progress" } },
        outcome: { status: "in_progress" }
      },
      {
        id: "B",
        firstSeat: "seat2",
        state: { seatsToAct: ["seat2"], moves: [], outcome: { status: "in_progress" } },
        outcome: { status: "in_progress" }
      }
    ]);
  });

  it("applies a move only to the targeted board", () => {
    const match = createFairMatch({ id: "match-1", rules: fixtureRules });
    const result = applyMoveToMatch(match, fixtureRules, {
      boardId: "A",
      seat: "seat1",
      move: { value: "continue" }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(result.match.boards[0]?.state.moves).toEqual(["seat1:continue"]);
    expect(result.match.boards[0]?.state.seatsToAct).toEqual(["seat2"]);
    expect(result.match.boards[1]?.state.moves).toEqual([]);
    expect(result.match.boards[1]?.state.seatsToAct).toEqual(["seat2"]);
  });

  it("rejects a move from the wrong seat without mutating the match", () => {
    const match = createFairMatch({ id: "match-1", rules: fixtureRules });
    const result = applyMoveToMatch(match, fixtureRules, {
      boardId: "A",
      seat: "seat2",
      move: { value: "continue" }
    });

    expect(result).toEqual({
      ok: false,
      reason: "seat-not-to-act",
      match
    });
  });

  it("rejects game-level validation errors without mutating the match", () => {
    const match = createFairMatch({ id: "match-1", rules: fixtureRules });
    const result = applyMoveToMatch(match, fixtureRules, {
      boardId: "A",
      seat: "seat1",
      move: { value: "illegal" }
    });

    expect(result).toEqual({
      ok: false,
      reason: "fixture-illegal",
      match
    });
  });

  it("scores a completed match after both boards finish", () => {
    const match = createFairMatch({ id: "match-1", rules: fixtureRules });
    const boardA = applyMoveToMatch(match, fixtureRules, {
      boardId: "A",
      seat: "seat1",
      move: { value: "win" }
    });
    if (!boardA.ok) throw new Error(boardA.reason);

    const boardB = applyMoveToMatch(boardA.match, fixtureRules, {
      boardId: "B",
      seat: "seat2",
      move: { value: "win" }
    });
    if (!boardB.ok) throw new Error(boardB.reason);

    expect(getMatchOutcome(boardB.match)).toEqual({
      status: "completed",
      score: { seat1: 1, seat2: 1 },
      winner: null
    });
  });

  it("cancels the whole match when a board reports canceled", () => {
    const match = createFairMatch({ id: "match-1", rules: fixtureRules });
    const result = applyMoveToMatch(match, fixtureRules, {
      boardId: "A",
      seat: "seat1",
      move: { value: "cancel" }
    });
    if (!result.ok) throw new Error(result.reason);

    expect(getMatchOutcome(result.match)).toEqual({
      status: "canceled",
      reason: "fixture-cancel"
    });
  });

  it("rejects moves after the match is completed", () => {
    const match = createFairMatch({ id: "match-1", rules: fixtureRules });
    const boardA = applyMoveToMatch(match, fixtureRules, {
      boardId: "A",
      seat: "seat1",
      move: { value: "win" }
    });
    if (!boardA.ok) throw new Error(boardA.reason);

    const boardB = applyMoveToMatch(boardA.match, fixtureRules, {
      boardId: "B",
      seat: "seat2",
      move: { value: "win" }
    });
    if (!boardB.ok) throw new Error(boardB.reason);

    const rejected = applyMoveToMatch(boardB.match, fixtureRules, {
      boardId: "A",
      seat: "seat1",
      move: { value: "continue" }
    });

    expect(rejected).toEqual({
      ok: false,
      reason: "match-not-active",
      match: boardB.match
    });
  });
});
