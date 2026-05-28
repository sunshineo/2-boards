export type SeatId = "seat1" | "seat2";

export type BoardId = "A" | "B";

export type GameType =
  | "tictactoe"
  | "connect4"
  | "chess"
  | "gomoku"
  | "hex"
  | "reversi"
  | "breakthrough"
  | "mancala"
  | "dots-boxes"
  | "order-chaos";

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

export type GomokuBoardView = BaseBoardView & {
  kind: "gomoku";
  rows: number;
  columns: number;
  cells: (SeatId | null)[];
  playableCells: number[];
};

export type HexBoardView = BaseBoardView & {
  kind: "hex";
  size: number;
  cells: (SeatId | null)[];
  playableCells: number[];
};

export type ReversiBoardView = BaseBoardView & {
  kind: "reversi";
  rows: number;
  columns: number;
  cells: (SeatId | null)[];
  playableCells: number[];
};

export type BreakthroughBoardView = BaseBoardView & {
  kind: "breakthrough";
  rows: number;
  columns: number;
  cells: (SeatId | null)[];
  playableMoves: { from: number; to: number }[];
};

export type MancalaBoardView = BaseBoardView & {
  kind: "mancala";
  pitsPerSide: number;
  stonesPerPit: number;
  pits: number[];
  stores: Record<SeatId, number>;
  playablePits: number[];
};

export type DotsBoxesBoardView = BaseBoardView & {
  kind: "dots-boxes";
  boxRows: number;
  boxColumns: number;
  drawnEdges: string[];
  boxes: (SeatId | null)[];
  scores: Record<SeatId, number>;
  playableEdges: string[];
};

export type OrderChaosBoardView = BaseBoardView & {
  kind: "order-chaos";
  rows: number;
  columns: number;
  cells: ("X" | "O" | null)[];
  orderSeat: SeatId;
  chaosSeat: SeatId;
  playableCells: number[];
};

export type MatchBoardView =
  | TicTacToeBoardView
  | ConnectFourBoardView
  | ChessBoardView
  | GomokuBoardView
  | HexBoardView
  | ReversiBoardView
  | BreakthroughBoardView
  | MancalaBoardView
  | DotsBoxesBoardView
  | OrderChaosBoardView;

export type MovePayload =
  | { cell: number }
  | { column: number }
  | { from: string; to: string; promotion?: "q" | "r" | "b" | "n" }
  | { from: number; to: number }
  | { pit: number }
  | { edge: string }
  | { cell: number; mark: "X" | "O" };

export type MatchView = {
  id: string;
  gameType: GameType;
  gameLabel: string;
  seats: SeatId[];
  joinedSeats: number;
  maxSeats: number;
  players: Record<SeatId, { label: string; name: string }>;
  outcome: MatchOutcome;
  clock: MatchClockView | null;
  boards: MatchBoardView[];
};

export type OpenMatchView = {
  id: string;
  gameType: GameType;
  gameLabel: string;
  clockInitialMs: number | null;
  clockIncrementMs: number | null;
  joinedSeats: number;
  maxSeats: number;
  updatedAtMs: number;
};

export type SeatSession = {
  seat: SeatId | null;
  match: MatchView;
};
