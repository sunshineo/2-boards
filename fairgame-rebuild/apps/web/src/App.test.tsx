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
    expect(screen.getByRole("button", { name: "Gomoku lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hex lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reversi lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Breakthrough lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mancala lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dots and Boxes lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Order and Chaos lobby" })).toBeInTheDocument();
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
    expect(screen.getByRole("img", { name: "Gomoku preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/gomoku.png"
    );
    expect(screen.getByRole("img", { name: "Hex preview" })).toHaveAttribute("src", "/game-thumbnails/hex.png");
    expect(screen.getByRole("img", { name: "Reversi preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/reversi.png"
    );
    expect(screen.getByRole("img", { name: "Breakthrough preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/breakthrough.png"
    );
    expect(screen.getByRole("img", { name: "Mancala preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/mancala.png"
    );
    expect(screen.getByRole("img", { name: "Dots and Boxes preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/dots-boxes.png"
    );
    expect(screen.getByRole("img", { name: "Order and Chaos preview" })).toHaveAttribute(
      "src",
      "/game-thumbnails/order-chaos.png"
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
          joinedSeats: 1,
          maxSeats: 2,
          players: createPlayersMock(),
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          clock: createClockMock(10 * 60_000),
          boards: [
            {
              kind: "chess",
              id: "A",
              firstSeat: "seat1",
              fen: initialChessFen,
              whiteSeat: "seat1",
              blackSeat: "seat2",
              squares: createChessSquares(),
              moveHistory: [],
              seatsToAct: [],
              outcome: { status: "in_progress" }
            },
            {
              kind: "chess",
              id: "B",
              firstSeat: "seat2",
              fen: initialChessFen,
              whiteSeat: "seat2",
              blackSeat: "seat1",
              squares: createChessSquares(),
              moveHistory: [],
              seatsToAct: [],
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
    expect(screen.getByLabelText("You clock")).toHaveTextContent("10:00");
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
          joinedSeats: 1,
          maxSeats: 2,
          players: createPlayersMock(),
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          clock: createClockMock(),
          boards: [
            {
              kind: "tictactoe",
              id: "A",
              firstSeat: "seat1",
              cells: Array(9).fill(null),
              seatsToAct: [],
              outcome: { status: "in_progress" }
            },
            {
              kind: "tictactoe",
              id: "B",
              firstSeat: "seat2",
              cells: Array(9).fill(null),
              seatsToAct: [],
              outcome: { status: "in_progress" }
            }
          ]
        }
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByTestId("match-code")).toHaveTextContent("TicTacToe");
    expect(screen.getByTestId("match-code")).toHaveAttribute("data-match-id", "match-1");
    expect(screen.getByTestId("match-code")).not.toHaveTextContent("match-1");
    expect(screen.getByRole("region", { name: "Board A" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Board B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board A cell 1" })).toBeDisabled();
    expect(screen.queryByText("Role")).not.toBeInTheDocument();
    expect(screen.queryByText("Invite")).not.toBeInTheDocument();
    expect(screen.queryByText("Use Copy invite")).not.toBeInTheDocument();
    expect(screen.queryByText("Your seat")).not.toBeInTheDocument();
    expect(screen.getByLabelText("You clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("Opponent clock")).toHaveTextContent("5:00");
    expect(screen.queryByRole("button", { name: "Copy invite" })).not.toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getAllByText("Waiting for opponent")).toHaveLength(1);
    expect(screen.queryByText("Player 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Player 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Your move")).not.toBeInTheDocument();
    expect(screen.getAllByText("Waiting")).toHaveLength(2);
    expect(container.querySelector(".match-actions")).not.toBeInTheDocument();
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
          joinedSeats: 2,
          maxSeats: 2,
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
    expect(screen.getByLabelText("You clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("Opponent clock")).toHaveTextContent("5:00");

    await waitFor(() => expect(screen.getByLabelText("You clock")).toHaveTextContent("4:59"), {
      timeout: 1_500
    });
    expect(screen.getByLabelText("Opponent clock")).toHaveTextContent("5:00");
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
          joinedSeats: 1,
          maxSeats: 2,
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
              seatsToAct: [],
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
              seatsToAct: [],
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
    expect(screen.getByRole("button", { name: "Board A column 1" })).toBeDisabled();
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
          joinedSeats: 1,
          maxSeats: 2,
          players: createPlayersMock(),
          outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
          clock: createClockMock(),
          boards: [
            {
              kind: "chess",
              id: "A",
              firstSeat: "seat1",
              fen: initialChessFen,
              whiteSeat: "seat1",
              blackSeat: "seat2",
              squares: createChessSquares(),
              moveHistory: [],
              seatsToAct: [],
              outcome: { status: "in_progress" }
            },
            {
              kind: "chess",
              id: "B",
              firstSeat: "seat2",
              fen: initialChessFen,
              whiteSeat: "seat2",
              blackSeat: "seat1",
              squares: createChessSquares(),
              moveHistory: [],
              seatsToAct: [],
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
    const boardA = screen.getByTestId("board-A-chessboard");
    const boardB = screen.getByTestId("board-B-chessboard");
    expect(getChessboardSquare(boardA, "e2")).toBeInTheDocument();
    expect(boardA).toHaveAttribute("data-interactive", "false");
    expect(boardB).toHaveAttribute("data-interactive", "false");
    expect(screen.getByRole("button", { name: "Board A square e2 white pawn" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Board B square e2 white pawn" })).toBeDisabled();
    expect(screen.queryByText("Moves")).not.toBeInTheDocument();
    expect(screen.queryByText("No moves")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Board A move history" })).not.toBeInTheDocument();
  });

  it("creates and renders the added game board controls", async () => {
    const cases = [
      { gameType: "gomoku", label: "Gomoku", controlName: "Board A Gomoku cell 1" },
      { gameType: "hex", label: "Hex", controlName: "Board A Hex cell 1" },
      { gameType: "reversi", label: "Reversi", controlName: "Board A Reversi cell 20" },
      { gameType: "breakthrough", label: "Breakthrough", controlName: "Board A Breakthrough cell 9 seat1" },
      { gameType: "mancala", label: "Mancala", controlName: "Board A seat1 pit 1" },
      { gameType: "dots-boxes", label: "Dots and Boxes", controlName: "Board A edge h-0-0" },
      { gameType: "order-chaos", label: "Order and Chaos", controlName: "Board A Order and Chaos cell 1" }
    ] as const;

    for (const testCase of cases) {
      cleanup();
      window.history.replaceState(null, "", "/");
      vi.stubGlobal(
        "fetch",
        createFetchMock({
          matches: [],
          seatSession: createAddedGameSeatSession(testCase.gameType, testCase.label)
        })
      );

      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: `${testCase.label} lobby` }));
      fireEvent.click(screen.getByRole("button", { name: `Create ${testCase.label} match` }));

      await screen.findByTestId("match-code");
      expect(screen.getByTestId("match-code")).toHaveTextContent(testCase.label);
      expect(screen.getByRole("button", { name: testCase.controlName })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: testCase.controlName })).toBeDisabled();
    }
  });

  it("renders Dots and Boxes as a dot grid with owned boxes", async () => {
    const seatSession = createAddedGameSeatSession("dots-boxes", "Dots and Boxes");
    const boardA = seatSession.match.boards[0] as {
      drawnEdges: string[];
      boxes: ("seat1" | "seat2" | null)[];
      scores: { seat1: number; seat2: number };
    };
    boardA.drawnEdges = ["h-0-0", "h-1-0", "v-0-0", "v-0-1"];
    boardA.boxes = ["seat1", ...Array(8).fill(null)];
    boardA.scores = { seat1: 1, seat2: 0 };

    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Dots and Boxes lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Dots and Boxes match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByLabelText("Board A Dots and Boxes grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Board A box 1 seat1")).toHaveTextContent("X");
    expect(screen.getByRole("button", { name: "Board A edge h-0-0" })).toHaveAttribute("aria-pressed", "true");
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
          joinedSeats: 2,
          maxSeats: 2,
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
    expect(screen.queryByText("Role")).not.toBeInTheDocument();
    expect(screen.getByLabelText("You clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("Opponent clock")).toHaveTextContent("5:00");
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

  it("shows rematch for completed matches without invite controls", async () => {
    const fetchMock = createFetchMock({
      matches: [],
      seatSession: {
        seat: "seat1",
        match: {
          id: "match-done",
          gameType: "tictactoe",
          gameLabel: "TicTacToe",
          seats: ["seat1", "seat2"],
          joinedSeats: 2,
          maxSeats: 2,
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

    expect(screen.queryByRole("button", { name: "Copy invite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
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
      joinedSeats: 1,
      maxSeats: 2,
      players: createPlayersMock(),
      outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
      clock: createClockMock(),
      boards: [
        {
          kind: "tictactoe",
          id: "A",
          firstSeat: "seat1",
          cells: Array(9).fill(null),
          seatsToAct: [],
          outcome: { status: "in_progress" }
        },
        {
          kind: "tictactoe",
          id: "B",
          firstSeat: "seat2",
          cells: Array(9).fill(null),
          seatsToAct: [],
          outcome: { status: "in_progress" }
        }
      ]
    }
  };
}

function createAddedGameSeatSession(gameType: string, gameLabel: string) {
  return {
    seat: "seat1",
    match: {
      id: `match-${gameType}`,
      gameType,
      gameLabel,
      seats: ["seat1", "seat2"],
      joinedSeats: 1,
      maxSeats: 2,
      players: createPlayersMock(),
      outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
      clock: createClockMock(),
      boards: [
        createAddedGameBoard(gameType, "A", "seat1"),
        createAddedGameBoard(gameType, "B", "seat2")
      ]
    }
  };
}

function createAddedGameBoard(gameType: string, id: "A" | "B", firstSeat: "seat1" | "seat2") {
  const base = {
    id,
    firstSeat,
    seatsToAct: [],
    outcome: { status: "in_progress" }
  };

  if (gameType === "gomoku") {
    return {
      ...base,
      kind: "gomoku",
      rows: 15,
      columns: 15,
      cells: Array(225).fill(null),
      playableCells: []
    };
  }

  if (gameType === "hex") {
    return {
      ...base,
      kind: "hex",
      size: 11,
      cells: Array(121).fill(null),
      playableCells: []
    };
  }

  if (gameType === "reversi") {
    const cells = Array(64).fill(null);
    cells[28] = "seat1";
    cells[35] = "seat1";
    cells[27] = "seat2";
    cells[36] = "seat2";
    return {
      ...base,
      kind: "reversi",
      rows: 8,
      columns: 8,
      cells,
      playableCells: []
    };
  }

  if (gameType === "breakthrough") {
    const cells = Array(64).fill(null);
    const secondSeat = firstSeat === "seat1" ? "seat2" : "seat1";
    for (let column = 0; column < 8; column += 1) {
      cells[column] = firstSeat;
      cells[8 + column] = firstSeat;
      cells[48 + column] = secondSeat;
      cells[56 + column] = secondSeat;
    }
    return {
      ...base,
      kind: "breakthrough",
      rows: 8,
      columns: 8,
      cells,
      playableMoves: []
    };
  }

  if (gameType === "mancala") {
    return {
      ...base,
      kind: "mancala",
      pitsPerSide: 6,
      stonesPerPit: 4,
      pits: Array(12).fill(4),
      stores: { seat1: 0, seat2: 0 },
      playablePits: []
    };
  }

  if (gameType === "dots-boxes") {
    return {
      ...base,
      kind: "dots-boxes",
      boxRows: 3,
      boxColumns: 3,
      drawnEdges: [],
      boxes: Array(9).fill(null),
      scores: { seat1: 0, seat2: 0 },
      playableEdges: []
    };
  }

  return {
    ...base,
    kind: "order-chaos",
    rows: 6,
    columns: 6,
    cells: Array(36).fill(null),
    orderSeat: "seat1",
    chaosSeat: "seat2",
    playableCells: []
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

const initialChessFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function getChessboardSquare(board: HTMLElement, square: string) {
  const squareElement = board.querySelector(`[data-square="${square}"]`);
  if (!(squareElement instanceof HTMLElement)) {
    throw new Error(`Missing chessboard square ${square}`);
  }
  return squareElement;
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
