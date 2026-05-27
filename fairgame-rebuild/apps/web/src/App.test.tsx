import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("App", () => {
  it("renders create and join controls before a match is loaded", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Two-board fair games" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "TicTacToe" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Connect Four" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Chess" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toHaveValue("Player 1");
    expect(screen.getByLabelText("Join as")).toHaveValue("Player 2");
    expect(screen.getByRole("button", { name: "Create TicTacToe match" })).toBeInTheDocument();
    expect(screen.getByLabelText("Match code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join match" })).toBeDisabled();
  });

  it("renders the two boards after creating a match", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        seat: "seat1",
        match: {
          id: "match-1",
          gameType: "tictactoe",
          gameLabel: "TicTacToe",
          seats: ["seat1", "seat2"],
          players: createPlayersMock(),
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          clock: createClockMock(),
          boards: [
            {
              kind: "tictactoe",
              id: "A",
              firstSeat: "seat1",
              cells: Array(9).fill(null),
              seatsToAct: ["seat1"],
              outcome: { status: "in_progress" }
            },
            {
              kind: "tictactoe",
              id: "B",
              firstSeat: "seat2",
              cells: Array(9).fill(null),
              seatsToAct: ["seat2"],
              outcome: { status: "in_progress" }
            }
          ]
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    screen.getByRole("button", { name: "Create TicTacToe match" }).click();

    expect(await screen.findByText("match-1")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Board A" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Board B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board A cell 1" })).toBeEnabled();
    expect(screen.getByLabelText("Player 1 clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("Player 2 clock")).toHaveTextContent("5:00");
    expect(screen.getByRole("button", { name: "Copy invite" })).toBeInTheDocument();
    expect(screen.getByText("Your move")).toBeInTheDocument();

  });

  it("creates and renders a Connect Four match from the game selector", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        seat: "seat1",
        match: {
          id: "match-2",
          gameType: "connect4",
          gameLabel: "Connect Four",
          seats: ["seat1", "seat2"],
          players: createPlayersMock(),
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          clock: createClockMock(),
          boards: [
            {
              kind: "connect4",
              id: "A",
              firstSeat: "seat1",
              rows: 6,
              columns: 7,
              cells: Array(42).fill(null),
              playableColumns: [0, 1, 2, 3, 4, 5, 6],
              seatsToAct: ["seat1"],
              outcome: { status: "in_progress" }
            },
            {
              kind: "connect4",
              id: "B",
              firstSeat: "seat2",
              rows: 6,
              columns: 7,
              cells: Array(42).fill(null),
              playableColumns: [0, 1, 2, 3, 4, 5, 6],
              seatsToAct: ["seat2"],
              outcome: { status: "in_progress" }
            }
          ]
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    screen.getByRole("radio", { name: "Connect Four" }).click();
    screen.getByRole("button", { name: "Create Connect Four match" }).click();

    expect(await screen.findByText("match-2")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ gameType: "connect4", playerName: "Player 1" })
      })
    );
    expect(screen.getByRole("button", { name: "Board A column 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board B column 1" })).toBeDisabled();
  });

  it("creates and renders a Chess match from the game selector", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        seat: "seat1",
        match: {
          id: "match-3",
          gameType: "chess",
          gameLabel: "Chess",
          seats: ["seat1", "seat2"],
          players: createPlayersMock(),
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          clock: createClockMock(),
          boards: [
            {
              kind: "chess",
              id: "A",
              firstSeat: "seat1",
              fen: "start",
              whiteSeat: "seat1",
              blackSeat: "seat2",
              squares: createChessSquares(),
              moveHistory: [],
              seatsToAct: ["seat1"],
              outcome: { status: "in_progress" }
            },
            {
              kind: "chess",
              id: "B",
              firstSeat: "seat2",
              fen: "start",
              whiteSeat: "seat2",
              blackSeat: "seat1",
              squares: createChessSquares(),
              moveHistory: [],
              seatsToAct: ["seat2"],
              outcome: { status: "in_progress" }
            }
          ]
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    screen.getByRole("radio", { name: "Chess" }).click();
    screen.getByRole("button", { name: "Create Chess match" }).click();

    expect(await screen.findByText("match-3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board A square e2 white pawn" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board B square e2 white pawn" })).toBeDisabled();
    expect(screen.getAllByText("No moves")).toHaveLength(2);
  });

  it("renders recent match history from local storage", () => {
    localStorage.setItem(
      "fairgame.recentMatches",
      JSON.stringify([{ id: "match-old", gameLabel: "Chess", result: "In progress" }])
    );

    render(<App />);

    expect(screen.getByText("Recent matches")).toBeInTheDocument();
    expect(screen.getByLabelText("Recent matches")).toHaveTextContent("Chess");
    expect(screen.getByRole("button", { name: "Open match-old" })).toBeInTheDocument();
  });

  it("copies the invite link and shows rematch for completed matches", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        seat: "seat1",
        match: {
          id: "match-done",
          gameType: "tictactoe",
          gameLabel: "TicTacToe",
          seats: ["seat1", "seat2"],
          players: createPlayersMock(),
          outcome: { status: "completed", score: { seat1: 1, seat2: 1 }, winner: null },
          clock: createClockMock(),
          boards: [
            {
              kind: "tictactoe",
              id: "A",
              firstSeat: "seat1",
              cells: Array(9).fill(null),
              seatsToAct: [],
              outcome: { status: "draw", reason: "board-full" }
            },
            {
              kind: "tictactoe",
              id: "B",
              firstSeat: "seat2",
              cells: Array(9).fill(null),
              seatsToAct: [],
              outcome: { status: "draw", reason: "board-full" }
            }
          ]
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    screen.getByRole("button", { name: "Create TicTacToe match" }).click();

    await screen.findByText("match-done");
    screen.getByRole("button", { name: "Copy invite" }).click();

    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("match-done"));
    expect(screen.getByRole("button", { name: "Rematch" })).toBeInTheDocument();
  });
});

function createPlayersMock() {
  return {
    seat1: { label: "Player 1", name: "Player 1" },
    seat2: { label: "Player 2", name: "Player 2" }
  };
}

function createClockMock() {
  return {
    config: { initialMs: 300_000, incrementMs: 2_000 },
    seats: {
      seat1: { remainingMs: 300_000, isRunning: false },
      seat2: { remainingMs: 300_000, isRunning: false }
    },
    runningSeats: [],
    updatedAtMs: 0,
    serverNowMs: 0,
    status: "active",
    expiredSeats: []
  };
}

function createChessSquares() {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  return ranks.flatMap((rank) =>
    files.map((file) => {
      const square = `${file}${rank}`;
      if (rank === "2") return { square, piece: { color: "w", type: "p" } };
      if (rank === "7") return { square, piece: { color: "b", type: "p" } };
      return { square, piece: null };
    })
  );
}
