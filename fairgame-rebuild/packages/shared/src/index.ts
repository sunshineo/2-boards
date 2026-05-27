export const projectName = "FairGame";

export type SeatId = "seat1" | "seat2";

export type BoardId = "A" | "B";

export type BoardOutcome =
  | { status: "in_progress" }
  | { status: "draw"; reason: string }
  | { status: "win"; winner: SeatId; loser: SeatId; reason: string }
  | { status: "canceled"; reason: string };
