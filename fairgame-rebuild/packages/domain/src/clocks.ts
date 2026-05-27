import type { SeatId } from "@fairgame/shared";

export type ClockConfig = {
  readonly initialMs: number;
  readonly incrementMs: number;
};

export type MatchClockStatus = "active" | "expired";

export type SeatClockView = {
  readonly remainingMs: number;
  readonly isRunning: boolean;
};

export type MatchClock = {
  readonly config: ClockConfig;
  readonly remainingMs: Readonly<Record<SeatId, number>>;
  readonly runningSeats: readonly SeatId[];
  readonly updatedAtMs: number;
  readonly status: MatchClockStatus;
  readonly expiredSeats: readonly SeatId[];
};

export type MatchClockView = {
  readonly config: ClockConfig;
  readonly seats: Readonly<Record<SeatId, SeatClockView>>;
  readonly runningSeats: readonly SeatId[];
  readonly updatedAtMs: number;
  readonly serverNowMs: number;
  readonly status: MatchClockStatus;
  readonly expiredSeats: readonly SeatId[];
};

export type AdvanceClockResult = {
  readonly clock: MatchClock;
  readonly expiredSeats: readonly SeatId[];
};

const seats = ["seat1", "seat2"] as const;

export function createMatchClock(config: ClockConfig, nowMs: number): MatchClock {
  return {
    config: normalizeClockConfig(config),
    remainingMs: {
      seat1: config.initialMs,
      seat2: config.initialMs
    },
    runningSeats: [],
    updatedAtMs: nowMs,
    status: "active",
    expiredSeats: []
  };
}

export function setClockRunningSeats(clock: MatchClock, runningSeats: readonly SeatId[], nowMs: number): MatchClock {
  if (clock.status === "expired") return clock;

  return {
    ...clock,
    runningSeats: uniqueSeats(runningSeats),
    updatedAtMs: nowMs
  };
}

export function advanceMatchClock(clock: MatchClock, nowMs: number): AdvanceClockResult {
  if (clock.status === "expired") {
    return { clock, expiredSeats: clock.expiredSeats };
  }

  const elapsedMs = Math.max(0, nowMs - clock.updatedAtMs);
  const runningSeats = uniqueSeats(clock.runningSeats);
  const remainingMs = { ...clock.remainingMs };

  for (const seat of runningSeats) {
    remainingMs[seat] = Math.max(0, remainingMs[seat] - elapsedMs);
  }

  const expiredSeats = runningSeats.filter((seat) => remainingMs[seat] === 0);
  const nextClock: MatchClock = {
    ...clock,
    remainingMs,
    runningSeats: expiredSeats.length > 0 ? [] : runningSeats,
    updatedAtMs: nowMs,
    status: expiredSeats.length > 0 ? "expired" : "active",
    expiredSeats
  };

  return { clock: nextClock, expiredSeats };
}

export function completeClockMove(
  clock: MatchClock,
  movingSeat: SeatId,
  nextRunningSeats: readonly SeatId[],
  nowMs: number
): MatchClock {
  if (clock.status === "expired") return clock;

  return {
    ...clock,
    remainingMs: {
      ...clock.remainingMs,
      [movingSeat]: clock.remainingMs[movingSeat] + clock.config.incrementMs
    },
    runningSeats: uniqueSeats(nextRunningSeats),
    updatedAtMs: nowMs
  };
}

export function toClockView(clock: MatchClock, nowMs: number): MatchClockView {
  const advanced = advanceMatchClock(clock, nowMs).clock;
  const runningSeatSet = new Set(advanced.runningSeats);

  return {
    config: advanced.config,
    seats: {
      seat1: {
        remainingMs: advanced.remainingMs.seat1,
        isRunning: runningSeatSet.has("seat1")
      },
      seat2: {
        remainingMs: advanced.remainingMs.seat2,
        isRunning: runningSeatSet.has("seat2")
      }
    },
    runningSeats: advanced.runningSeats,
    updatedAtMs: advanced.updatedAtMs,
    serverNowMs: nowMs,
    status: advanced.status,
    expiredSeats: advanced.expiredSeats
  };
}

function normalizeClockConfig(config: ClockConfig): ClockConfig {
  return {
    initialMs: Math.max(0, config.initialMs),
    incrementMs: Math.max(0, config.incrementMs)
  };
}

function uniqueSeats(input: readonly SeatId[]): SeatId[] {
  return seats.filter((seat) => input.includes(seat));
}
