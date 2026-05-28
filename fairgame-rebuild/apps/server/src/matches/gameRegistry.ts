import {
  applyMoveToMatch,
  breakthroughRules,
  chessRules,
  connectFourRules,
  createFairMatch,
  dotsBoxesRules,
  getChessSquares,
  gomokuRules,
  hexRules,
  mancalaRules,
  orderChaosRules,
  reversiRules,
  ticTacToeRules,
  type ApplyMoveCommand,
  type ApplyMoveResult,
  type BreakthroughMove,
  type BreakthroughState,
  type ChessMove,
  type ChessMoveRecord,
  type ChessState,
  type ChessSquareView,
  type ConnectFourMove,
  type ConnectFourState,
  type DotsBoxesMove,
  type DotsBoxesState,
  type FairBoard,
  type FairMatch,
  type GomokuMove,
  type GomokuState,
  type HexMove,
  type HexState,
  type MancalaMove,
  type MancalaState,
  type OrderChaosMove,
  type OrderChaosState,
  type ReversiMove,
  type ReversiState,
  type TicTacToeMove,
  type TicTacToeState
} from "@fairgame/domain";
import type { BoardId, BoardOutcome, SeatId } from "@fairgame/shared";

export type SupportedGameType =
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
export type SupportedGameState =
  | TicTacToeState
  | ConnectFourState
  | ChessState
  | GomokuState
  | HexState
  | ReversiState
  | BreakthroughState
  | MancalaState
  | DotsBoxesState
  | OrderChaosState;
export type SupportedGameMove =
  | TicTacToeMove
  | ConnectFourMove
  | ChessMove
  | GomokuMove
  | HexMove
  | ReversiMove
  | BreakthroughMove
  | MancalaMove
  | DotsBoxesMove
  | OrderChaosMove;
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

export type GomokuBoardView = {
  readonly kind: "gomoku";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly (SeatId | null)[];
  readonly playableCells: readonly number[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type HexBoardView = {
  readonly kind: "hex";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly size: number;
  readonly cells: readonly (SeatId | null)[];
  readonly playableCells: readonly number[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type ReversiBoardView = {
  readonly kind: "reversi";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly (SeatId | null)[];
  readonly playableCells: readonly number[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type BreakthroughBoardView = {
  readonly kind: "breakthrough";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly (SeatId | null)[];
  readonly playableMoves: readonly BreakthroughMove[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type MancalaBoardView = {
  readonly kind: "mancala";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly pitsPerSide: number;
  readonly stonesPerPit: number;
  readonly pits: readonly number[];
  readonly stores: Readonly<Record<SeatId, number>>;
  readonly playablePits: readonly number[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type DotsBoxesBoardView = {
  readonly kind: "dots-boxes";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly boxRows: number;
  readonly boxColumns: number;
  readonly drawnEdges: readonly string[];
  readonly boxes: readonly (SeatId | null)[];
  readonly scores: Readonly<Record<SeatId, number>>;
  readonly playableEdges: readonly string[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type OrderChaosBoardView = {
  readonly kind: "order-chaos";
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly ("X" | "O" | null)[];
  readonly orderSeat: SeatId;
  readonly chaosSeat: SeatId;
  readonly playableCells: readonly number[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
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

const gomokuDefinition: SupportedGameDefinition<GomokuState, GomokuMove> = {
  gameType: "gomoku",
  label: "Gomoku",

  createMatch(id) {
    return createFairMatch({ id, rules: gomokuRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["cell"] !== "number") return null;
    return { cell: move["cell"] };
  },

  getSeatsToAct(state) {
    return gomokuRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, gomokuRules, command);
  },

  toBoardView(board) {
    return {
      kind: "gomoku",
      id: board.id,
      firstSeat: board.firstSeat,
      rows: board.state.rows,
      columns: board.state.columns,
      cells: board.state.cells,
      playableCells: getEmptyCellIndexes(board.state.cells, board.state.outcome),
      seatsToAct: gomokuRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const hexDefinition: SupportedGameDefinition<HexState, HexMove> = {
  gameType: "hex",
  label: "Hex",

  createMatch(id) {
    return createFairMatch({ id, rules: hexRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["cell"] !== "number") return null;
    return { cell: move["cell"] };
  },

  getSeatsToAct(state) {
    return hexRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, hexRules, command);
  },

  toBoardView(board) {
    return {
      kind: "hex",
      id: board.id,
      firstSeat: board.firstSeat,
      size: board.state.size,
      cells: board.state.cells,
      playableCells: getEmptyCellIndexes(board.state.cells, board.state.outcome),
      seatsToAct: hexRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const reversiDefinition: SupportedGameDefinition<ReversiState, ReversiMove> = {
  gameType: "reversi",
  label: "Reversi",

  createMatch(id) {
    return createFairMatch({ id, rules: reversiRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["cell"] !== "number") return null;
    return { cell: move["cell"] };
  },

  getSeatsToAct(state) {
    return reversiRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, reversiRules, command);
  },

  toBoardView(board) {
    return {
      kind: "reversi",
      id: board.id,
      firstSeat: board.firstSeat,
      rows: board.state.rows,
      columns: board.state.columns,
      cells: board.state.cells,
      playableCells: getPlayableReversiCells(board.state),
      seatsToAct: reversiRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const breakthroughDefinition: SupportedGameDefinition<BreakthroughState, BreakthroughMove> = {
  gameType: "breakthrough",
  label: "Breakthrough",

  createMatch(id) {
    return createFairMatch({ id, rules: breakthroughRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["from"] !== "number" || typeof move["to"] !== "number") return null;
    return { from: move["from"], to: move["to"] };
  },

  getSeatsToAct(state) {
    return breakthroughRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, breakthroughRules, command);
  },

  toBoardView(board) {
    return {
      kind: "breakthrough",
      id: board.id,
      firstSeat: board.firstSeat,
      rows: board.state.rows,
      columns: board.state.columns,
      cells: board.state.cells,
      playableMoves: getPlayableBreakthroughMoves(board.state),
      seatsToAct: breakthroughRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const mancalaDefinition: SupportedGameDefinition<MancalaState, MancalaMove> = {
  gameType: "mancala",
  label: "Mancala",

  createMatch(id) {
    return createFairMatch({ id, rules: mancalaRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["pit"] !== "number") return null;
    return { pit: move["pit"] };
  },

  getSeatsToAct(state) {
    return mancalaRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, mancalaRules, command);
  },

  toBoardView(board) {
    return {
      kind: "mancala",
      id: board.id,
      firstSeat: board.firstSeat,
      pitsPerSide: board.state.pitsPerSide,
      stonesPerPit: board.state.stonesPerPit,
      pits: board.state.pits,
      stores: board.state.stores,
      playablePits: getPlayableMancalaPits(board.state),
      seatsToAct: mancalaRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const dotsBoxesDefinition: SupportedGameDefinition<DotsBoxesState, DotsBoxesMove> = {
  gameType: "dots-boxes",
  label: "Dots and Boxes",

  createMatch(id) {
    return createFairMatch({ id, rules: dotsBoxesRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["edge"] !== "string") return null;
    return { edge: move["edge"] };
  },

  getSeatsToAct(state) {
    return dotsBoxesRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, dotsBoxesRules, command);
  },

  toBoardView(board) {
    return {
      kind: "dots-boxes",
      id: board.id,
      firstSeat: board.firstSeat,
      boxRows: board.state.boxRows,
      boxColumns: board.state.boxColumns,
      drawnEdges: board.state.drawnEdges,
      boxes: board.state.boxes,
      scores: board.state.scores,
      playableEdges: getPlayableDotsBoxesEdges(board.state),
      seatsToAct: dotsBoxesRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const orderChaosDefinition: SupportedGameDefinition<OrderChaosState, OrderChaosMove> = {
  gameType: "order-chaos",
  label: "Order and Chaos",

  createMatch(id) {
    return createFairMatch({ id, rules: orderChaosRules });
  },

  parseMove(move) {
    if (!isRecord(move) || typeof move["cell"] !== "number") return null;
    const mark = move["mark"];
    if (mark !== "X" && mark !== "O") return null;
    return { cell: move["cell"], mark };
  },

  getSeatsToAct(state) {
    return orderChaosRules.getSeatsToAct(state);
  },

  applyMove(match, command) {
    return applyMoveToMatch(match, orderChaosRules, command);
  },

  toBoardView(board) {
    return {
      kind: "order-chaos",
      id: board.id,
      firstSeat: board.firstSeat,
      rows: board.state.rows,
      columns: board.state.columns,
      cells: board.state.cells,
      orderSeat: board.state.orderSeat,
      chaosSeat: board.state.chaosSeat,
      playableCells: getEmptyCellIndexes(board.state.cells, board.state.outcome),
      seatsToAct: orderChaosRules.getSeatsToAct(board.state),
      outcome: board.outcome
    };
  }
};

const supportedGames = {
  tictactoe: asAnyDefinition(ticTacToeDefinition),
  connect4: asAnyDefinition(connectFourDefinition),
  chess: asAnyDefinition(chessDefinition),
  gomoku: asAnyDefinition(gomokuDefinition),
  hex: asAnyDefinition(hexDefinition),
  reversi: asAnyDefinition(reversiDefinition),
  breakthrough: asAnyDefinition(breakthroughDefinition),
  mancala: asAnyDefinition(mancalaDefinition),
  "dots-boxes": asAnyDefinition(dotsBoxesDefinition),
  "order-chaos": asAnyDefinition(orderChaosDefinition)
} as const satisfies Record<SupportedGameType, AnySupportedGameDefinition>;

export function getDefaultGameType(): SupportedGameType {
  return "tictactoe";
}

export function parseSupportedGameType(value: unknown): SupportedGameType | null {
  if (value === undefined || value === null || value === "") return getDefaultGameType();
  return isSupportedGameType(value) ? value : null;
}

export function getGameDefinition(gameType: string): AnySupportedGameDefinition | null {
  return isSupportedGameType(gameType) ? supportedGames[gameType] : null;
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

function getEmptyCellIndexes(cells: readonly unknown[], outcome: BoardOutcome): number[] {
  if (outcome.status !== "in_progress") return [];
  return cells.flatMap((cell, index) => (cell === null ? [index] : []));
}

function getPlayableReversiCells(state: ReversiState): number[] {
  const [seat] = reversiRules.getSeatsToAct(state);
  if (!seat) return [];

  return state.cells.flatMap((cell, index) =>
    cell === null && reversiRules.validateMove({ state, seat, move: { cell: index } }).ok ? [index] : []
  );
}

function getPlayableBreakthroughMoves(state: BreakthroughState): BreakthroughMove[] {
  const [seat] = breakthroughRules.getSeatsToAct(state);
  if (!seat) return [];

  const moves: BreakthroughMove[] = [];
  for (let from = 0; from < state.cells.length; from += 1) {
    if (state.cells[from] !== seat) continue;

    const row = Math.floor(from / state.columns);
    const column = from % state.columns;
    for (const rowDelta of [-1, 1]) {
      for (const columnDelta of [-1, 0, 1]) {
        const nextRow = row + rowDelta;
        const nextColumn = column + columnDelta;
        if (nextRow < 0 || nextRow >= state.rows || nextColumn < 0 || nextColumn >= state.columns) continue;
        const to = nextRow * state.columns + nextColumn;
        const move = { from, to };
        if (breakthroughRules.validateMove({ state, seat, move }).ok) {
          moves.push(move);
        }
      }
    }
  }

  return moves;
}

function getPlayableMancalaPits(state: MancalaState): number[] {
  const [seat] = mancalaRules.getSeatsToAct(state);
  if (!seat) return [];

  return Array.from({ length: state.pitsPerSide }, (_, pit) => pit).filter((pit) =>
    mancalaRules.validateMove({ state, seat, move: { pit } }).ok
  );
}

function getPlayableDotsBoxesEdges(state: DotsBoxesState): string[] {
  const [seat] = dotsBoxesRules.getSeatsToAct(state);
  if (!seat) return [];

  const edges: string[] = [];
  for (let row = 0; row <= state.boxRows; row += 1) {
    for (let column = 0; column < state.boxColumns; column += 1) {
      const edge = `h-${row}-${column}`;
      if (dotsBoxesRules.validateMove({ state, seat, move: { edge } }).ok) edges.push(edge);
    }
  }

  for (let row = 0; row < state.boxRows; row += 1) {
    for (let column = 0; column <= state.boxColumns; column += 1) {
      const edge = `v-${row}-${column}`;
      if (dotsBoxesRules.validateMove({ state, seat, move: { edge } }).ok) edges.push(edge);
    }
  }

  return edges;
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

function isSupportedGameType(value: unknown): value is SupportedGameType {
  return typeof value === "string" && value in supportedGames;
}
