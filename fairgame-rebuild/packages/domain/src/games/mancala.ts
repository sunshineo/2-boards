import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type MancalaState = {
  readonly pitsPerSide: 6;
  readonly stonesPerPit: 4;
  readonly pits: readonly number[];
  readonly stores: Readonly<Record<SeatId, number>>;
  readonly seats: SeatPair;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type MancalaMove = {
  readonly pit: number;
};

type StoreMap = Record<SeatId, number>;

type SowPosition =
  | { readonly type: "pit"; readonly index: number }
  | { readonly type: "store"; readonly seat: SeatId };

const pitsPerSide = 6;
const stonesPerPit = 4;
const totalPits = pitsPerSide * 2;

export const mancalaRules: GameRules<MancalaState, MancalaMove> = {
  gameType: "mancala",

  createInitialState({ firstSeat, seats }) {
    return {
      pitsPerSide,
      stonesPerPit,
      pits: Array<number>(totalPits).fill(stonesPerPit),
      stores: { seat1: 0, seat2: 0 },
      seats,
      nextSeat: firstSeat,
      outcome: { status: "in_progress" }
    };
  },

  getSeatsToAct(state) {
    return state.nextSeat ? [state.nextSeat] : [];
  },

  validateMove({ state, move, seat }) {
    if (state.outcome.status !== "in_progress") {
      return { ok: false, reason: "board-not-active" };
    }

    if (state.nextSeat !== seat) {
      return { ok: false, reason: "seat-not-to-act" };
    }

    if (!Number.isInteger(move.pit) || move.pit < 0 || move.pit >= state.pitsPerSide) {
      return { ok: false, reason: "pit-out-of-range" };
    }

    if ((state.pits[getGlobalPitIndex(seat, move.pit)] ?? 0) <= 0) {
      return { ok: false, reason: "pit-empty" };
    }

    return { ok: true };
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const pits = [...state.pits];
    const stores: StoreMap = { seat1: state.stores.seat1, seat2: state.stores.seat2 };
    const startPit = getGlobalPitIndex(seat, move.pit);
    let stones = pits[startPit] ?? 0;
    let position: SowPosition = { type: "pit", index: startPit };
    let lastPosition: SowPosition = position;

    pits[startPit] = 0;

    while (stones > 0) {
      position = getNextPosition(position);

      if (position.type === "store" && position.seat !== seat) {
        continue;
      }

      if (position.type === "store") {
        stores[position.seat] += 1;
      } else {
        pits[position.index] = (pits[position.index] ?? 0) + 1;
      }

      stones -= 1;
      lastPosition = position;
    }

    applyCapture({ pits, stores, lastPosition, seat });

    const outcome = sweepAndGetOutcome(pits, stores, state.seats);
    const landsInOwnStore = lastPosition.type === "store" && lastPosition.seat === seat;

    return {
      pitsPerSide: state.pitsPerSide,
      stonesPerPit: state.stonesPerPit,
      pits,
      stores,
      seats: state.seats,
      nextSeat: outcome.status === "in_progress" ? (landsInOwnStore ? seat : getOtherSeat(state.seats, seat)) : null,
      outcome
    };
  },

  getOutcome(state) {
    return state.outcome;
  }
};

function applyCapture(input: {
  readonly pits: number[];
  readonly stores: StoreMap;
  readonly lastPosition: SowPosition;
  readonly seat: SeatId;
}) {
  const { pits, stores, lastPosition, seat } = input;

  if (lastPosition.type !== "pit") return;
  if (!isOwnPit(seat, lastPosition.index)) return;
  const landingStones = pits[lastPosition.index] ?? 0;
  if (landingStones !== 1) return;

  const oppositePit = getOppositePitIndex(lastPosition.index);
  const capturedStones = pits[oppositePit] ?? 0;
  if (capturedStones <= 0) return;

  stores[seat] += capturedStones + landingStones;
  pits[lastPosition.index] = 0;
  pits[oppositePit] = 0;
}

function sweepAndGetOutcome(pits: number[], stores: StoreMap, seats: SeatPair): BoardOutcome {
  if (!isSideEmpty(pits, "seat1") && !isSideEmpty(pits, "seat2")) {
    return { status: "in_progress" };
  }

  sweepSide(pits, stores, "seat1");
  sweepSide(pits, stores, "seat2");

  if (stores.seat1 === stores.seat2) {
    return { status: "draw", reason: "stores-tied" };
  }

  const winner = stores.seat1 > stores.seat2 ? "seat1" : "seat2";
  return {
    status: "win",
    winner,
    loser: getOtherSeat(seats, winner),
    reason: "store-count"
  };
}

function sweepSide(pits: number[], stores: StoreMap, seat: SeatId) {
  for (const index of getPitIndexesForSeat(seat)) {
    stores[seat] += pits[index] ?? 0;
    pits[index] = 0;
  }
}

function isSideEmpty(pits: readonly number[], seat: SeatId) {
  return getPitIndexesForSeat(seat).every((index) => (pits[index] ?? 0) === 0);
}

function getPitIndexesForSeat(seat: SeatId) {
  const start = seat === "seat1" ? 0 : pitsPerSide;
  return Array.from({ length: pitsPerSide }, (_, index) => start + index);
}

function getGlobalPitIndex(seat: SeatId, localPit: number) {
  return seat === "seat1" ? localPit : pitsPerSide + localPit;
}

function getOppositePitIndex(index: number) {
  return totalPits - 1 - index;
}

function isOwnPit(seat: SeatId, index: number) {
  return seat === "seat1" ? index >= 0 && index < pitsPerSide : index >= pitsPerSide && index < totalPits;
}

function getNextPosition(position: SowPosition): SowPosition {
  if (position.type === "store") {
    return position.seat === "seat1" ? { type: "pit", index: pitsPerSide } : { type: "pit", index: 0 };
  }

  if (position.index < pitsPerSide - 1) {
    return { type: "pit", index: position.index + 1 };
  }

  if (position.index === pitsPerSide - 1) {
    return { type: "store", seat: "seat1" };
  }

  if (position.index < totalPits - 1) {
    return { type: "pit", index: position.index + 1 };
  }

  return { type: "store", seat: "seat2" };
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
