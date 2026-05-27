import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("App", () => {
  it("renders create and join controls before a match is loaded", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Two-board fair games" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "TicTacToe" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Connect Four" })).toBeInTheDocument();
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
        body: JSON.stringify({ gameType: "connect4" })
      })
    );
    expect(screen.getByRole("button", { name: "Board A column 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board B column 1" })).toBeDisabled();
  });
});

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
