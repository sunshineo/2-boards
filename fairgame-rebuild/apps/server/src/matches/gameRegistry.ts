import {
  applyMoveToMatch,
  chessRules,
  connectFourRules,
  createFairMatch,
  getChessSquares,
  ticTacToeRules,
  type ApplyMoveCommand,
  type ApplyMoveResult,
  type ChessMove,
  type ChessMoveRecord,
  type ChessState,
  type ChessSquareView,
  type ConnectFourMove,
  type ConnectFourState,
  type FairBoard,
  type FairMatch,
  type TicTacToeMove,
  type TicTacToeState
} from "@fairgame/domain";
import type { BoardId, BoardOutcome, SeatId } from "@fairgame/shared";

export type SupportedGameType = "tictactoe" | "connect4" | "chess";
export type SupportedGameState = TicTacToeState | ConnectFourState | ChessState;
export type SupportedGameMove = TicTacToeMove | ConnectFourMove | ChessMove;
export type SupportedFairMatch = FairMatch<SupportedGameState>;

export type TicTacToeBoardView = {
  readonly kind: "tictactoe";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly cells: readonly (SeatId | null)[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type ConnectFourBoardView = {
  readonly kind: "connect4";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly (SeatId | null)[];
  readonly playableColumns: readonly number[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type ChessBoardView = {
  readonly kind: "chess";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly fen: string;
  readonly whiteSeat: SeatId;
  readonly blackSeat: SeatId;
  readonly squares: readonly ChessSquareView[];
  readonly moveHistory: readonly ChessMoveRecord[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type MatchBoardView = TicTacToeBoardView | ConnectFourBoardView | ChessBoardView;

type SupportedGameDefinition<TState, TMove> = {
  readonly gameType: SupportedGameType;
  readonly label: string;
  createMatch(id: string): FairMatch<TState>;
  parseMove(move: unknown): TMove | null;
  getSeatsToAct(state: TState): readonly SeatId[];
  applyMove(match: FairMatch<TState>, command: ApplyMoveCommand<TMove>): ApplyMoveResult<TState>;
  toBoardView(board: FairBoard<TState>): MatchBoardView;
};

type AnySupportedGameDefinition = {
  readonly gameType: SupportedGameType;
  readonly label: string;
  createMatch(id: string): SupportedFairMatch;
  parseMove(move: unknown): SupportedGameMove | null;
  getSeatsToAct(state: SupportedGameState): readonly SeatId[];
  applyMove(match: SupportedFairMatch, command: ApplyMoveCommand<SupportedGameMove>): ApplyMoveResult<SupportedGameState>;
  toBoardView(board: FairBoard<SupportedGameState>): MatchBoardView;
};

const ticTacToeDefinition: SupportedGameDefinition<TicTacToeState, TicTacToeMove> = {
  gameType: "tictactoe",
  label: "TicTacToe",

  createMatch(id) {
    return createFairMatch({ id, rules: ticTacToeRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["cell"] !== "number") return null;
    return { cell: move["cell"] };
  },

  getSeatsToAct(state) {
    return ticTacToeRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, ticTacToeRules, command);
  },

  toBoardView(board) {
    return {
      kind: "tictactoe",
      id: board.id,
      firstSeat: board.firstSeat,
      cells: board.state.cells,
      seatsToAct: ticTacToeRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const connectFourDefinition: SupportedGameDefinition<ConnectFourState, ConnectFourMove> = {
  gameType: "connect4",
  label: "Connect Four",

  createMatch(id) {
    return createFairMatch({ id, rules: connectFourRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["column"] !== "number") return null;
    return { column: move["column"] };
  },

  getSeatsToAct(state) {
    return connectFourRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, connectFourRules, command);
  },

  toBoardView(board) {
    return {
      kind: "connect4",
      id: board.id,
      firstSeat: board.firstSeat,
      rows: board.state.rows,
      columns: board.state.columns,
      cells: board.state.cells,
      playableColumns: getPlayableColumns(board.state),
      seatsToAct: connectFourRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const chessDefinition: SupportedGameDefinition<ChessState, ChessMove> = {
  gameType: "chess",
  label: "Chess",

  createMatch(id) {
    return createFairMatch({ id, rules: chessRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["from"] !== "string" || typeof move["to"] !== "string") return null;
    const promotion = move["promotion"];
    if (promotion !== undefined && promotion !== "q" && promotion !== "r" && promotion !== "b" && promotion !== "n") {
      return null;
    }
    return promotion ? { from: move["from"], to: move["to"], promotion } : { from: move["from"], to: move["to"] };
  },

  getSeatsToAct(state) {
    return chessRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, chessRules, command);
  },

  toBoardView(board) {
    return {
      kind: "chess",
      id: board.id,
      firstSeat: board.firstSeat,
      fen: board.state.fen,
      whiteSeat: board.state.whiteSeat,
      blackSeat: board.state.blackSeat,
      squares: getChessSquares(board.state),
      moveHistory: board.state.moveHistory,
      seatsToAct: chessRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const supportedGames = {
  tictactoe: asAnyDefinition(ticTacToeDefinition),
  connect4: asAnyDefinition(connectFourDefinition),
  chess: asAnyDefinition(chessDefinition)
} as const satisfies Record<SupportedGameType, AnySupportedGameDefinition>;

export function getDefaultGameType(): SupportedGameType {
  return "tictactoe";
}

export function parseSupportedGameType(value: unknown): SupportedGameType | null {
  if (value === undefined || value === null || value === "") return getDefaultGameType();
  return value === "tictactoe" || value === "connect4" || value === "chess" ? value : null;
}

export function getGameDefinition(gameType: string): AnySupportedGameDefinition | null {
  return gameType === "tictactoe" || gameType === "connect4" || gameType === "chess" ? supportedGames[gameType] : null;
}

export function getActiveSeats(match: SupportedFairMatch): SeatId[] {
  const game = getGameDefinition(match.gameType);
  if (!game) return [];

  const activeSeats = new Set<SeatId>();
  for (const board of match.boards) {
    if (board.outcome.status !== "in_progress") continue;
    for (const seat of game.getSeatsToAct(board.state)) {
      activeSeats.add(seat);
    }
  }

  return match.seats.filter((seat) => activeSeats.has(seat));
}

export function applyTimeoutToMatch(match: SupportedFairMatch, expiredSeats: readonly SeatId[]): SupportedFairMatch {
  if (expiredSeats.length === 0) return match;

  const expiredSeatSet = new Set(expiredSeats);
  const nextBoards = match.boards.map((board) => {
    if (board.outcome.status !== "in_progress") return board;

    return {
      ...board,
      outcome: getTimeoutBoardOutcome(match.seats, expiredSeatSet)
    };
  }) as unknown as SupportedFairMatch["boards"];

  return {
    ...match,
    boards: nextBoards
  };
}

function getPlayableColumns(state: ConnectFourState): number[] {
  if (state.outcome.status !== "in_progress") return [];

  return Array.from({ length: state.columns }, (_, column) => column).filter(
    (column) => state.cells[column] === null
  );
}

function asAnyDefinition<TState extends SupportedGameState, TMove extends SupportedGameMove>(
  definition: SupportedGameDefinition<TState, TMove>
): AnySupportedGameDefinition {
  return {
    gameType: definition.gameType,
    label: definition.label,
    createMatch: (id) => definition.createMatch(id) as SupportedFairMatch,
    parseMove: (move) => definition.parseMove(move),
    getSeatsToAct: (state) => definition.getSeatsToAct(state as TState),
    applyMove: (match, command) =>
      definition.applyMove(match as FairMatch<TState>, command as ApplyMoveCommand<TMove>) as ApplyMoveResult<SupportedGameState>,
    toBoardView: (board) => definition.toBoardView(board as FairBoard<TState>)
  };
}

function getTimeoutBoardOutcome(seats: readonly [SeatId, SeatId], expiredSeatSet: ReadonlySet<SeatId>): BoardOutcome {
  if (expiredSeatSet.has("seat1") && expiredSeatSet.has("seat2")) {
    return { status: "draw", reason: "mutual-timeout" };
  }

  const loser = expiredSeatSet.has("seat1") ? seats[0] : seats[1];
  const winner = loser === seats[0] ? seats[1] : seats[0];
  return { status: "win", winner, loser, reason: "timeout" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
