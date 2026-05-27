import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders create and join controls before a match is loaded", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Two-board TicTacToe" })).toBeInTheDocument();
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
          seats: ["seat1", "seat2"],
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          boards: [
            {
              id: "A",
              firstSeat: "seat1",
              cells: Array(9).fill(null),
              seatsToAct: ["seat1"],
              outcome: { status: "in_progress" }
            },
            {
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

  });
});
