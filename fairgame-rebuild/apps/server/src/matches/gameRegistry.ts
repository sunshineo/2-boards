import {
  applyMoveToMatch,
  connectFourRules,
  createFairMatch,
  ticTacToeRules,
  type ApplyMoveCommand,
  type ApplyMoveResult,
  type ConnectFourMove,
  type ConnectFourState,
  type FairBoard,
  type FairMatch,
  type TicTacToeMove,
  type TicTacToeState
} from "@fairgame/domain";
import type { BoardId, BoardOutcome, SeatId } from "@fairgame/shared";

export type SupportedGameType = "tictactoe" | "connect4";
export type SupportedGameState = TicTacToeState | ConnectFourState;
export type SupportedGameMove = TicTacToeMove | ConnectFourMove;
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

export type MatchBoardView = TicTacToeBoardView | ConnectFourBoardView;

type SupportedGameDefinition<TState, TMove> = {
  readonly gameType: SupportedGameType;
  readonly label: string;
  createMatch(id: string): FairMatch<TState>;
  parseMove(move: unknown): TMove | null;
  applyMove(match: FairMatch<TState>, command: ApplyMoveCommand<TMove>): ApplyMoveResult<TState>;
  toBoardView(board: FairBoard<TState>): MatchBoardView;
};

type AnySupportedGameDefinition = {
  readonly gameType: SupportedGameType;
  readonly label: string;
  createMatch(id: string): SupportedFairMatch;
  parseMove(move: unknown): SupportedGameMove | null;
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

const supportedGames = {
  tictactoe: asAnyDefinition(ticTacToeDefinition),
  connect4: asAnyDefinition(connectFourDefinition)
} as const satisfies Record<SupportedGameType, AnySupportedGameDefinition>;

export function getDefaultGameType(): SupportedGameType {
  return "tictactoe";
}

export function parseSupportedGameType(value: unknown): SupportedGameType | null {
  if (value === undefined || value === null || value === "") return getDefaultGameType();
  return value === "tictactoe" || value === "connect4" ? value : null;
}

export function getGameDefinition(gameType: string): AnySupportedGameDefinition | null {
  return gameType === "tictactoe" || gameType === "connect4" ? supportedGames[gameType] : null;
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
    applyMove: (match, command) =>
      definition.applyMove(match as FairMatch<TState>, command as ApplyMoveCommand<TMove>) as ApplyMoveResult<SupportedGameState>,
    toBoardView: (board) => definition.toBoardView(board as FairBoard<TState>)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
