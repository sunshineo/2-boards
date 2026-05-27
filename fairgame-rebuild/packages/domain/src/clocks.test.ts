import { describe, expect, it } from "vitest";

import {
  advanceMatchClock,
  completeClockMove,
  createMatchClock,
  setClockRunningSeats,
  toClockView
} from "./clocks";

const config = { initialMs: 1_000, incrementMs: 100 };

describe("match clocks", () => {
  it("does not spend time when no seats are running", () => {
    const clock = setClockRunningSeats(createMatchClock(config, 0), [], 0);
    const result = advanceMatchClock(clock, 500);

    expect(result.expiredSeats).toEqual([]);
    expect(result.clock.remainingMs).toEqual({ seat1: 1_000, seat2: 1_000 });
    expect(result.clock.runningSeats).toEqual([]);
    expect(result.clock.updatedAtMs).toBe(500);
  });

  it("spends time for one running seat only", () => {
    const clock = setClockRunningSeats(createMatchClock(config, 0), ["seat1"], 0);
    const view = toClockView(clock, 250);

    expect(view.seats.seat1).toEqual({ remainingMs: 750, isRunning: true });
    expect(view.seats.seat2).toEqual({ remainingMs: 1_000, isRunning: false });
  });

  it("spends time for both running seats when both players are to move", () => {
    const clock = setClockRunningSeats(createMatchClock(config, 0), ["seat1", "seat2"], 0);
    const result = advanceMatchClock(clock, 400);

    expect(result.expiredSeats).toEqual([]);
    expect(result.clock.remainingMs).toEqual({ seat1: 600, seat2: 600 });
    expect(result.clock.runningSeats).toEqual(["seat1", "seat2"]);
  });

  it("adds increment to the moving seat and switches running seats", () => {
    const clock = setClockRunningSeats(createMatchClock(config, 0), ["seat1"], 0);
    const advanced = advanceMatchClock(clock, 300);
    const moved = completeClockMove(advanced.clock, "seat1", ["seat2"], 300);

    expect(moved.remainingMs).toEqual({ seat1: 800, seat2: 1_000 });
    expect(moved.runningSeats).toEqual(["seat2"]);
    expect(moved.updatedAtMs).toBe(300);
  });

  it("expires one running seat when its remaining time reaches zero", () => {
    const clock = setClockRunningSeats(createMatchClock(config, 0), ["seat2"], 0);
    const result = advanceMatchClock(clock, 1_200);

    expect(result.expiredSeats).toEqual(["seat2"]);
    expect(result.clock.remainingMs).toEqual({ seat1: 1_000, seat2: 0 });
    expect(result.clock.runningSeats).toEqual([]);
    expect(result.clock.status).toBe("expired");
  });

  it("expires both running seats when both clocks reach zero together", () => {
    const clock = setClockRunningSeats(createMatchClock(config, 0), ["seat1", "seat2"], 0);
    const result = advanceMatchClock(clock, 1_200);

    expect(result.expiredSeats).toEqual(["seat1", "seat2"]);
    expect(result.clock.remainingMs).toEqual({ seat1: 0, seat2: 0 });
    expect(result.clock.runningSeats).toEqual([]);
  });
});
