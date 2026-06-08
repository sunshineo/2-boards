import { describe, expect, it } from "vitest";

import type {
  BreakthroughBoardView,
  ConnectFourBoardView,
  DotsBoxesBoardView,
  GomokuBoardView,
  HexBoardView,
  MancalaBoardView,
  OrderChaosBoardView,
  ReversiBoardView,
  TicTacToeBoardView
} from "../../types";
import { chooseBreakthroughRandomMove } from "./breakthroughRandom";
import { chooseConnectFourRandomMove } from "./connectFourRandom";
import { chooseDotsBoxesRandomMove } from "./dotsBoxesRandom";
import { chooseGomokuRandomMove } from "./gomokuRandom";
import { chooseHexRandomMove } from "./hexRandom";
import { chooseMancalaRandomMove } from "./mancalaRandom";
import { chooseOrderChaosRandomMove } from "./orderChaosRandom";
import { chooseReversiRandomMove } from "./reversiRandom";
import { chooseTicTacToeRandomMove } from "./tictactoeRandom";

describe("random legal game bots", () => {
  it("chooses TicTacToe empty cells", () => {
    const board = baseBoard("tictactoe", { cells: ["seat1", null, "seat2", null] }) as TicTacToeBoardView;

    expect(chooseTicTacToeRandomMove({ board, seat: "seat2" }, () => 0.99)).toEqual({ cell: 3 });
  });

  it("chooses Connect Four playable columns", () => {
    const board = baseBoard("connect4", {
      rows: 6,
      columns: 7,
      cells: Array(42).fill(null),
      playableColumns: [2, 4]
    }) as ConnectFourBoardView;

    expect(chooseConnectFourRandomMove({ board, seat: "seat2" }, () => 0.99)).toEqual({ column: 4 });
  });

  it("chooses Gomoku playable cells", () => {
    const board = baseBoard("gomoku", {
      rows: 15,
      columns: 15,
      cells: Array(225).fill(null),
      playableCells: [10, 22]
    }) as GomokuBoardView;

    expect(chooseGomokuRandomMove({ board, seat: "seat2" }, () => 0)).toEqual({ cell: 10 });
  });

  it("chooses Hex playable cells", () => {
    const board = baseBoard("hex", {
      size: 11,
      cells: Array(121).fill(null),
      playableCells: [11, 44]
    }) as HexBoardView;

    expect(chooseHexRandomMove({ board, seat: "seat2" }, () => 0.99)).toEqual({ cell: 44 });
  });

  it("chooses Reversi playable cells", () => {
    const board = baseBoard("reversi", {
      rows: 8,
      columns: 8,
      cells: Array(64).fill(null),
      playableCells: [20, 29]
    }) as ReversiBoardView;

    expect(chooseReversiRandomMove({ board, seat: "seat2" }, () => 0)).toEqual({ cell: 20 });
  });

  it("chooses Breakthrough playable moves", () => {
    const board = baseBoard("breakthrough", {
      rows: 8,
      columns: 8,
      cells: Array(64).fill(null),
      playableMoves: [
        { from: 8, to: 16 },
        { from: 9, to: 17 }
      ]
    }) as BreakthroughBoardView;

    expect(chooseBreakthroughRandomMove({ board, seat: "seat2" }, () => 0.99)).toEqual({ from: 9, to: 17 });
  });

  it("chooses Mancala playable pits", () => {
    const board = baseBoard("mancala", {
      pitsPerSide: 6,
      stonesPerPit: 4,
      pits: Array(12).fill(4),
      stores: { seat1: 0, seat2: 0 },
      playablePits: [3, 5]
    }) as MancalaBoardView;

    expect(chooseMancalaRandomMove({ board, seat: "seat2" }, () => 0)).toEqual({ pit: 3 });
  });

  it("chooses Dots and Boxes playable edges", () => {
    const board = baseBoard("dots-boxes", {
      boxRows: 3,
      boxColumns: 3,
      drawnEdges: [],
      boxes: Array(9).fill(null),
      scores: { seat1: 0, seat2: 0 },
      playableEdges: ["h-0-0", "v-0-0"]
    }) as DotsBoxesBoardView;

    expect(chooseDotsBoxesRandomMove({ board, seat: "seat2" }, () => 0.99)).toEqual({ edge: "v-0-0" });
  });

  it("chooses Order and Chaos playable cells and a random mark", () => {
    const board = baseBoard("order-chaos", {
      rows: 6,
      columns: 6,
      cells: Array(36).fill(null),
      orderSeat: "seat1",
      chaosSeat: "seat2",
      playableCells: [5, 7]
    }) as OrderChaosBoardView;

    expect(chooseOrderChaosRandomMove({ board, seat: "seat2" }, () => 0.99)).toEqual({ cell: 7, mark: "O" });
  });

  it("returns null when no legal move exists", () => {
    expect(
      chooseTicTacToeRandomMove({ board: baseBoard("tictactoe", { cells: ["seat1"] }) as TicTacToeBoardView, seat: "seat2" })
    ).toBeNull();
    expect(
      chooseConnectFourRandomMove({
        board: baseBoard("connect4", {
          rows: 6,
          columns: 7,
          cells: Array(42).fill(null),
          playableColumns: []
        }) as ConnectFourBoardView,
        seat: "seat2"
      })
    ).toBeNull();
    expect(
      chooseGomokuRandomMove({
        board: baseBoard("gomoku", { rows: 15, columns: 15, cells: [], playableCells: [] }) as GomokuBoardView,
        seat: "seat2"
      })
    ).toBeNull();
    expect(
      chooseHexRandomMove({
        board: baseBoard("hex", { size: 11, cells: [], playableCells: [] }) as HexBoardView,
        seat: "seat2"
      })
    ).toBeNull();
    expect(
      chooseReversiRandomMove({
        board: baseBoard("reversi", { rows: 8, columns: 8, cells: [], playableCells: [] }) as ReversiBoardView,
        seat: "seat2"
      })
    ).toBeNull();
    expect(
      chooseBreakthroughRandomMove({
        board: baseBoard("breakthrough", { rows: 8, columns: 8, cells: [], playableMoves: [] }) as BreakthroughBoardView,
        seat: "seat2"
      })
    ).toBeNull();
    expect(
      chooseMancalaRandomMove({
        board: baseBoard("mancala", {
          pitsPerSide: 6,
          stonesPerPit: 4,
          pits: [],
          stores: { seat1: 0, seat2: 0 },
          playablePits: []
        }) as MancalaBoardView,
        seat: "seat2"
      })
    ).toBeNull();
    expect(
      chooseDotsBoxesRandomMove({
        board: baseBoard("dots-boxes", {
          boxRows: 3,
          boxColumns: 3,
          drawnEdges: [],
          boxes: [],
          scores: { seat1: 0, seat2: 0 },
          playableEdges: []
        }) as DotsBoxesBoardView,
        seat: "seat2"
      })
    ).toBeNull();
    expect(
      chooseOrderChaosRandomMove({
        board: baseBoard("order-chaos", {
          rows: 6,
          columns: 6,
          cells: [],
          orderSeat: "seat1",
          chaosSeat: "seat2",
          playableCells: []
        }) as OrderChaosBoardView,
        seat: "seat2"
      })
    ).toBeNull();
  });
});

function baseBoard(kind: string, extra: object) {
  return {
    kind,
    id: "A",
    firstSeat: "seat1",
    seatsToAct: ["seat2"],
    outcome: { status: "in_progress" },
    ...extra
  };
}
