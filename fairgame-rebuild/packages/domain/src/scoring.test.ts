import { describe, expect, it } from "vitest";

import { getMatchOutcome, scoreBoardOutcome } from "./scoring";
import type { FairMatch } from "./types";

function matchWithOutcomes(outcomes: FairMatch<unknown>["boards"]): FairMatch<unknown> {
  return {
    id: "match-1",
    gameType: "fixture",
    seats: ["seat1", "seat2"],
    boards: outcomes
  };
}

describe("scoring", () => {
  it("scores generic board wins", () => {
    expect(
      scoreBoardOutcome({
        status: "win",
        winner: "seat1",
        loser: "seat2",
        reason: "fixture-win"
      })
    ).toEqual({ seat1: 1, seat2: 0 });
  });

  it("scores generic board draws", () => {
    expect(scoreBoardOutcome({ status: "draw", reason: "fixture-draw" })).toEqual({
      seat1: 0.5,
      seat2: 0.5
    });
  });

  it("returns in-progress match outcome while any board is unfinished", () => {
    const outcome = getMatchOutcome(
      matchWithOutcomes([
        {
          id: "A",
          firstSeat: "seat1",
          state: {},
          outcome: { status: "win", winner: "seat1", loser: "seat2", reason: "done" }
        },
        {
          id: "B",
          firstSeat: "seat2",
          state: {},
          outcome: { status: "in_progress" }
        }
      ])
    );

    expect(outcome).toEqual({
      status: "in_progress",
      score: { seat1: 1, seat2: 0 }
    });
  });

  it("returns a completed match outcome with the winning seat", () => {
    const outcome = getMatchOutcome(
      matchWithOutcomes([
        {
          id: "A",
          firstSeat: "seat1",
          state: {},
          outcome: { status: "win", winner: "seat1", loser: "seat2", reason: "done" }
        },
        {
          id: "B",
          firstSeat: "seat2",
          state: {},
          outcome: { status: "draw", reason: "drawn" }
        }
      ])
    );

    expect(outcome).toEqual({
      status: "completed",
      score: { seat1: 1.5, seat2: 0.5 },
      winner: "seat1"
    });
  });

  it("returns a completed tied match when scores are equal", () => {
    const outcome = getMatchOutcome(
      matchWithOutcomes([
        {
          id: "A",
          firstSeat: "seat1",
          state: {},
          outcome: { status: "win", winner: "seat1", loser: "seat2", reason: "done" }
        },
        {
          id: "B",
          firstSeat: "seat2",
          state: {},
          outcome: { status: "win", winner: "seat2", loser: "seat1", reason: "done" }
        }
      ])
    );

    expect(outcome).toEqual({
      status: "completed",
      score: { seat1: 1, seat2: 1 },
      winner: null
    });
  });

  it("cancels the whole match when any board reports canceled", () => {
    const outcome = getMatchOutcome(
      matchWithOutcomes([
        {
          id: "A",
          firstSeat: "seat1",
          state: {},
          outcome: { status: "canceled", reason: "fixture-canceled" }
        },
        {
          id: "B",
          firstSeat: "seat2",
          state: {},
          outcome: { status: "in_progress" }
        }
      ])
    );

    expect(outcome).toEqual({ status: "canceled", reason: "fixture-canceled" });
  });
});
