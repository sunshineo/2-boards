export type SeatId = "seat1" | "seat2";

export type BoardId = "A" | "B";

export type GameType = "tictactoe" | "connect4" | "chess";

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

export type MatchClockView = {
  config: {
    initialMs: number;
    incrementMs: number;
  };
  seats: Record<SeatId, { remainingMs: number; isRunning: boolean }>;
  runningSeats: SeatId[];
  updatedAtMs: number;
  serverNowMs: number;
  status: "active" | "expired";
  expiredSeats: SeatId[];
};

type BaseBoardView = {
  id: BoardId;
  firstSeat: SeatId;
  seatsToAct: SeatId[];
  outcome: BoardOutcome;
};

export type TicTacToeBoardView = BaseBoardView & {
  kind: "tictactoe";
  cells: (SeatId | null)[];
};

export type ConnectFourBoardView = BaseBoardView & {
  kind: "connect4";
  rows: number;
  columns: number;
  cells: (SeatId | null)[];
  playableColumns: number[];
};

export type ChessPiece = {
  color: "w" | "b";
  type: "p" | "n" | "b" | "r" | "q" | "k";
};

export type ChessSquareView = {
  square: string;
  piece: ChessPiece | null;
};

export type ChessMoveRecord = {
  seat: SeatId;
  color: "w" | "b";
  piece: ChessPiece["type"];
  from: string;
  to: string;
  san: string;
  lan: string;
  captured?: ChessPiece["type"];
  promotion?: "q" | "r" | "b" | "n";
};

export type ChessBoardView = BaseBoardView & {
  kind: "chess";
  fen: string;
  whiteSeat: SeatId;
  blackSeat: SeatId;
  squares: ChessSquareView[];
  moveHistory: ChessMoveRecord[];
};

export type MatchBoardView = TicTacToeBoardView | ConnectFourBoardView | ChessBoardView;

export type MovePayload =
  | { cell: number }
  | { column: number }
  | { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };

export type MatchView = {
  id: string;
  gameType: GameType;
  gameLabel: string;
  seats: SeatId[];
  players: Record<SeatId, { label: string; name: string }>;
  outcome: MatchOutcome;
  clock: MatchClockView | null;
  boards: MatchBoardView[];
};

export type SeatSession = {
  seat: SeatId | null;
  match: MatchView;
};
