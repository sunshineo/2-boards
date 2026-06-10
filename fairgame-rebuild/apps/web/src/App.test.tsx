import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const socketIoMock = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  type MockSocket = {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    trigger: (event: string, ...args: unknown[]) => void;
  };

  const sockets: MockSocket[] = [];
  const io = vi.fn(() => {
    const handlers = new Map<string, Handler[]>();
    const socket: MockSocket = {
      connected: false,
      emit: vi.fn(),
      on: vi.fn((event: string, handler: Handler) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        return socket;
      }),
      close: vi.fn(() => {
        socket.connected = false;
      }),
      trigger: (event: string, ...args: unknown[]) => {
        socket.connected = event === "connect" ? true : event === "disconnect" ? false : socket.connected;
        for (const handler of handlers.get(event) ?? []) {
          handler(...args);
        }
      }
    };

    sockets.push(socket);
    return socket;
  });

  return { io, sockets };
});

vi.mock("socket.io-client", () => ({
  io: socketIoMock.io
}));

const browserChessBotMock = vi.hoisted(() => {
  type MockBotStatus = "idle" | "loading" | "thinking" | "error";
  type MockController = {
    runForMatch: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    setStatus: (status: MockBotStatus) => void;
  };
  const controllers: MockController[] = [];
  const createBrowserChessBotController = vi.fn((options?: { onStatus?: (status: MockBotStatus) => void }) => {
    const controller = {
      runForMatch: vi.fn(async () => undefined),
      dispose: vi.fn(),
      setStatus: (status: MockBotStatus) => options?.onStatus?.(status)
    };
    controllers.push(controller);
    return controller;
  });

  return { controllers, createBrowserChessBotController };
});

vi.mock("./browserChessBot", async () => {
  const actual = await vi.importActual<typeof import("./browserChessBot")>("./browserChessBot");
  return {
    ...actual,
    createBrowserChessBotController: browserChessBotMock.createBrowserChessBotController,
    createBrowserGameBotController: browserChessBotMock.createBrowserChessBotController
  };
});

import { App } from "./App";
import type { ChessBoardView, ChessLegalMove, SeatId } from "./types";

afterEach(() => {
  cleanup();
  socketIoMock.io.mockClear();
  socketIoMock.sockets.length = 0;
  browserChessBotMock.createBrowserChessBotController.mockClear();
  browserChessBotMock.controllers.length = 0;
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
    expect(
      screen.getAllByRole("button", { name: / lobby$/ }).map((button) => button.getAttribute("aria-label"))
    ).toEqual([
      "Chess lobby",
      "TicTacToe lobby",
      "Connect Four lobby",
      "Gomoku lobby",
      "Hex lobby",
      "Reversi lobby",
      "Breakthrough lobby",
      "Mancala lobby",
      "Dots and Boxes lobby",
      "Order and Chaos lobby"
    ]);
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
    expect(screen.getByRole("button", { name: "10 min Long" })).toBeInTheDocument();
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

  it("shows Chess bot mode controls and difficulty choices", () => {
    vi.stubGlobal("fetch", createFetchMock({ matches: [] }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));

    expect(screen.getByRole("button", { name: "Human" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bot" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Bot" }));

    expect(screen.getByRole("button", { name: "Easy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hard" })).toBeInTheDocument();
  });

  it("shows Connect Four bot mode controls with Human selected", () => {
    vi.stubGlobal("fetch", createFetchMock({ matches: [] }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Four lobby" }));

    expect(screen.getByRole("button", { name: "Human" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bot" })).toHaveAttribute("aria-pressed", "false");
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

  it("selects a quick-pairing time before creating the match", async () => {
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
              turnColor: "w",
              isCheck: false,
              checkSquare: null,
              moveNumber: 1,
              whiteSeat: "seat1",
              blackSeat: "seat2",
              drawOffer: null,
              squares: createChessSquares(),
              legalMoves: createInitialChessLegalMoves(),
              moveHistory: [],
              seatsToAct: [],
              outcome: { status: "in_progress" }
            },
            {
              kind: "chess",
              id: "B",
              firstSeat: "seat2",
              fen: initialChessFen,
              turnColor: "w",
              isCheck: false,
              checkSquare: null,
              moveNumber: 1,
              whiteSeat: "seat2",
              blackSeat: "seat1",
              drawOffer: null,
              squares: createChessSquares(),
              legalMoves: createInitialChessLegalMoves(),
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

    const fiveMinuteButton = screen.getByText("5 min").closest("button");
    const tenMinuteButton = screen.getByText("10 min").closest("button");
    expect(fiveMinuteButton).toHaveAttribute("aria-pressed", "true");
    expect(fiveMinuteButton).toHaveClass("selected");
    expect(tenMinuteButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(tenMinuteButton!);

    expect(screen.getByRole("heading", { name: "Chess lobby" })).toBeInTheDocument();
    expect(screen.getByText("10 min").closest("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("10 min").closest("button")).toHaveClass("selected");
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/api/matches") && init?.method === "POST"))
      .toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    expect(await screen.findByTestId("match-code")).toHaveAttribute("data-match-id", "match-quick");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ gameType: "chess", clockInitialMs: 600_000 })
      })
    );
    expect(screen.getByRole("region", { name: "Clocks" })).toBeInTheDocument();
    expect(screen.getByLabelText("You clock")).toHaveTextContent("10:00");
    expect(screen.getByLabelText("Opponent clock")).toHaveTextContent("10:00");
    expect(screen.queryByLabelText("Board A White clock")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board B Black clock")).not.toBeInTheDocument();
  });

  it("creates a Chess bot match with the selected difficulty", async () => {
    const botSession = createChessSeatSession("match-bot-create");
    (botSession.match as typeof botSession.match & { bot: unknown }).bot = {
      seat: "seat2",
      kind: "browser-stockfish",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    };
    botSession.match.players.seat2.name = "Stockfish Normal";
    const fetchMock = createFetchMock({ matches: [], seatSession: botSession });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Bot" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    expect(await screen.findByTestId("match-code")).toHaveAttribute("data-match-id", "match-bot-create");
    expect(screen.getByTestId("match-opponent-name")).toHaveTextContent("Stockfish Normal");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      })
    );
  });

  it("creates a Connect Four bot match with the normal bot difficulty", async () => {
    const botSession = createConnectFourSeatSession("match-connect4-bot-create");
    (botSession.match as typeof botSession.match & { bot: unknown }).bot = {
      seat: "seat2",
      kind: "random-legal",
      gameType: "connect4",
      difficulty: "normal",
      displayName: "Connect Four Bot"
    };
    botSession.match.players.seat2.name = "Connect Four Bot";
    botSession.match.joinedSeats = 2;
    const fetchMock = createFetchMock({ matches: [], seatSession: botSession });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Four lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Bot" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Connect Four match" }));

    expect(await screen.findByTestId("match-code")).toHaveAttribute("data-match-id", "match-connect4-bot-create");
    expect(screen.getByTestId("match-opponent-name")).toHaveTextContent("Connect Four Bot");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ gameType: "connect4", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      })
    );
  });

  it("shows a creating state while a Chess bot match request is pending", async () => {
    const botSession = createChessSeatSession("match-bot-pending");
    (botSession.match as typeof botSession.match & { bot: unknown }).bot = {
      seat: "seat2",
      kind: "browser-stockfish",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    };
    let resolveCreate: (() => void) | null = null;
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") {
        return Promise.resolve(createJsonResponse({ matches: [] }));
      }
      if (path.endsWith("/api/matches") && method === "POST") {
        return new Promise((resolve) => {
          resolveCreate = () => resolve(createJsonResponse(botSession));
        });
      }
      return Promise.resolve(createJsonResponse(botSession));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Bot" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    expect(await screen.findByRole("button", { name: "Creating bot game" })).toBeDisabled();

    await act(async () => {
      resolveCreate?.();
      await Promise.resolve();
    });

    expect(await screen.findByTestId("match-code")).toHaveAttribute("data-match-id", "match-bot-pending");
  });

  it("does not start the browser bot controller for human Chess matches", async () => {
    vi.stubGlobal("fetch", createFetchMock({ matches: [], seatSession: createChessSeatSession("match-human") }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(browserChessBotMock.createBrowserChessBotController).not.toHaveBeenCalled();
  });

  it("starts the browser bot controller for bot Chess matches", async () => {
    const botSession = createChessSeatSession("match-bot-controller");
    (botSession.match as typeof botSession.match & { bot: unknown }).bot = {
      seat: "seat2",
      kind: "browser-stockfish",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    };
    vi.stubGlobal("fetch", createFetchMock({ matches: [], seatSession: botSession }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Bot" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    await waitFor(() => expect(browserChessBotMock.createBrowserChessBotController).toHaveBeenCalledTimes(1));
    expect(browserChessBotMock.controllers[0]?.runForMatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: "match-bot-controller" })
    );
  });

  it("does not show a thinking banner while the Chess bot searches", async () => {
    const botSession = createChessSeatSession("match-bot-thinking");
    (botSession.match as typeof botSession.match & { bot: unknown }).bot = {
      seat: "seat2",
      kind: "browser-stockfish",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    };
    vi.stubGlobal("fetch", createFetchMock({ matches: [], seatSession: botSession }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Bot" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    await waitFor(() => expect(browserChessBotMock.controllers).toHaveLength(1));

    act(() => {
      browserChessBotMock.controllers[0]?.setStatus("thinking");
    });

    expect(screen.queryByText("Bot thinking")).not.toBeInTheDocument();
  });

  it("floats Chess bot failure alerts outside the match layout", async () => {
    const botSession = createChessSeatSession("match-bot-failed");
    (botSession.match as typeof botSession.match & { bot: unknown }).bot = {
      seat: "seat2",
      kind: "browser-stockfish",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    };
    vi.stubGlobal("fetch", createFetchMock({ matches: [], seatSession: botSession }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Bot" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    await waitFor(() => expect(browserChessBotMock.controllers).toHaveLength(1));

    act(() => {
      browserChessBotMock.controllers[0]?.setStatus("error");
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bot move failed");
    expect(alert.closest(".floating-alerts")).not.toBeNull();
    expect(alert.closest(".match-room")).toBeNull();
    expect(screen.getByRole("region", { name: "Clocks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
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

  it("shows the two-board instructions the first time a match opens and dismisses them permanently", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: createTicTacToeSeatSession("match-guide")
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    const guide = await screen.findByRole("region", { name: "How two-board matches work" });
    expect(guide).toHaveTextContent("two games of TicTacToe at the same time");
    expect(guide).toHaveTextContent("You move first on one board, and your opponent moves first on the other.");
    expect(guide).toHaveTextContent("one clock for the whole match, shared across both boards");
    expect(guide).toHaveTextContent("Each board is worth one point");
    expect(guide).toHaveTextContent("you lose every board that has not finished");

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(screen.queryByRole("region", { name: "How two-board matches work" })).not.toBeInTheDocument();
    expect(localStorage.getItem("fairgame.howToPlaySeen")).toBe("true");
  });

  it("does not auto-show the two-board instructions once they were dismissed", async () => {
    localStorage.setItem("fairgame.howToPlaySeen", "true");
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: createTicTacToeSeatSession("match-guide-seen")
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    await screen.findByRole("region", { name: "Board A" });
    expect(screen.queryByRole("region", { name: "How two-board matches work" })).not.toBeInTheDocument();
  });

  it("reopens the two-board instructions from the header How it works control", async () => {
    localStorage.setItem("fairgame.howToPlaySeen", "true");
    vi.stubGlobal("fetch", createFetchMock({ matches: [] }));

    render(<App />);

    expect(screen.getByText(/two boards at once/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "How two-board matches work" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "How it works" }));

    const guide = screen.getByRole("region", { name: "How two-board matches work" });
    expect(guide).toHaveTextContent("play the same game twice");

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(screen.queryByRole("region", { name: "How two-board matches work" })).not.toBeInTheDocument();
  });

  it("shows neutral two-board instructions copy to spectators", async () => {
    const spectatorSession = { ...createTicTacToeSeatSession("match-guide-spectator"), seat: null };
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: spectatorSession
      })
    );
    window.history.replaceState(null, "", "/matches/match-guide-spectator");

    render(<App />);

    const guide = await screen.findByRole("region", { name: "How two-board matches work" });
    expect(guide).toHaveTextContent("Each side moves first on one of the two boards.");
    expect(guide).toHaveTextContent("a player's clock runs out, they lose every board");
    expect(guide).not.toHaveTextContent("You move first");
    expect(guide).not.toHaveTextContent("you lose every board");
  });

  it("rejoins match realtime updates after socket reconnects", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: createTicTacToeSeatSession("match-reconnect")
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    await screen.findByTestId("match-code");
    await waitFor(() => expect(socketIoMock.sockets).toHaveLength(1));
    expect(socketIoMock.io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ addTrailingSlash: false, withCredentials: true })
    );

    const socket = socketIoMock.sockets[0];
    if (!socket) throw new Error("Expected realtime socket to be created.");

    act(() => socket.trigger("connect"));
    act(() => socket.trigger("disconnect", "transport close"));
    act(() => socket.trigger("connect"));

    expect(socket.emit).toHaveBeenNthCalledWith(1, "watch-match", { matchId: "match-reconnect" });
    expect(socket.emit).toHaveBeenNthCalledWith(2, "watch-match", { matchId: "match-reconnect" });
    expect(socket.emit).toHaveBeenCalledTimes(2);
  });

  it("polls active matches as a fallback when realtime updates are missed", async () => {
    vi.useFakeTimers();
    const waitingSession = createTicTacToeSeatSession("match-poll");
    const readySession = createTicTacToeSeatSession("match-poll");
    const [readyBoardA, readyBoardB] = readySession.match.boards as unknown as [
      { seatsToAct: SeatId[] },
      { seatsToAct: SeatId[] }
    ];
    readySession.match.joinedSeats = 2;
    readyBoardA.seatsToAct = ["seat1"];
    readyBoardB.seatsToAct = ["seat2"];
    let currentSession = waitingSession;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") {
        return createJsonResponse({ matches: [] });
      }
      return createJsonResponse(currentSession);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "TicTacToe lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create TicTacToe match" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("match-code")).toHaveAttribute("data-match-id", "match-poll");
    expect(screen.getByRole("button", { name: "Board A cell 1" })).toBeDisabled();

    currentSession = readySession;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(screen.getByRole("button", { name: "Board A cell 1" })).toBeEnabled();
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
    expect(screen.getByLabelText("You clock")).toHaveAttribute("data-clock-state", "running");
    expect(screen.getByLabelText("Opponent clock")).toHaveAttribute("data-clock-state", "paused");

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
              turnColor: "w",
              isCheck: false,
              checkSquare: null,
              moveNumber: 1,
              whiteSeat: "seat1",
              blackSeat: "seat2",
              drawOffer: null,
              squares: createChessSquares(),
              legalMoves: createInitialChessLegalMoves(),
              moveHistory: [],
              seatsToAct: [],
              outcome: { status: "in_progress" }
            },
            {
              kind: "chess",
              id: "B",
              firstSeat: "seat2",
              fen: initialChessFen,
              turnColor: "w",
              isCheck: false,
              checkSquare: null,
              moveNumber: 1,
              whiteSeat: "seat2",
              blackSeat: "seat1",
              drawOffer: null,
              squares: createChessSquares(),
              legalMoves: createInitialChessLegalMoves(),
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
    const boardAPanel = screen.getByLabelText("Board A", { selector: "section.board-panel" });
    const boardBPanel = screen.getByLabelText("Board B", { selector: "section.board-panel" });
    expect(getChessboardSquare(boardA, "e2")).toBeInTheDocument();
    expect(boardA).toHaveAttribute("data-interactive", "false");
    expect(boardB).toHaveAttribute("data-interactive", "false");
    expect(boardA).toHaveAttribute("data-orientation", "white");
    expect(boardB).toHaveAttribute("data-orientation", "black");
    expect(screen.queryByRole("button", { name: "Flip Board A" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Flip Board B" })).not.toBeInTheDocument();
    fireEvent.keyDown(boardBPanel, { key: "f" });
    expect(boardA).toHaveAttribute("data-orientation", "white");
    expect(boardB).toHaveAttribute("data-orientation", "black");
    fireEvent.keyDown(boardAPanel, { key: "f" });
    expect(boardA).toHaveAttribute("data-orientation", "white");
    expect(boardB).toHaveAttribute("data-orientation", "black");
    fireEvent.contextMenu(getChessboardSquare(boardA, "e4"));
    expect(screen.getByRole("button", { name: "Board A square e4 empty green circle" })).toHaveClass(
      "annotation-green"
    );
    expect(screen.getByRole("button", { name: "Board B square e4 empty" })).not.toHaveClass("annotation-green");
    fireEvent.contextMenu(getChessboardSquare(boardB, "e4"), { shiftKey: true });
    expect(screen.getByRole("button", { name: "Board B square e4 empty red circle" })).toHaveClass(
      "annotation-red"
    );
    expect(screen.getByRole("button", { name: "Board A square e4 empty green circle" })).toHaveClass(
      "annotation-green"
    );
    fireEvent.contextMenu(getChessboardSquare(boardA, "e4"));
    expect(screen.getByRole("button", { name: "Board A square e4 empty" })).not.toHaveClass("annotation-green");
    expect(screen.getByRole("button", { name: "Board B square e4 empty red circle" })).toHaveClass(
      "annotation-red"
    );
    fireEvent.mouseDown(getChessboardSquare(boardA, "e2"), { button: 2 });
    fireEvent.mouseUp(getChessboardSquare(boardA, "e4"), { button: 2 });
    fireEvent.contextMenu(getChessboardSquare(boardA, "e4"));
    expect(screen.getByLabelText("Board A arrow e2 to e4 green")).toHaveClass("annotation-arrow-green");
    expect(screen.getByRole("button", { name: "Board A square e4 empty" })).not.toHaveClass("annotation-green");
    expect(screen.queryByLabelText("Board B arrow e2 to e4 green")).not.toBeInTheDocument();
    fireEvent.mouseDown(getChessboardSquare(boardB, "e7"), { button: 2, shiftKey: true });
    fireEvent.mouseUp(getChessboardSquare(boardB, "e5"), { button: 2, shiftKey: true });
    fireEvent.contextMenu(getChessboardSquare(boardB, "e5"), { shiftKey: true });
    expect(screen.getByLabelText("Board B arrow e7 to e5 red")).toHaveClass("annotation-arrow-red");
    expect(screen.getByLabelText("Board A arrow e2 to e4 green")).toHaveClass("annotation-arrow-green");
    fireEvent.mouseDown(getChessboardSquare(boardA, "e2"), { button: 2 });
    fireEvent.mouseUp(getChessboardSquare(boardA, "e4"), { button: 2 });
    fireEvent.contextMenu(getChessboardSquare(boardA, "e4"));
    expect(screen.queryByLabelText("Board A arrow e2 to e4 green")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Board B arrow e7 to e5 red")).toHaveClass("annotation-arrow-red");
    fireEvent.contextMenu(getChessboardSquare(boardA, "c4"));
    fireEvent.mouseDown(getChessboardSquare(boardA, "d2"), { button: 2 });
    fireEvent.mouseUp(getChessboardSquare(boardA, "d4"), { button: 2 });
    fireEvent.contextMenu(getChessboardSquare(boardA, "d4"));
    expect(screen.getByRole("button", { name: "Board A square c4 empty green circle" })).toHaveClass(
      "annotation-green"
    );
    expect(screen.getByLabelText("Board A arrow d2 to d4 green")).toHaveClass("annotation-arrow-green");
    fireEvent.click(getChessboardSquare(boardA, "a4"));
    expect(screen.getByRole("button", { name: "Board A square c4 empty" })).not.toHaveClass("annotation-green");
    expect(screen.queryByLabelText("Board A arrow d2 to d4 green")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board B square e4 empty red circle" })).toHaveClass(
      "annotation-red"
    );
    expect(screen.getByLabelText("Board B arrow e7 to e5 red")).toHaveClass("annotation-arrow-red");
    expect(screen.getByRole("button", { name: "Board A square e2 white pawn" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Board B square e2 white pawn" })).toBeDisabled();
    expect(screen.getAllByText("Moves")).toHaveLength(2);
    expect(screen.getAllByText("No moves yet")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Board A move history" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Board A players")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board B players")).not.toBeInTheDocument();
  });

  it("toggles a two-board Chess Zen mode with the z shortcut", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: createChessSeatSession("match-chess-zen")
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByRole("region", { name: "Chess match" })).toHaveAttribute("data-zen-mode", "false");
    expect(screen.getByRole("heading", { name: "Two-board fair games" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "z" });

    expect(screen.getByRole("region", { name: "Chess match" })).toHaveAttribute("data-zen-mode", "true");
    expect(screen.queryByRole("heading", { name: "Two-board fair games" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("match-code")).not.toBeInTheDocument();
    expect(screen.getByTestId("board-A-chessboard")).toBeInTheDocument();
    expect(screen.getByTestId("board-B-chessboard")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "z" });

    expect(screen.getByRole("region", { name: "Chess match" })).toHaveAttribute("data-zen-mode", "false");
    expect(screen.getByRole("heading", { name: "Two-board fair games" })).toBeInTheDocument();
    expect(screen.getByTestId("match-code")).toHaveAttribute("data-match-id", "match-chess-zen");
  });

  it("anchors the Chess promotion picker to the destination square", async () => {
    const seatSession = createChessSeatSession("match-chess-promotion-picker");
    const boardA = seatSession.match.boards[0] as ChessBoardView | undefined;
    if (!boardA) throw new Error("Missing Board A fixture");
    boardA.fen = "8/P7/8/8/8/8/8/4K2k w - - 0 1";
    boardA.squares = createChessSquares({ a2: null, a7: { color: "w", type: "p" }, a8: null }) as ChessBoardView["squares"];
    boardA.legalMoves = [
      { color: "w", piece: "p", from: "a7", to: "a8", promotion: "q", san: "a8=Q", lan: "a7a8q" },
      { color: "w", piece: "p", from: "a7", to: "a8", promotion: "r", san: "a8=R", lan: "a7a8r" },
      { color: "w", piece: "p", from: "a7", to: "a8", promotion: "b", san: "a8=B", lan: "a7a8b" },
      { color: "w", piece: "p", from: "a7", to: "a8", promotion: "n", san: "a8=N", lan: "a7a8n" }
    ] satisfies ChessLegalMove[];

    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    const boardAElement = await screen.findByTestId("board-A-chessboard");
    fireEvent.click(screen.getByRole("button", { name: "Board A square a7 white pawn" }));
    fireEvent.click(screen.getByRole("button", { name: "Board A square a8 empty legal destination" }));

    const picker = screen.getByRole("dialog", { name: "Board A choose promotion" });
    expect(picker).toHaveAttribute("data-promotion-square", "a8");
    expect(picker).toHaveAttribute("data-board-orientation", "white");
    expect(picker).toHaveStyle({ "--promotion-file": "0", "--promotion-rank": "0" });
    expect(boardAElement).toHaveAttribute("data-orientation", "white");
    expect(screen.getByRole("button", { name: "Promote to queen" })).toBeInTheDocument();
  });

  it("queues and submits a board-local Chess premove when the board becomes actionable", async () => {
    const seatSession = createChessSeatSession("match-chess-premove");
    const readyMatch = structuredClone(seatSession.match);
    const readyBoardB = readyMatch.boards[1] as ChessBoardView | undefined;
    if (!readyBoardB) throw new Error("Missing Board B fixture");
    const premove = { color: "b", piece: "p", from: "e7", to: "e5", san: "e5", lan: "e7e5" } satisfies ChessLegalMove;
    readyBoardB.turnColor = "b";
    readyBoardB.seatsToAct = ["seat1"];
    readyBoardB.legalMoves = [premove];

    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return createJsonResponse({ matches: [] });
      if (path.endsWith("/api/matches") && method === "POST") return createJsonResponse(seatSession);
      if (path.endsWith("/api/matches/match-chess-premove/moves") && method === "POST") {
        return createJsonResponse({ match: readyMatch });
      }
      return createJsonResponse({ match: readyMatch });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    const boardB = await screen.findByTestId("board-B-chessboard");
    await waitFor(() => expect(socketIoMock.sockets).toHaveLength(1));
    expect(boardB).toHaveAttribute("data-interactive", "false");
    fireEvent.click(screen.getByRole("button", { name: "Board B square e7 black pawn" }));
    fireEvent.click(await screen.findByRole("button", { name: "Board B square e5 empty premove destination" }));

    expect(screen.getByRole("button", { name: "Board B square e7 black pawn premove source" })).toHaveClass(
      "premove-source"
    );
    expect(screen.getByRole("button", { name: "Board B square e5 empty premove target" })).toHaveClass(
      "premove-target"
    );
    expect(screen.getByRole("button", { name: "Board A square e2 white pawn" })).not.toHaveClass("premove-source");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-premove/moves"),
      expect.anything()
    );

    const socket = socketIoMock.sockets[0];
    if (!socket) throw new Error("Expected realtime socket to be created.");
    act(() => socket.trigger("match:update", readyMatch));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/matches/match-chess-premove/moves"),
        expect.objectContaining({
          body: JSON.stringify({ boardId: "B", seat: "seat1", move: { from: "e7", to: "e5" } })
        })
      )
    );
    expect(boardB).toHaveAttribute("data-interactive", "true");
  });

  it("shows normal move dots for board-local Chess premove destinations", async () => {
    const seatSession = createChessSeatSession("match-chess-premove-dots");
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByTestId("board-B-chessboard")).toHaveAttribute("data-interactive", "false");
    fireEvent.click(screen.getByRole("button", { name: "Board B square e7 black pawn" }));

    const e6Target = await screen.findByRole("button", { name: "Board B square e6 empty premove destination" });
    const e5Target = await screen.findByRole("button", { name: "Board B square e5 empty premove destination" });
    expect(e6Target.querySelector(".chess-legal-move-dot")).toBeInTheDocument();
    expect(e5Target.querySelector(".chess-legal-move-dot")).toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: "Board B square e7 black pawn selected" })
        .querySelector(".chess-legal-move-dot")
    ).not.toBeInTheDocument();
  });

  it("queues a board-local Chess recapture premove onto an own occupied square", async () => {
    const seatSession = createChessSeatSession("match-chess-premove-recapture");
    const boardB = seatSession.match.boards[1] as ChessBoardView | undefined;
    if (!boardB) throw new Error("Missing Board B fixture");
    boardB.fen = "4k3/4p3/3n4/8/8/8/8/4K3 w - - 0 1";
    boardB.turnColor = "w";
    boardB.squares = createSparseChessSquares({
      e8: { color: "b", type: "k" },
      e7: { color: "b", type: "p" },
      d6: { color: "b", type: "n" },
      e1: { color: "w", type: "k" }
    });
    boardB.legalMoves = [];

    const fetchMock = createFetchMock({
      matches: [],
      seatSession
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    fireEvent.click(screen.getByRole("button", { name: "Board B square e7 black pawn" }));
    fireEvent.click(await screen.findByRole("button", { name: "Board B square d6 black knight premove destination" }));

    expect(screen.getByRole("button", { name: "Board B square e7 black pawn premove source" })).toHaveClass(
      "premove-source"
    );
    expect(screen.getByRole("button", { name: "Board B square d6 black knight premove target" })).toHaveClass(
      "premove-target"
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-premove-recapture/moves"),
      expect.anything()
    );
  });

  it("shows the same Chess move dot on enemy capture targets as empty destinations", async () => {
    const seatSession = createChessSeatSession("match-chess-capture-dot");
    const boardA = seatSession.match.boards[0] as ChessBoardView | undefined;
    if (!boardA) throw new Error("Missing Board A fixture");
    boardA.fen = "8/8/8/3n4/4B3/2N5/8/4K2k w - - 0 1";
    boardA.squares = createSparseChessSquares({
      c3: { color: "w", type: "n" },
      d5: { color: "b", type: "n" },
      e4: { color: "w", type: "b" },
      e1: { color: "w", type: "k" },
      h1: { color: "b", type: "k" }
    }) as ChessBoardView["squares"];
    boardA.legalMoves = [
      { color: "w", piece: "n", from: "c3", to: "a2", san: "Na2", lan: "c3a2" },
      { color: "w", piece: "n", from: "c3", to: "d5", captured: "n", san: "Nxd5", lan: "c3d5" }
    ] satisfies ChessLegalMove[];
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    fireEvent.click(screen.getByRole("button", { name: "Board A square c3 white knight" }));

    const emptyTarget = screen.getByRole("button", { name: "Board A square a2 empty legal destination" });
    const captureTarget = screen.getByRole("button", {
      name: "Board A square d5 black knight legal destination"
    });
    const ownPieceSquare = screen.getByRole("button", { name: "Board A square e4 white bishop" });
    const emptyDot = emptyTarget.querySelector(".chess-legal-move-dot");
    const captureDot = captureTarget.querySelector(".chess-legal-move-dot");

    expect(emptyDot).toBeInTheDocument();
    expect(captureDot).toBeInTheDocument();
    expect(captureDot).toHaveAttribute("class", emptyDot?.getAttribute("class"));
    expect(ownPieceSquare.querySelector(".chess-legal-move-dot")).not.toBeInTheDocument();
  });

  it("cancels a queued board-local Chess premove without creating an annotation", async () => {
    const seatSession = createChessSeatSession("match-chess-premove-cancel");
    const fetchMock = createFetchMock({
      matches: [],
      seatSession
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    const boardB = await screen.findByTestId("board-B-chessboard");
    fireEvent.click(screen.getByRole("button", { name: "Board B square e7 black pawn" }));
    fireEvent.click(await screen.findByRole("button", { name: "Board B square e5 empty premove destination" }));

    expect(screen.getByRole("button", { name: "Board B square e7 black pawn premove source" })).toHaveClass(
      "premove-source"
    );
    expect(screen.getByRole("button", { name: "Board B square e5 empty premove target" })).toHaveClass(
      "premove-target"
    );

    fireEvent.contextMenu(getChessboardSquare(boardB, "e5"));

    expect(screen.getByRole("button", { name: "Board B square e7 black pawn" })).not.toHaveClass("premove-source");
    expect(screen.getByRole("button", { name: "Board B square e5 empty" })).not.toHaveClass("premove-target");
    expect(screen.getByRole("button", { name: "Board B square e5 empty" })).not.toHaveClass("annotation-green");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-premove-cancel/moves"),
      expect.anything()
    );

    fireEvent.contextMenu(getChessboardSquare(boardB, "e5"));
    expect(screen.getByRole("button", { name: "Board B square e5 empty green circle" })).toHaveClass(
      "annotation-green"
    );
  });

  it("cancels a queued board-local Chess premove by clicking a different square", async () => {
    const seatSession = createChessSeatSession("match-chess-premove-click-cancel");
    const fetchMock = createFetchMock({
      matches: [],
      seatSession
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    fireEvent.click(screen.getByRole("button", { name: "Board B square e7 black pawn" }));
    fireEvent.click(await screen.findByRole("button", { name: "Board B square e5 empty premove destination" }));

    expect(screen.getByRole("button", { name: "Board B square e7 black pawn premove source" })).toHaveClass(
      "premove-source"
    );
    expect(screen.getByRole("button", { name: "Board B square e5 empty premove target" })).toHaveClass(
      "premove-target"
    );

    const cancellationSquare = screen.getByRole("button", { name: "Board B square a6 empty" });
    expect(cancellationSquare).not.toBeDisabled();
    fireEvent.click(cancellationSquare);

    expect(screen.getByRole("button", { name: "Board B square e7 black pawn" })).not.toHaveClass("premove-source");
    expect(screen.getByRole("button", { name: "Board B square e5 empty" })).not.toHaveClass("premove-target");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-premove-click-cancel/moves"),
      expect.anything()
    );
  });

  it("cancels a queued board-local Chess premove with Escape", async () => {
    const seatSession = createChessSeatSession("match-chess-premove-escape");
    const fetchMock = createFetchMock({
      matches: [],
      seatSession
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    const boardBPanel = await screen.findByLabelText("Board B", { selector: "section.board-panel" });
    fireEvent.click(screen.getByRole("button", { name: "Board B square e7 black pawn" }));
    fireEvent.click(await screen.findByRole("button", { name: "Board B square e5 empty premove destination" }));

    expect(screen.getByRole("button", { name: "Board B square e7 black pawn premove source" })).toHaveClass(
      "premove-source"
    );
    expect(screen.getByRole("button", { name: "Board B square e5 empty premove target" })).toHaveClass(
      "premove-target"
    );

    fireEvent.keyDown(boardBPanel, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Board B square e7 black pawn" })).not.toHaveClass("premove-source");
    expect(screen.getByRole("button", { name: "Board B square e5 empty" })).not.toHaveClass("premove-target");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-premove-escape/moves"),
      expect.anything()
    );
  });

  it("shows active Chess targets and per-board move history", async () => {
    const boardAFenAfterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const boardAFenAfterE5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: {
          seat: "seat1",
          match: {
            id: "match-chess-active",
            gameType: "chess",
            gameLabel: "Chess",
            seats: ["seat1", "seat2"],
            joinedSeats: 2,
            maxSeats: 2,
            players: createPlayersMock(),
            outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
            clock: createRunningClockMock(),
            boards: [
              {
                kind: "chess",
                id: "A",
                firstSeat: "seat1",
                fen: boardAFenAfterE5,
                turnColor: "w",
                isCheck: false,
                checkSquare: null,
                moveNumber: 2,
                whiteSeat: "seat1",
                blackSeat: "seat2",
                drawOffer: null,
                squares: createChessSquares(),
                legalMoves: [
                  { color: "w", piece: "n", from: "g1", to: "f3", san: "Nf3", lan: "g1f3" },
                  { color: "w", piece: "n", from: "g1", to: "h3", san: "Nh3", lan: "g1h3" }
                ],
                moveHistory: [
                  {
                    seat: "seat1",
                    color: "w",
                    piece: "p",
                    from: "e2",
                    to: "e4",
                    san: "e4",
                    lan: "e2e4",
                    fenAfter: boardAFenAfterE4
                  },
                  {
                    seat: "seat2",
                    color: "b",
                    piece: "p",
                    from: "e7",
                    to: "e5",
                    san: "e5",
                    lan: "e7e5",
                    fenAfter: boardAFenAfterE5
                  }
                ],
                seatsToAct: ["seat1"],
                outcome: { status: "in_progress" }
              },
              {
                kind: "chess",
                id: "B",
                firstSeat: "seat2",
                fen: initialChessFen,
                turnColor: "w",
                isCheck: false,
                checkSquare: null,
                moveNumber: 1,
                whiteSeat: "seat2",
                blackSeat: "seat1",
                drawOffer: null,
                squares: createChessSquares(),
                legalMoves: createInitialChessLegalMoves(),
                moveHistory: [],
                seatsToAct: ["seat2"],
                outcome: { status: "in_progress" }
              }
            ]
          }
        }
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    const boardA = screen.getByTestId("board-A-chessboard");
    const boardB = screen.getByTestId("board-B-chessboard");
    const boardAPanel = screen.getByLabelText("Board A", { selector: "section.board-panel" });
    const boardBPanel = screen.getByLabelText("Board B", { selector: "section.board-panel" });
    expect(boardA).toHaveAttribute("data-interactive", "true");
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    expect(boardAPanel).toHaveAttribute("tabindex", "0");
    expect(boardBPanel).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("heading", { name: "Board A" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Board B" })).not.toBeInTheDocument();
    expect(screen.getByTestId("board-A-status")).toHaveTextContent("Your move");
    expect(screen.getByTestId("board-A-status")).toHaveClass("active");
    expect(screen.getByTestId("board-B-status")).toHaveTextContent("Opponent to move");
    expect(screen.getByTestId("board-B-status")).not.toHaveClass("active");
    expect(screen.getByRole("region", { name: "Clocks" })).toBeInTheDocument();
    expect(screen.getByLabelText("You clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("Opponent clock")).toHaveTextContent("5:00");
    await waitFor(() => expect(screen.getByLabelText("You clock")).toHaveTextContent("4:59"), {
      timeout: 1_500
    });
    expect(screen.getByLabelText("Opponent clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("You clock")).toHaveClass("running");
    expect(screen.queryByLabelText("Board A White clock")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board B Black clock")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board A square g1 white knight" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Board A square g1 white knight" }));
    const knightF3Target = screen.getByRole("button", { name: "Board A square f3 empty legal destination" });
    const knightH3Target = screen.getByRole("button", { name: "Board A square h3 empty legal destination" });
    expect(knightF3Target).toBeEnabled();
    expect(knightF3Target.querySelector(".chess-legal-move-dot")).toBeInTheDocument();
    expect(knightH3Target.querySelector(".chess-legal-move-dot")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Board A square g1 white knight selected" }).querySelector(".chess-legal-move-dot")
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board A turn indicator")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board B turn indicator")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Flip Board A" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Flip Board B" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board A players")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board B players")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Board A move history" })).toHaveTextContent("e4");
    expect(screen.getByRole("region", { name: "Board A move history" })).toHaveTextContent("e5");
    expect(screen.getByLabelText("Board A current move e5")).toHaveClass("current-move");
    fireEvent.click(screen.getByRole("button", { name: "Board A current move e5" }));
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-interactive", "true");
    expect(screen.queryByRole("button", { name: "Board A return to live position" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board A previous move" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board A next move" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Board A first move" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board A latest move" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Board B previous move" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Board B first move" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Board B latest move" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Board A previous move" }));
    expect(boardA).toHaveAttribute("data-review-ply", "1");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE4);
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    expect(screen.getByRole("button", { name: "Board A previous move" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board A next move" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Board A next move" }));
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    expect(boardA).toHaveAttribute("data-interactive", "true");
    fireEvent.click(screen.getByRole("button", { name: "Board A first move" }));
    expect(boardA).toHaveAttribute("data-review-ply", "0");
    expect(boardA).toHaveAttribute("data-position-fen", initialChessFen);
    expect(boardA).toHaveAttribute("data-interactive", "false");
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Starting position");
    expect(screen.getByRole("button", { name: "Board A first move" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Board A previous move" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Board A next move" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Board A latest move" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Board A latest move" }));
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    expect(boardA).toHaveAttribute("data-interactive", "true");
    fireEvent.keyDown(boardBPanel, { key: "ArrowLeft" });
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    fireEvent.keyDown(boardBPanel, { key: "ArrowUp" });
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    fireEvent.keyDown(boardAPanel, { key: "ArrowLeft" });
    expect(boardA).toHaveAttribute("data-review-ply", "1");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE4);
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    fireEvent.keyDown(boardAPanel, { key: "ArrowRight" });
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    expect(boardA).toHaveAttribute("data-interactive", "true");
    fireEvent.keyDown(boardAPanel, { key: "ArrowUp" });
    expect(boardA).toHaveAttribute("data-review-ply", "0");
    expect(boardA).toHaveAttribute("data-position-fen", initialChessFen);
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    fireEvent.keyDown(boardAPanel, { key: "ArrowDown" });
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    fireEvent.keyDown(boardAPanel, { key: "k" });
    expect(boardA).toHaveAttribute("data-review-ply", "0");
    expect(boardA).toHaveAttribute("data-position-fen", initialChessFen);
    fireEvent.keyDown(boardAPanel, { key: "j" });
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    fireEvent.wheel(boardBPanel, { deltaY: -80 });
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    fireEvent.wheel(boardAPanel, { deltaY: -80 });
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    fireEvent.wheel(boardAPanel, { deltaY: 80 });
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    fireEvent.click(screen.getByRole("button", { name: "Board A review move e4" }));
    expect(boardA).toHaveAttribute("data-review-ply", "1");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE4);
    expect(boardA).toHaveAttribute("data-interactive", "false");
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Reviewing move 1");
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).not.toHaveTextContent("Your move");
    expect(screen.queryByLabelText("Board A players")).not.toBeInTheDocument();
    expect(boardB).toHaveAttribute("data-review-ply", "live");
    fireEvent.click(screen.getByRole("button", { name: "Board A return to live position" }));
    expect(boardA).toHaveAttribute("data-review-ply", "live");
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE5);
    expect(boardA).toHaveAttribute("data-interactive", "true");
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Your move");
    expect(screen.queryByLabelText("Board A players")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board B square g8 black knight" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Board B square e2 white pawn" })).toBeDisabled();
  }, 10_000);

  it("renders a legal Chess move optimistically while the server response is pending", async () => {
    const seatSession = createChessSeatSession("match-chess-optimistic");
    const confirmedSession = structuredClone(seatSession);
    const confirmedBoardA = confirmedSession.match.boards[0] as ChessBoardView | undefined;
    if (!confirmedBoardA) throw new Error("Missing Board A fixture");
    const boardAFenAfterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    confirmedBoardA.fen = boardAFenAfterE4;
    confirmedBoardA.turnColor = "b";
    confirmedBoardA.squares = createChessSquares({
      e2: null,
      e4: { color: "w", type: "p" }
    }) as ChessBoardView["squares"];
    confirmedBoardA.legalMoves = [];
    confirmedBoardA.moveHistory = [
      {
        seat: "seat1",
        color: "w",
        piece: "p",
        from: "e2",
        to: "e4",
        san: "e4",
        lan: "e2e4",
        fenAfter: boardAFenAfterE4
      }
    ];
    confirmedBoardA.seatsToAct = [];

    let resolveMove: (() => void) | null = null;
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return Promise.resolve(createJsonResponse({ matches: [] }));
      if (path.endsWith("/api/matches") && method === "POST") return Promise.resolve(createJsonResponse(seatSession));
      if (path.endsWith("/api/matches/match-chess-optimistic/moves") && method === "POST") {
        return new Promise<ReturnType<typeof createJsonResponse>>((resolve) => {
          resolveMove = () => resolve(createJsonResponse({ match: confirmedSession.match }));
        });
      }
      return Promise.resolve(createJsonResponse(seatSession));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    const boardA = await screen.findByTestId("board-A-chessboard");
    expect(boardA).toHaveAttribute("data-position-fen", initialChessFen);

    fireEvent.click(screen.getByRole("button", { name: "Board A square e2 white pawn" }));
    fireEvent.click(screen.getByRole("button", { name: "Board A square e4 empty legal destination" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-optimistic/moves"),
      expect.objectContaining({
        body: JSON.stringify({ boardId: "A", seat: "seat1", move: { from: "e2", to: "e4" } })
      })
    );
    expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE4);

    await act(async () => {
      resolveMove?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(boardA).toHaveAttribute("data-position-fen", boardAFenAfterE4));
  });

  it("submits a board-local Chess resign command", async () => {
    const seatSession = createChessSeatSession("match-chess-resign");
    const resignedSession = createChessSeatSession("match-chess-resign");
    const [resignedBoardA, resignedBoardB] = resignedSession.match.boards as unknown as [
      { outcome: unknown; seatsToAct: SeatId[] },
      { outcome: unknown; seatsToAct: SeatId[] }
    ];
    resignedBoardA.outcome = { status: "win", winner: "seat2", loser: "seat1", reason: "resignation" };
    resignedBoardA.seatsToAct = [];
    resignedBoardB.seatsToAct = ["seat2"];
    resignedSession.match.outcome = { status: "in_progress", score: { seat1: 0, seat2: 1 } };

    let currentSession = seatSession;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return createJsonResponse({ matches: [] });
      if (path.endsWith("/api/matches") && method === "POST") return createJsonResponse(seatSession);
      if (path.endsWith("/api/matches/match-chess-resign/moves") && method === "POST") {
        currentSession = resignedSession;
        return createJsonResponse({ match: resignedSession.match });
      }
      return createJsonResponse(currentSession);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    fireEvent.click(screen.getByRole("button", { name: "Resign Board A" }));

    expect(screen.getByRole("button", { name: "Confirm Resign Board A" })).toHaveClass("confirming");
    expect(screen.getByRole("button", { name: "Resign Board B" })).not.toHaveClass("confirming");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-resign/moves"),
      expect.anything()
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Resign Board A" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-resign/moves"),
      expect.objectContaining({
        body: JSON.stringify({ boardId: "A", seat: "seat1", move: { resign: true } })
      })
    );
    expect(await screen.findByText("Opponent won by resignation")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Board A", { selector: "section.board-panel" }).querySelector(".chess-turn-pill")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("board-B-chessboard")).toHaveAttribute("data-review-ply", "live");
  });

  it("submits a board-local Chess draw offer command", async () => {
    const seatSession = createChessSeatSession("match-chess-draw-offer");
    const offeredSession = createChessSeatSession("match-chess-draw-offer");
    const [offeredBoardA] = offeredSession.match.boards as unknown as [
      { drawOffer?: { offeredBy: SeatId } | null },
      { drawOffer?: { offeredBy: SeatId } | null }
    ];
    offeredBoardA.drawOffer = { offeredBy: "seat1" };

    let currentSession = seatSession;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return createJsonResponse({ matches: [] });
      if (path.endsWith("/api/matches") && method === "POST") return createJsonResponse(seatSession);
      if (path.endsWith("/api/matches/match-chess-draw-offer/moves") && method === "POST") {
        currentSession = offeredSession;
        return createJsonResponse({ match: offeredSession.match });
      }
      return createJsonResponse(currentSession);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    fireEvent.click(screen.getByRole("button", { name: "Offer Draw Board A" }));

    expect(screen.getByRole("button", { name: "Confirm Draw Offer Board A" })).toHaveClass("confirming");
    expect(screen.getByRole("button", { name: "Offer Draw Board B" })).not.toHaveClass("confirming");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-draw-offer/moves"),
      expect.anything()
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Draw Offer Board A" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-draw-offer/moves"),
      expect.objectContaining({
        body: JSON.stringify({ boardId: "A", seat: "seat1", move: { drawOffer: true } })
      })
    );
    const drawOfferedButton = await screen.findByRole("button", { name: "Draw Offered Board A" });
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Draw offer sent");
    expect(
      screen.getByLabelText("Board A", { selector: "section.board-panel" }).querySelector(".chess-turn-pill")
    ).not.toBeInTheDocument();
    expect(drawOfferedButton).toBeDisabled();
    expect(screen.getByTestId("board-B-chessboard")).toHaveAttribute("data-review-ply", "live");
  });

  it("submits a board-local Chess draw acceptance command", async () => {
    const seatSession = createChessSeatSession("match-chess-draw-accept");
    const acceptedSession = createChessSeatSession("match-chess-draw-accept");
    const [offeredBoardA] = seatSession.match.boards as unknown as [
      { drawOffer?: { offeredBy: SeatId } | null },
      { drawOffer?: { offeredBy: SeatId } | null }
    ];
    const [acceptedBoardA, acceptedBoardB] = acceptedSession.match.boards as unknown as [
      { drawOffer?: { offeredBy: SeatId } | null; outcome: unknown; seatsToAct: SeatId[] },
      { drawOffer?: { offeredBy: SeatId } | null; seatsToAct: SeatId[] }
    ];
    offeredBoardA.drawOffer = { offeredBy: "seat2" };
    acceptedBoardA.drawOffer = null;
    acceptedBoardA.outcome = { status: "draw", reason: "agreement" };
    acceptedBoardA.seatsToAct = [];
    acceptedBoardB.seatsToAct = ["seat2"];
    acceptedSession.match.outcome = { status: "in_progress", score: { seat1: 0.5, seat2: 0.5 } };

    let currentSession = seatSession;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return createJsonResponse({ matches: [] });
      if (path.endsWith("/api/matches") && method === "POST") return createJsonResponse(seatSession);
      if (path.endsWith("/api/matches/match-chess-draw-accept/moves") && method === "POST") {
        currentSession = acceptedSession;
        return createJsonResponse({ match: acceptedSession.match });
      }
      return createJsonResponse(currentSession);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Opponent offers draw");
    expect(
      screen.getByLabelText("Board A", { selector: "section.board-panel" }).querySelector(".chess-turn-pill")
    ).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Accept Draw Board A" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Accept Draw Board A" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-draw-accept/moves"),
      expect.objectContaining({
        body: JSON.stringify({ boardId: "A", seat: "seat1", move: { acceptDraw: true } })
      })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Draw by agreement")
    );
    expect(
      screen.getByLabelText("Board A", { selector: "section.board-panel" }).querySelector(".chess-turn-pill")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("board-B-chessboard")).toHaveAttribute("data-review-ply", "live");
  });

  it("submits a board-local Chess draw decline command", async () => {
    const seatSession = createChessSeatSession("match-chess-draw-decline");
    const declinedSession = createChessSeatSession("match-chess-draw-decline");
    const [offeredBoardA] = seatSession.match.boards as unknown as [
      { drawOffer?: { offeredBy: SeatId } | null },
      { drawOffer?: { offeredBy: SeatId } | null }
    ];
    const [declinedBoardA] = declinedSession.match.boards as unknown as [
      { drawOffer?: { offeredBy: SeatId } | null },
      { drawOffer?: { offeredBy: SeatId } | null }
    ];
    offeredBoardA.drawOffer = { offeredBy: "seat2" };
    declinedBoardA.drawOffer = null;

    let currentSession = seatSession;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return createJsonResponse({ matches: [] });
      if (path.endsWith("/api/matches") && method === "POST") return createJsonResponse(seatSession);
      if (path.endsWith("/api/matches/match-chess-draw-decline/moves") && method === "POST") {
        currentSession = declinedSession;
        return createJsonResponse({ match: declinedSession.match });
      }
      return createJsonResponse(currentSession);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Opponent offers draw");
    await waitFor(() => expect(screen.getByRole("button", { name: "Decline Draw Board A" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Decline Draw Board A" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/matches/match-chess-draw-decline/moves"),
        expect.objectContaining({
          body: JSON.stringify({ boardId: "A", seat: "seat1", move: { declineDraw: true } })
        })
      )
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Offer Draw Board A" })).toBeEnabled());
    expect(screen.getByTestId("board-B-chessboard")).toHaveAttribute("data-review-ply", "live");
  });

  it("submits a board-local Chess takeback request command", async () => {
    const boardAFenAfterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const seatSession = createChessSeatSession("match-chess-takeback-request");
    const requestedSession = createChessSeatSession("match-chess-takeback-request");
    const [boardA, boardB] = seatSession.match.boards as unknown as [
      {
        fen: string;
        turnColor: "w" | "b";
        squares: unknown[];
        legalMoves: unknown[];
        moveHistory: unknown[];
        seatsToAct: SeatId[];
      },
      { moveHistory: unknown[] }
    ];
    const [requestedBoardA] = requestedSession.match.boards as unknown as [
      {
        fen: string;
        turnColor: "w" | "b";
        takebackRequest?: { requestedBy: SeatId } | null;
        squares: unknown[];
        legalMoves: unknown[];
        moveHistory: unknown[];
        seatsToAct: SeatId[];
      },
      unknown
    ];
    boardA.fen = boardAFenAfterE4;
    boardA.turnColor = "b";
    boardA.squares = createChessSquares({ e2: null, e4: { color: "w", type: "p" } });
    boardA.legalMoves = [];
    boardA.moveHistory = [
      {
        seat: "seat1",
        color: "w",
        piece: "p",
        from: "e2",
        to: "e4",
        san: "e4",
        lan: "e2e4",
        fenAfter: boardAFenAfterE4
      }
    ];
    boardA.seatsToAct = ["seat2"];
    boardB.moveHistory = [];
    requestedBoardA.fen = boardAFenAfterE4;
    requestedBoardA.turnColor = "b";
    requestedBoardA.takebackRequest = { requestedBy: "seat1" };
    requestedBoardA.squares = boardA.squares;
    requestedBoardA.legalMoves = [];
    requestedBoardA.moveHistory = [
      ...boardA.moveHistory,
      {
        seat: "seat1",
        color: "w",
        san: "requests takeback",
        lan: "takeback-request",
        fenAfter: boardAFenAfterE4,
        takebackRequest: true
      }
    ];
    requestedBoardA.seatsToAct = ["seat2"];

    let currentSession = seatSession;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return createJsonResponse({ matches: [] });
      if (path.endsWith("/api/matches") && method === "POST") return createJsonResponse(seatSession);
      if (path.endsWith("/api/matches/match-chess-takeback-request/moves") && method === "POST") {
        currentSession = requestedSession;
        return createJsonResponse({ match: requestedSession.match });
      }
      return createJsonResponse(currentSession);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByRole("button", { name: "Request Takeback Board A" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Request Takeback Board B" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Request Takeback Board A" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-takeback-request/moves"),
      expect.objectContaining({
        body: JSON.stringify({ boardId: "A", seat: "seat1", move: { requestTakeback: true } })
      })
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Takeback Requested Board A" })).toBeDisabled());
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Takeback request sent");
    expect(screen.getByTestId("board-B-chessboard")).toHaveAttribute("data-review-ply", "live");
  });

  it("submits a board-local Chess takeback acceptance command", async () => {
    const boardAFenAfterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const seatSession = createChessSeatSession("match-chess-takeback-accept");
    const acceptedSession = createChessSeatSession("match-chess-takeback-accept");
    const [requestedBoardA] = seatSession.match.boards as unknown as [
      {
        fen: string;
        turnColor: "w" | "b";
        takebackRequest?: { requestedBy: SeatId } | null;
        squares: unknown[];
        legalMoves: unknown[];
        moveHistory: unknown[];
        seatsToAct: SeatId[];
      },
      unknown
    ];
    const [acceptedBoardA, acceptedBoardB] = acceptedSession.match.boards as unknown as [
      {
        fen: string;
        turnColor: "w" | "b";
        takebackRequest?: { requestedBy: SeatId } | null;
        squares: unknown[];
        legalMoves: unknown[];
        moveHistory: unknown[];
        seatsToAct: SeatId[];
      },
      { seatsToAct: SeatId[] }
    ];
    requestedBoardA.fen = boardAFenAfterE4;
    requestedBoardA.turnColor = "b";
    requestedBoardA.takebackRequest = { requestedBy: "seat2" };
    requestedBoardA.squares = createChessSquares({ e2: null, e4: { color: "w", type: "p" } });
    requestedBoardA.legalMoves = [];
    requestedBoardA.moveHistory = [
      {
        seat: "seat1",
        color: "w",
        piece: "p",
        from: "e2",
        to: "e4",
        san: "e4",
        lan: "e2e4",
        fenAfter: boardAFenAfterE4
      },
      {
        seat: "seat2",
        color: "b",
        san: "requests takeback",
        lan: "takeback-request",
        fenAfter: boardAFenAfterE4,
        takebackRequest: true
      }
    ];
    requestedBoardA.seatsToAct = ["seat2"];
    acceptedBoardA.fen = initialChessFen;
    acceptedBoardA.turnColor = "w";
    acceptedBoardA.takebackRequest = null;
    acceptedBoardA.squares = createChessSquares();
    acceptedBoardA.legalMoves = createInitialChessLegalMoves();
    acceptedBoardA.moveHistory = [
      {
        seat: "seat1",
        color: "w",
        san: "takeback accepted",
        lan: "takeback-accepted",
        fenAfter: initialChessFen,
        takebackAccepted: true
      }
    ];
    acceptedBoardA.seatsToAct = ["seat1"];
    acceptedBoardB.seatsToAct = ["seat2"];

    let currentSession = seatSession;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return createJsonResponse({ matches: [] });
      if (path.endsWith("/api/matches") && method === "POST") return createJsonResponse(seatSession);
      if (path.endsWith("/api/matches/match-chess-takeback-accept/moves") && method === "POST") {
        currentSession = acceptedSession;
        return createJsonResponse({ match: acceptedSession.match });
      }
      return createJsonResponse(currentSession);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Opponent requests takeback");
    await waitFor(() => expect(screen.getByRole("button", { name: "Accept Takeback Board A" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Accept Takeback Board A" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-chess-takeback-accept/moves"),
      expect.objectContaining({
        body: JSON.stringify({ boardId: "A", seat: "seat1", move: { acceptTakeback: true } })
      })
    );
    await waitFor(() => expect(screen.getByTestId("board-A-chessboard")).toHaveAttribute("data-position-fen", initialChessFen));
    expect(screen.getByRole("button", { name: "Request Takeback Board A" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Board A move history" })).toHaveTextContent("takeback accepted");
    expect(screen.getByTestId("board-B-chessboard")).toHaveAttribute("data-review-ply", "live");
  });

  it("submits a board-local Chess takeback decline command", async () => {
    const boardAFenAfterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const seatSession = createChessSeatSession("match-chess-takeback-decline");
    const declinedSession = createChessSeatSession("match-chess-takeback-decline");
    const [requestedBoardA] = seatSession.match.boards as unknown as [
      {
        fen: string;
        turnColor: "w" | "b";
        takebackRequest?: { requestedBy: SeatId } | null;
        squares: unknown[];
        legalMoves: unknown[];
        moveHistory: unknown[];
        seatsToAct: SeatId[];
      },
      unknown
    ];
    const [declinedBoardA] = declinedSession.match.boards as unknown as [
      { takebackRequest?: { requestedBy: SeatId } | null; moveHistory: unknown[] },
      unknown
    ];
    requestedBoardA.fen = boardAFenAfterE4;
    requestedBoardA.turnColor = "b";
    requestedBoardA.takebackRequest = { requestedBy: "seat2" };
    requestedBoardA.squares = createChessSquares({ e2: null, e4: { color: "w", type: "p" } });
    requestedBoardA.legalMoves = [];
    requestedBoardA.moveHistory = [
      {
        seat: "seat1",
        color: "w",
        piece: "p",
        from: "e2",
        to: "e4",
        san: "e4",
        lan: "e2e4",
        fenAfter: boardAFenAfterE4
      },
      {
        seat: "seat2",
        color: "b",
        san: "requests takeback",
        lan: "takeback-request",
        fenAfter: boardAFenAfterE4,
        takebackRequest: true
      }
    ];
    requestedBoardA.seatsToAct = ["seat2"];
    declinedBoardA.takebackRequest = null;
    declinedBoardA.moveHistory = [
      ...requestedBoardA.moveHistory,
      {
        seat: "seat1",
        color: "w",
        san: "declines takeback",
        lan: "takeback-declined",
        fenAfter: boardAFenAfterE4,
        takebackDeclined: true
      }
    ];

    let currentSession = seatSession;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/matches") && method === "GET") return createJsonResponse({ matches: [] });
      if (path.endsWith("/api/matches") && method === "POST") return createJsonResponse(seatSession);
      if (path.endsWith("/api/matches/match-chess-takeback-decline/moves") && method === "POST") {
        currentSession = declinedSession;
        return createJsonResponse({ match: declinedSession.match });
      }
      return createJsonResponse(currentSession);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    await waitFor(() => expect(screen.getByRole("button", { name: "Decline Takeback Board A" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Decline Takeback Board A" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/matches/match-chess-takeback-decline/moves"),
        expect.objectContaining({
          body: JSON.stringify({ boardId: "A", seat: "seat1", move: { declineTakeback: true } })
        })
      )
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Request Takeback Board A" })).toBeEnabled());
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Board A move history" })).toHaveTextContent("declines takeback")
    );
  });

  it("shows out-of-turn Chess board-control records in move history", async () => {
    const boardAFenAfterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const seatSession = createChessSeatSession("match-chess-control-history");
    const [boardA] = seatSession.match.boards as unknown as [
      { drawOffer: { offeredBy: SeatId } | null; fen: string; moveHistory: unknown[] },
      { drawOffer: { offeredBy: SeatId } | null; moveHistory: unknown[] }
    ];
    boardA.drawOffer = { offeredBy: "seat2" };
    boardA.fen = boardAFenAfterE4;
    boardA.moveHistory = [
      {
        seat: "seat1",
        color: "w",
        piece: "p",
        from: "e2",
        to: "e4",
        san: "e4",
        lan: "e2e4",
        fenAfter: boardAFenAfterE4
      },
      {
        seat: "seat2",
        color: "b",
        san: "offers draw",
        lan: "draw-offer",
        fenAfter: initialChessFen,
        drawOffer: true
      }
    ];

    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByRole("region", { name: "Board A move history" })).toHaveTextContent("offers draw");
    const controlRecord = screen.getByLabelText("Board A current move offers draw");
    expect(controlRecord).toHaveClass("current-move");
    expect(controlRecord).toBeDisabled();
    fireEvent.click(controlRecord);
    expect(screen.getByTestId("board-A-chessboard")).toHaveAttribute("data-review-ply", "live");
    expect(screen.getByRole("button", { name: "Board A square e2 empty last move" })).toHaveClass("last-move");
    expect(screen.getByRole("button", { name: "Board A square e4 white pawn last move" })).toHaveClass("last-move");
  });

  it("omits board-local Chess player and material rows", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: {
          seat: "seat1",
          match: {
            id: "match-chess-material",
            gameType: "chess",
            gameLabel: "Chess",
            seats: ["seat1", "seat2"],
            joinedSeats: 2,
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
                turnColor: "w",
                isCheck: false,
                checkSquare: null,
                moveNumber: 1,
                whiteSeat: "seat1",
                blackSeat: "seat2",
                drawOffer: null,
                squares: createChessSquares({ e7: null }),
                legalMoves: createInitialChessLegalMoves(),
                moveHistory: [],
                seatsToAct: [],
                outcome: { status: "in_progress" }
              },
              {
                kind: "chess",
                id: "B",
                firstSeat: "seat2",
                fen: initialChessFen,
                turnColor: "w",
                isCheck: false,
                checkSquare: null,
                moveNumber: 1,
                whiteSeat: "seat2",
                blackSeat: "seat1",
                drawOffer: null,
                squares: createChessSquares({ g1: null }),
                legalMoves: createInitialChessLegalMoves(),
                moveHistory: [],
                seatsToAct: [],
                outcome: { status: "in_progress" }
              }
            ]
          }
        }
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.queryByLabelText("Board A players")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board B players")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board A White material advantage")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Board B Black material advantage")).not.toBeInTheDocument();
  });

  it("highlights a checked Chess king square", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: {
          seat: "seat1",
          match: {
            id: "match-chess-check",
            gameType: "chess",
            gameLabel: "Chess",
            seats: ["seat1", "seat2"],
            joinedSeats: 2,
            maxSeats: 2,
            players: createPlayersMock(),
            outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
            clock: createClockMock(),
            boards: [
              {
                kind: "chess",
                id: "A",
                firstSeat: "seat1",
                fen: "4k3/8/8/8/8/8/8/4R2K b - - 0 1",
                turnColor: "b",
                isCheck: true,
                checkSquare: "e8",
                moveNumber: 1,
                whiteSeat: "seat1",
                blackSeat: "seat2",
                drawOffer: null,
                squares: createChessSquares({
                  e8: { color: "b", type: "k" },
                  e1: { color: "w", type: "r" },
                  h1: { color: "w", type: "k" }
                }),
                legalMoves: [],
                moveHistory: [],
                seatsToAct: ["seat2"],
                outcome: { status: "in_progress" }
              },
              {
                kind: "chess",
                id: "B",
                firstSeat: "seat2",
                fen: initialChessFen,
                turnColor: "w",
                isCheck: false,
                checkSquare: null,
                moveNumber: 1,
                whiteSeat: "seat2",
                blackSeat: "seat1",
                drawOffer: null,
                squares: createChessSquares(),
                legalMoves: createInitialChessLegalMoves(),
                moveHistory: [],
                seatsToAct: ["seat2"],
                outcome: { status: "in_progress" }
              }
            ]
          }
        }
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByRole("button", { name: "Board A square e8 black king in check" })).toHaveClass(
      "checked-king"
    );
  });

  it("hides the live checked-king marker while reviewing an older Chess move", async () => {
    const reviewFenWithoutCheck = "4k3/8/8/8/4P3/8/8/5R1K b - - 0 1";
    const liveFenWithCheck = "4k3/8/8/8/8/8/8/4R2K b - - 0 1";
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        matches: [],
        seatSession: {
          seat: "seat1",
          match: {
            id: "match-chess-review-check",
            gameType: "chess",
            gameLabel: "Chess",
            seats: ["seat1", "seat2"],
            joinedSeats: 2,
            maxSeats: 2,
            players: createPlayersMock(),
            outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
            clock: createClockMock(),
            boards: [
              {
                kind: "chess",
                id: "A",
                firstSeat: "seat1",
                fen: liveFenWithCheck,
                turnColor: "b",
                isCheck: true,
                checkSquare: "e8",
                moveNumber: 1,
                whiteSeat: "seat1",
                blackSeat: "seat2",
                drawOffer: null,
                squares: createChessSquares({
                  e8: { color: "b", type: "k" },
                  e1: { color: "w", type: "r" },
                  h1: { color: "w", type: "k" }
                }),
                legalMoves: [],
                moveHistory: [
                  {
                    seat: "seat1",
                    color: "w",
                    piece: "r",
                    from: "e1",
                    to: "f1",
                    san: "Rf1",
                    lan: "e1f1",
                    fenAfter: reviewFenWithoutCheck
                  },
                  {
                    seat: "seat1",
                    color: "w",
                    piece: "r",
                    from: "f1",
                    to: "e1",
                    san: "Re1",
                    lan: "f1e1",
                    fenAfter: liveFenWithCheck
                  }
                ],
                seatsToAct: ["seat2"],
                outcome: { status: "in_progress" }
              },
              {
                kind: "chess",
                id: "B",
                firstSeat: "seat2",
                fen: initialChessFen,
                turnColor: "w",
                isCheck: false,
                checkSquare: null,
                moveNumber: 1,
                whiteSeat: "seat2",
                blackSeat: "seat1",
                drawOffer: null,
                squares: createChessSquares(),
                legalMoves: createInitialChessLegalMoves(),
                moveHistory: [],
                seatsToAct: ["seat2"],
                outcome: { status: "in_progress" }
              }
            ]
          }
        }
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Chess lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chess match" }));

    await screen.findByTestId("match-code");
    expect(screen.getByRole("button", { name: "Board A square e8 black king in check" })).toHaveClass(
      "checked-king"
    );

    fireEvent.click(screen.getByRole("button", { name: "Board A review move Rf1" }));

    expect(screen.getByTestId("board-A-chessboard")).toHaveAttribute("data-position-fen", reviewFenWithoutCheck);
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).toHaveTextContent("Review");
    expect(screen.getByLabelText("Board A", { selector: "section.board-panel" })).not.toHaveTextContent("Black in check");
    expect(screen.queryByRole("button", { name: "Board A square e8 black king in check" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board A square e8 black king" })).not.toHaveClass("checked-king");
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

  it("keeps the bot opponent when rematching a completed TicTacToe bot match", async () => {
    const botSession = createTicTacToeSeatSession("match-bot-done");
    const ticTacToeBot = {
      seat: "seat2",
      kind: "random-legal",
      gameType: "tictactoe",
      difficulty: "normal",
      displayName: "TicTacToe Bot"
    };
    botSession.match.joinedSeats = 2;
    botSession.match.players.seat2.name = "TicTacToe Bot";
    botSession.match.outcome = { status: "completed", score: { seat1: 1, seat2: 1 } };
    botSession.match.boards = botSession.match.boards.map((board) => ({
      ...board,
      outcome: { status: "draw", reason: "board-full" }
    }));
    (botSession.match as typeof botSession.match & { automatedSeat: unknown; bot: unknown }).automatedSeat =
      ticTacToeBot;
    (botSession.match as typeof botSession.match & { automatedSeat: unknown; bot: unknown }).bot = ticTacToeBot;
    const fetchMock = createFetchMock({ matches: [], seatSession: botSession });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/matches/match-bot-done");

    render(<App />);

    expect(await screen.findByTestId("match-code")).toHaveAttribute("data-match-id", "match-bot-done");
    fireEvent.click(screen.getByRole("button", { name: "Rematch" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/api/matches") && init?.method === "POST")
      ).toHaveLength(1);
    });
    const createCalls = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).endsWith("/api/matches") && init?.method === "POST"
    );
    expect(createCalls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ gameType: "tictactoe", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      })
    );
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

function createConnectFourSeatSession(id: string) {
  return {
    seat: "seat1",
    match: {
      id,
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
  };
}

function createChessSeatSession(id: string) {
  return {
    seat: "seat1",
    match: {
      id,
      gameType: "chess",
      gameLabel: "Chess",
      seats: ["seat1", "seat2"],
      joinedSeats: 2,
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
          turnColor: "w",
          isCheck: false,
          checkSquare: null,
          moveNumber: 1,
          whiteSeat: "seat1",
          blackSeat: "seat2",
          drawOffer: null,
          squares: createChessSquares(),
          legalMoves: createInitialChessLegalMoves(),
          moveHistory: [],
          seatsToAct: ["seat1"],
          outcome: { status: "in_progress" }
        },
        {
          kind: "chess",
          id: "B",
          firstSeat: "seat2",
          fen: initialChessFen,
          turnColor: "w",
          isCheck: false,
          checkSquare: null,
          moveNumber: 1,
          whiteSeat: "seat2",
          blackSeat: "seat1",
          drawOffer: null,
          squares: createChessSquares(),
          legalMoves: createInitialChessLegalMoves(),
          moveHistory: [],
          seatsToAct: ["seat2"],
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

function createChessSquares(
  overrides: Record<string, { readonly color: "w" | "b"; readonly type: "p" | "n" | "b" | "r" | "q" | "k" } | null> = {}
) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  const backRankPieces = ["r", "n", "b", "q", "k", "b", "n", "r"] as const;
  return ranks.flatMap((rank) =>
    files.map((file, fileIndex) => {
      const square = `${file}${rank}`;
      if (Object.prototype.hasOwnProperty.call(overrides, square)) {
        return { square, piece: overrides[square] ?? null };
      }
      if (rank === "1") return { square, piece: { color: "w", type: backRankPieces[fileIndex] } };
      if (rank === "2") return { square, piece: { color: "w", type: "p" } };
      if (rank === "7") return { square, piece: { color: "b", type: "p" } };
      if (rank === "8") return { square, piece: { color: "b", type: backRankPieces[fileIndex] } };
      return { square, piece: null };
    })
  );
}

function createSparseChessSquares(
  pieces: Record<string, { readonly color: "w" | "b"; readonly type: "p" | "n" | "b" | "r" | "q" | "k" }>
) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  return ranks.flatMap((rank) =>
    files.map((file) => {
      const square = `${file}${rank}`;
      return { square, piece: pieces[square] ?? null };
    })
  );
}

function createInitialChessLegalMoves() {
  return [
    { color: "w", piece: "p", from: "e2", to: "e3", san: "e3", lan: "e2e3" },
    { color: "w", piece: "p", from: "e2", to: "e4", san: "e4", lan: "e2e4" },
    { color: "w", piece: "n", from: "g1", to: "f3", san: "Nf3", lan: "g1f3" }
  ];
}
