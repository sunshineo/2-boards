import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("App", () => {
  it("renders a game picker before a match is loaded", () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: []
      })
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "Two-board fair games" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Games" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "TicTacToe lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Four lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chess lobby" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "TicTacToe preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/tictactoe.png"
    );
    expect(screen.getByRole("img", { name: "Connect Four preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/connect-four.png"
    );
    expect(screen.getByRole("img", { name: "Chess preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/chess.png"
    );
    expect(screen.queryByRole("button", { name: "Create TicTacToe match" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Open games")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Join as")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Match code")).not.toBeInTheDocument();
  });

  it("opens a game-specific lobby and filters open and recent matches", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [
          {
            id: "match-chess",
            gameType: "chess",
            gameLabel: "Chess",
            clockInitialMs: 600_000,
            clockIncrementMs: 0,
            joinedSeats: 1,
            maxSeats: 2,
            updatedAtMs: 2_000
          },
          {
            id: "match-tictactoe",
            gameType: "tictactoe",
            gameLabel: "TicTacToe",
            clockInitialMs: 300_000,
            clockIncrementMs: 0,
            joinedSeats: 1,
            maxSeats: 2,
            updatedAtMs: 1_000
          }
        ]
      })
    );
    localStorage.setItem(
      "fairgame.recentMatches",
      JSON.stringify([
        { id: "recent-chess", gameLabel: "Chess", result: "In progress", gameType: "chess" },
        { id: "recent-ttt", gameLabel: "TicTacToe", result: "Draw match", gameType: "tictactoe" }
      ])
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));

    expect(screen.getByRole("heading", { name: "Chess lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Quick pairing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create 10 minute Chess match" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveAttribute("min", "3");
    expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveAttribute("max", "60");
    expect(screen.getByText("3-60 min")).toBeInTheDocument();
    expect(screen.queryByText("Minutes per side")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Chess match" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Join Chess game 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Open games")).toHaveTextContent("Chess");
    expect(screen.getByLabelText("Open games")).toHaveTextContent("10 min");
    expect(screen.getByLabelText("Open games")).not.toHaveTextContent("TicTacToe");
    expect(screen.getByLabelText("Recent matches")).toHaveTextContent("Chess");
    expect(screen.getByLabelText("Recent matches")).not.toHaveTextContent("TicTacToe");
  });

  it("uses game-specific custom time ranges", () => {
    vi.stubGlobal("fetch", createFetchMock({ matches: [] }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));

    expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveAttribute("min", "1");
    expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveAttribute("max", "10");
    expect(screen.getByText("1-10 min")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect Four lobby" }));

    expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveAttribute("min", "2");
    expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveAttribute("max", "20");
    expect(screen.getByText("2-20 min")).toBeInTheDocument();
  });

  it("stores game lobbies in browser history", async () => {
    vi.stubGlobal("fetch", createFetchMock({ matches: [] }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));

    expect(window.location.pathname + window.location.search).toBe("/games/chess");
    expect(screen.getByRole("heading", { name: "Chess lobby" })).toBeInTheDocument();

    await navigateHistory("back");
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/"));
    expect(screen.getByRole("button", { name: "Chess lobby" })).toBeInTheDocument();

    await navigateHistory("forward");
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/games/chess"));
    expect(screen.getByRole("heading", { name: "Chess lobby" })).toBeInTheDocument();
  });

  it("lets browser back leave a match and forward restore it", async () => {
    const fetchMock = createFetchMock({
      matches: [],
      seatSession: createTicTacToeSeatSession("match-nav")
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    await screen.findByTestId("match-code");
    expect(window.location.pathname + window.location.search).toBe("/matches/match-nav");

    await navigateHistory("back");
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/games/tictactoe"));
    expect(screen.getByRole("heading", { name: "TicTacToe lobby" })).toBeInTheDocument();
    expect(screen.queryByTestId("match-code")).not.toBeInTheDocument();

    await navigateHistory("forward");
    await waitFor(() =>
      expect(screen.getByTestId("match-code")).toHaveAttribute("data-match-id", "match-nav")
    );
    expect(window.location.pathname + window.location.search).toBe("/matches/match-nav");
  });

  it("creates a quick-pairing match with the chosen total time", async () => {
    const fetchMock = createFetchMock({
      matches: [],
      seatSession: {
        seat: "seat1",
        match: {
          id: "match-quick",
          gameType: "chess",
          gameLabel: "Chess",
          seats: ["seat1", "seat2"],
          players: createPlayersMock(),
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          clock: createClockMock(10 * 60_000),
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
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create 10 minute Chess match" }));

    expect(await screen.findByTestId("match-code")).toHaveAttribute("data-match-id", "match-quick");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ gameType: "chess", clockInitialMs: 600_000 })
      })
    );
    expect(screen.getByLabelText("Player 1 clock")).toHaveTextContent("10:00");
  });

  it("renders the two boards after creating a match", async () => {
    const fetchMock = createFetchMock({
      matches: [],
      seatSession: {
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
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByTestId("match-code")).toHaveTextContent("TicTacToe");
    expect(screen.getByTestId("match-code")).toHaveAttribute("data-match-id", "match-1");
    expect(screen.getByTestId("match-code")).not.toHaveTextContent("match-1");
    expect(screen.getByRole("region", { name: "Board A" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Board B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board A cell 1" })).toBeEnabled();
    expect(screen.getByLabelText("Player 1 clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("Player 2 clock")).toHaveTextContent("5:00");
    expect(screen.getByRole("button", { name: "Copy invite" })).toBeInTheDocument();
    expect(screen.getByText("Your move")).toBeInTheDocument();

  });

  it("ticks running clocks between server updates", async () => {
    const fetchMock = createFetchMock({
      matches: [],
      seatSession: {
        seat: "seat1",
        match: {
          id: "match-clock",
          gameType: "tictactoe",
          gameLabel: "TicTacToe",
          seats: ["seat1", "seat2"],
          players: createPlayersMock(),
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          clock: createRunningClockMock(),
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
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByTestId("match-code")).toHaveAttribute("data-match-id", "match-clock");
    expect(screen.getByLabelText("Player 1 clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("Player 2 clock")).toHaveTextContent("5:00");

    await waitFor(() => expect(screen.getByLabelText("Player 1 clock")).toHaveTextContent("4:59"), {
      timeout: 1_500
    });
    expect(screen.getByLabelText("Player 2 clock")).toHaveTextContent("5:00");
  });

  it("creates and renders a Connect Four match from the game selector", async () => {
    const fetchMock = createFetchMock({
      matches: [],
      seatSession: {
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
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Four lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Connect Four match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByTestId("match-code")).toHaveAttribute("data-match-id", "match-2");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ gameType: "connect4", clockInitialMs: 300_000 })
      })
    );
    expect(screen.getByRole("button", { name: "Board A column 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board B column 1" })).toBeDisabled();
  });

  it("creates and renders a Chess match from the game selector", async () => {
    const fetchMock = createFetchMock({
      matches: [],
      seatSession: {
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
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByTestId("match-code")).toHaveAttribute("data-match-id", "match-3");
    expect(screen.getByRole("button", { name: "Board A square e2 white pawn" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board B square e2 white pawn" })).toBeDisabled();
    expect(screen.getAllByText("No moves")).toHaveLength(2);
  });

  it("joins a listed open match without typed name or code", async () => {
    const fetchMock = createFetchMock({
      matches: [
        {
          id: "match-open-123",
          gameType: "tictactoe",
          gameLabel: "TicTacToe",
          clockInitialMs: 180_000,
          clockIncrementMs: 0,
          joinedSeats: 1,
          maxSeats: 2,
          updatedAtMs: 1_000
        }
      ],
      joinSession: {
        seat: "seat2",
        match: {
          id: "match-open-123",
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
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    const joinButton = await screen.findByRole("button", { name: "Join TicTacToe game 1" });
    expect(joinButton).toHaveAttribute("data-match-id", "match-open-123");
    expect(joinButton).toHaveTextContent("3 min");
    fireEvent.click(joinButton);

    expect(await screen.findByTestId("match-code")).toHaveAttribute("data-match-id", "match-open-123");
    expect(screen.getByTestId("match-code")).not.toHaveTextContent("match-open-123");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-open-123/join"),
      expect.objectContaining({
        body: JSON.stringify({})
      })
    );
  });

  it("renders recent match history from local storage", () => {
    vi.stubGlobal("fetch", createFetchMock({ matches: [] }));
    localStorage.setItem(
      "fairgame.recentMatches",
      JSON.stringify([{ id: "match-old", gameLabel: "Chess", result: "In progress" }])
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));

    expect(screen.getByText("Recent matches")).toBeInTheDocument();
    expect(screen.getByLabelText("Recent matches")).toHaveTextContent("Chess");
    expect(screen.getByLabelText("Recent matches")).not.toHaveTextContent("match-old");
    expect(screen.getByRole("button", { name: "Open recent Chess game 1" })).toHaveAttribute(
      "data-match-id",
      "match-old"
    );
  });

  it("copies the invite link and shows rematch for completed matches", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const fetchMock = createFetchMock({
      matches: [],
      seatSession: {
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
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    await screen.findByTestId("match-code");
    fireEvent.click(screen.getByRole("button", { name: "Copy invite" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/matches/match-done"));
    expect(screen.getByRole("button", { name: "Rematch" })).toBeInTheDocument();
  });
});

function createFetchMock(input: {
  matches: unknown[];
  seatSession?: unknown;
  joinSession?: unknown;
}) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const method = init?.method ?? "GET";

    if (path.endsWith("/api/matches") && method === "GET") {
      return createJsonResponse({ matches: input.matches });
    }

    if (path.endsWith("/join")) {
      return createJsonResponse(input.joinSession ?? input.seatSession);
    }

    return createJsonResponse(input.seatSession);
  });
}

function createJsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body
  };
}

function createTicTacToeSeatSession(id: string) {
  return {
    seat: "seat1",
    match: {
      id,
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
  };
}

async function navigateHistory(direction: "back" | "forward") {
  await act(async () => {
    window.history[direction]();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function createPlayersMock() {
  return {
    seat1: { label: "Player 1", name: "Player 1" },
    seat2: { label: "Player 2", name: "Player 2" }
  };
}

function createClockMock(initialMs = 300_000, incrementMs = 0) {
  return {
    config: { initialMs, incrementMs },
    seats: {
      seat1: { remainingMs: initialMs, isRunning: false },
      seat2: { remainingMs: initialMs, isRunning: false }
    },
    runningSeats: [],
    updatedAtMs: 0,
    serverNowMs: 0,
    status: "active",
    expiredSeats: []
  };
}

function createRunningClockMock() {
  const clock = createClockMock();
  return {
    ...clock,
    seats: {
      ...clock.seats,
      seat1: { remainingMs: 300_000, isRunning: true }
    },
    runningSeats: ["seat1"],
    updatedAtMs: 1_000,
    serverNowMs: 1_000
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
