export type SeatId = "seat1" | "seat2";

export type BoardId = "A" | "B";

export type BoardOutcome =
  | { status: "in_progress" }
  | { status: "draw"; reason: string }
  | { status: "win"; winner: SeatId; loser: SeatId; reason: string }
  | { status: "canceled"; reason: string };

export type MatchScore = Record<SeatId, number>;

export type MatchOutcome =
  | { status: "in_progress"; score: MatchScore }
  | { status: "completed"; score: MatchScore; winner: SeatId | null }
  | { status: "canceled"; reason: string };

export type TicTacToeBoardView = {
  id: BoardId;
  firstSeat: SeatId;
  cells: (SeatId | null)[];
  seatsToAct: SeatId[];
  outcome: BoardOutcome;
};

export type MatchView = {
  id: string;
  gameType: "tictactoe";
  seats: SeatId[];
  outcome: MatchOutcome;
  boards: TicTacToeBoardView[];
};

export type SeatSession = {
  seat: SeatId | null;
  match: MatchView;
};
