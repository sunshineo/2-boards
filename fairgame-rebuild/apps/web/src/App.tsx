import { useEffect, useMemo, useState } from "react";
import { Chessboard, type ChessboardOptions, type PieceDataType } from "react-chessboard";
import { io } from "socket.io-client";

import {
  ApiError,
  createMatch,
  getApiBaseUrl,
  joinMatch,
  listOpenMatches,
  makeMove,
  restoreSession
} from "./api";
import type {
  BreakthroughBoardView,
  BoardId,
  ChessBoardView,
  ConnectFourBoardView,
  DotsBoxesBoardView,
  GameType,
  GomokuBoardView,
  HexBoardView,
  MancalaBoardView,
  MatchBoardView,
  MatchClockView,
  MatchView,
  MovePayload,
  OrderChaosBoardView,
  OpenMatchView,
  ReversiBoardView,
  SeatId,
  SeatSession,
  TicTacToeBoardView
} from "./types";

const gameOptions: readonly {
  readonly gameType: GameType;
  readonly imageAlt: string;
  readonly imageSrc: string;
  readonly label: string;
}[] = [
  {
    gameType: "tictactoe",
    imageAlt: "TicTacToe preview",
    imageSrc: "/game-thumbnails/tictactoe.png",
    label: "TicTacToe"
  },
  {
    gameType: "connect4",
    imageAlt: "Connect Four preview",
    imageSrc: "/game-thumbnails/connect-four.png",
    label: "Connect Four"
  },
  {
    gameType: "chess",
    imageAlt: "Chess preview",
    imageSrc: "/game-thumbnails/chess.png",
    label: "Chess"
  },
  {
    gameType: "gomoku",
    imageAlt: "Gomoku preview",
    imageSrc: "/game-thumbnails/gomoku.svg",
    label: "Gomoku"
  },
  {
    gameType: "hex",
    imageAlt: "Hex preview",
    imageSrc: "/game-thumbnails/hex.svg",
    label: "Hex"
  },
  {
    gameType: "reversi",
    imageAlt: "Reversi preview",
    imageSrc: "/game-thumbnails/reversi.svg",
    label: "Reversi"
  },
  {
    gameType: "breakthrough",
    imageAlt: "Breakthrough preview",
    imageSrc: "/game-thumbnails/breakthrough.svg",
    label: "Breakthrough"
  },
  {
    gameType: "mancala",
    imageAlt: "Mancala preview",
    imageSrc: "/game-thumbnails/mancala.svg",
    label: "Mancala"
  },
  {
    gameType: "dots-boxes",
    imageAlt: "Dots and Boxes preview",
    imageSrc: "/game-thumbnails/dots-boxes.svg",
    label: "Dots and Boxes"
  },
  {
    gameType: "order-chaos",
    imageAlt: "Order and Chaos preview",
    imageSrc: "/game-thumbnails/order-chaos.svg",
    label: "Order and Chaos"
  }
];

const quickTimeOptions: readonly { readonly minutes: number; readonly label: string; readonly pace: string }[] = [
  { minutes: 3, label: "3 min", pace: "Fast" },
  { minutes: 5, label: "5 min", pace: "Normal" },
  { minutes: 10, label: "10 min", pace: "Long" }
];

const gameTimeRanges: Record<GameType, { readonly min: number; readonly max: number }> = {
  tictactoe: { min: 1, max: 10 },
  connect4: { min: 2, max: 20 },
  chess: { min: 3, max: 60 },
  gomoku: { min: 3, max: 30 },
  hex: { min: 3, max: 30 },
  reversi: { min: 2, max: 20 },
  breakthrough: { min: 3, max: 30 },
  mancala: { min: 2, max: 20 },
  "dots-boxes": { min: 3, max: 30 },
  "order-chaos": { min: 3, max: 30 }
};

const recentMatchesKey = "fairgame.recentMatches";

type RecentMatch = {
  readonly id: string;
  readonly gameType: GameType;
  readonly gameLabel: string;
  readonly result: string;
};

type AppRoute =
  | { readonly view: "picker" }
  | { readonly view: "lobby"; readonly gameType: GameType }
  | { readonly view: "match"; readonly matchId: string };

export function App() {
  const [session, setSession] = useState<SeatSession | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromLocation());
  const [openMatches, setOpenMatches] = useState<OpenMatchView[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>(() => loadRecentMatches());
  const [customMinutes, setCustomMinutes] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const lobbyGame = route.view === "lobby" ? route.gameType : null;
  const activeSession = route.view === "match" && session?.match.id === route.matchId ? session : null;

  useEffect(() => {
    const handlePopState = () => {
      setRoute(readRouteFromLocation());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const canonicalUrl = getRouteUrl(route);
    if (window.location.pathname !== canonicalUrl.pathname || window.location.search !== canonicalUrl.search) {
      window.history.replaceState(null, "", canonicalUrl);
    }
  }, [route]);

  useEffect(() => {
    if (route.view !== "match") {
      setSession(null);
      return;
    }

    if (session?.match.id === route.matchId) return;

    let isCurrent = true;
    setIsBusy(true);
    setError(null);
    restoreSession(route.matchId)
      .then((restoredSession) => {
        if (isCurrent) setSession(restoredSession);
      })
      .catch((caught: unknown) => {
        if (isCurrent) setError(caught instanceof Error ? formatError(caught.message) : "Session restore failed.");
      })
      .finally(() => {
        if (isCurrent) setIsBusy(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [route, session?.match.id]);

  useEffect(() => {
    if (session) return;

    let isCurrent = true;
    const refresh = async () => {
      const matches = await loadOpenMatchList();
      if (isCurrent) setOpenMatches(matches);
    };

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 4_000);

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    if (!session?.match.id) return;

    const socket = io(getApiBaseUrl(), {
      withCredentials: true
    });

    socket.emit("watch-match", { matchId: session.match.id });
    socket.on("match:update", (match: MatchView) => {
      setSession((current) => {
        if (!current || current.match.id !== match.id) return current;
        return { ...current, match };
      });
    });

    return () => {
      socket.close();
    };
  }, [session?.match.id]);

  useEffect(() => {
    if (!session) return;
    saveRecentMatch(session.match);
    setRecentMatches(loadRecentMatches());
  }, [session]);

  useEffect(() => {
    if (!lobbyGame) return;
    setCustomMinutes((current) => clampMinutes(current, gameTimeRanges[lobbyGame]));
  }, [lobbyGame]);

  function navigateTo(nextRoute: AppRoute) {
    window.history.pushState(null, "", getRouteUrl(nextRoute));
    setRoute(nextRoute);
  }

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.match && session) {
          setSession({ ...session, match: caught.match });
        }
        setError(formatError(caught.message));
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshOpenMatchList() {
    setOpenMatches(await loadOpenMatchList());
  }

  async function handleCreate(minutes = customMinutes) {
    if (!lobbyGame) return;
    await run(async () => {
      const nextSession = await createMatch(lobbyGame, { clockInitialMs: minutesToMs(minutes, lobbyGame) });
      setSession(nextSession);
      navigateTo({ view: "match", matchId: nextSession.match.id });
    });
  }

  async function handleJoinOpenMatch(matchId: string) {
    await run(async () => {
      const nextSession = await joinMatch(matchId);
      setSession(nextSession);
      navigateTo({ view: "match", matchId: nextSession.match.id });
    });
  }

  async function handleOpenRecent(matchId: string) {
    await run(async () => {
      const nextSession = await restoreSession(matchId);
      setSession(nextSession);
      navigateTo({ view: "match", matchId: nextSession.match.id });
    });
  }

  async function handleRefresh() {
    if (!session) return;
    await run(async () => {
      setSession(await restoreSession(session.match.id));
    });
  }

  async function handleMove(boardId: BoardId, move: MovePayload) {
    if (!session?.seat) return;
    const seat = session.seat;
    await run(async () => {
      setSession({
        ...session,
        match: await makeMove({
          matchId: session.match.id,
          boardId,
          seat,
          move
        })
      });
    });
  }

  async function handleRematch() {
    if (!session) return;
    await run(async () => {
      const nextSession = await createMatch(
        session.match.gameType,
        session.match.clock ? { clockInitialMs: session.match.clock.config.initialMs } : {}
      );
      setSession(nextSession);
      navigateTo({ view: "match", matchId: nextSession.match.id });
    });
  }

  const selectedGameLabel = lobbyGame ? getGameLabel(lobbyGame) : "Game";
  const selectedGameTimeRange = lobbyGame ? gameTimeRanges[lobbyGame] : gameTimeRanges.tictactoe;
  const lobbyOpenMatches = lobbyGame ? openMatches.filter((match) => match.gameType === lobbyGame) : [];
  const lobbyRecentMatches = lobbyGame ? recentMatches.filter((match) => match.gameType === lobbyGame) : [];
  const activeGameType = activeSession?.match.gameType ?? lobbyGame;
  const showMatchLoading = route.view === "match" && !activeSession;

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">FairGame</p>
          <h1>Two-board fair games</h1>
        </div>
        <div className="top-actions">
          <nav className="top-nav" aria-label="Primary navigation">
            <button
              className="secondary-button compact-button"
              disabled={route.view === "picker"}
              onClick={() => navigateTo({ view: "picker" })}
              type="button"
            >
              Games
            </button>
            {activeGameType ? (
              <button
                className="secondary-button compact-button"
                disabled={route.view === "lobby" && lobbyGame === activeGameType}
                onClick={() => navigateTo({ view: "lobby", gameType: activeGameType })}
                type="button"
              >
                {getGameLabel(activeGameType)} lobby
              </button>
            ) : null}
            {activeSession ? (
              <button className="secondary-button compact-button" disabled type="button">
                Match
              </button>
            ) : null}
          </nav>
          {activeSession ? (
            <button className="secondary-button compact-button" onClick={handleRefresh} disabled={isBusy}>
              Refresh
            </button>
          ) : null}
        </div>
      </header>

      {activeSession ? (
        <MatchRoom
          match={activeSession.match}
          seat={activeSession.seat}
          onMove={handleMove}
          onRematch={handleRematch}
          isBusy={isBusy}
        />
      ) : showMatchLoading ? (
        <section className="panel" aria-label="Loading match">
          <h2>Loading match</h2>
          <p>{isBusy ? "Restoring match..." : "Unable to load this match."}</p>
        </section>
      ) : lobbyGame ? (
        <section className="lobby-grid" aria-label={`${selectedGameLabel} lobby`}>
          <section className="panel create-panel">
            <div className="panel-title-row lobby-title-row">
              <h2>{selectedGameLabel} lobby</h2>
              <button
                className="secondary-button compact-button"
                onClick={() => navigateTo({ view: "picker" })}
                type="button"
              >
                Back
              </button>
            </div>
            <section className="quick-pairing" aria-label="Quick pairing">
              <h3>Quick pairing</h3>
              <div className="quick-time-grid">
                {quickTimeOptions.map((option) => (
                  <button
                    aria-label={`Create ${option.minutes} minute ${selectedGameLabel} match`}
                    className="time-preset-button"
                    disabled={isBusy}
                    key={option.minutes}
                    onClick={() => void handleCreate(option.minutes)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.pace}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="custom-create" aria-label="Create custom game">
              <h3>Create game</h3>
              <div className="minutes-row">
                <label htmlFor="custom-minutes">Minutes</label>
                <span className="range-hint">{selectedGameTimeRange.min}-{selectedGameTimeRange.max} min</span>
              </div>
              <div className="minutes-stepper">
                <button
                  aria-label="Decrease minutes"
                  className="stepper-button"
                  disabled={customMinutes <= selectedGameTimeRange.min}
                  onClick={() => setCustomMinutes(clampMinutes(customMinutes - 1, selectedGameTimeRange))}
                  type="button"
                >
                  -
                </button>
                <input
                  className="minutes-input"
                  id="custom-minutes"
                  max={selectedGameTimeRange.max}
                  min={selectedGameTimeRange.min}
                  onChange={(event) =>
                    setCustomMinutes(parseMinutesInput(event.target.value, selectedGameTimeRange))
                  }
                  type="number"
                  value={customMinutes}
                />
                <span className="minutes-unit">min</span>
                <button
                  aria-label="Increase minutes"
                  className="stepper-button"
                  disabled={customMinutes >= selectedGameTimeRange.max}
                  onClick={() => setCustomMinutes(clampMinutes(customMinutes + 1, selectedGameTimeRange))}
                  type="button"
                >
                  +
                </button>
              </div>
            </section>
            <button className="primary-button" onClick={() => void handleCreate()} disabled={isBusy}>
              Create {selectedGameLabel} match
            </button>
          </section>
          <section className="panel open-games-panel" aria-label="Open games">
            <div className="panel-title-row">
              <h2>Open games</h2>
              <button
                className="secondary-button compact-button"
                onClick={() => void refreshOpenMatchList()}
                disabled={isBusy}
                type="button"
              >
                Refresh
              </button>
            </div>
            {lobbyOpenMatches.length === 0 ? (
              <p className="empty-state">No open games.</p>
            ) : (
              <div className="open-games-list">
                {lobbyOpenMatches.map((match, index) => (
                  <button
                    aria-label={`Join ${formatListedMatchLabel(`${match.gameLabel} game`, index)}`}
                    className="open-match"
                    data-match-id={match.id}
                    disabled={isBusy}
                    key={match.id}
                    onClick={() => void handleJoinOpenMatch(match.id)}
                    type="button"
                  >
                    <span className="open-match-game">{match.gameLabel}</span>
                    <strong>{formatListedMatchLabel("Open game", index)}</strong>
                    <span>{formatTimeControl(match)}</span>
                    <span>
                      {match.joinedSeats}/{match.maxSeats} seated
                    </span>
                    <span className="open-match-action">Join</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          {lobbyRecentMatches.length > 0 ? (
            <section className="panel recent-panel" aria-label="Recent matches">
              <h2>Recent matches</h2>
              {lobbyRecentMatches.map((match, index) => (
                <button
                  aria-label={`Open recent ${formatListedMatchLabel(`${match.gameLabel} game`, index)}`}
                  className="recent-match"
                  data-match-id={match.id}
                  key={match.id}
                  onClick={() => void handleOpenRecent(match.id)}
                  type="button"
                >
                  <span>{match.gameLabel}</span>
                  <strong>{formatListedMatchLabel("Recent game", index)}</strong>
                  <span>{match.result}</span>
                  <span className="sr-only">
                    Open recent {formatListedMatchLabel(`${match.gameLabel} game`, index)}
                  </span>
                </button>
              ))}
            </section>
          ) : null}
        </section>
      ) : (
        <section className="game-picker" aria-label="Choose game">
          {gameOptions.map((option) => (
            <button
              aria-label={`${option.label} lobby`}
              className="game-choice"
              key={option.gameType}
              onClick={() => navigateTo({ view: "lobby", gameType: option.gameType })}
              type="button"
            >
              <img alt={option.imageAlt} className="game-choice-image" src={option.imageSrc} />
              <span>{option.label}</span>
              <strong>Enter lobby</strong>
            </button>
          ))}
        </section>
      )}

      {error ? <p className="error-banner">{error}</p> : null}
    </main>
  );
}

function MatchRoom(props: {
  match: MatchView;
  seat: SeatId | null;
  onMove: (boardId: BoardId, move: MovePayload) => void;
  onRematch: () => void;
  isBusy: boolean;
}) {
  const status = formatMatchStatus(props.match, props.seat);
  const canRematch = props.match.outcome.status !== "in_progress";

  return (
    <section className="match-room" aria-label={`${props.match.gameLabel} match`}>
      <div className="match-summary">
        <div>
          <span className="meta-label">Game</span>
          <strong data-testid="match-code" data-match-id={props.match.id}>
            {props.match.gameLabel}
          </strong>
        </div>
        <div>
          <span className="meta-label">Score</span>
          <strong>{formatScore(props.match)}</strong>
        </div>
        <div>
          <span className="meta-label">Status</span>
          <strong>{status}</strong>
        </div>
      </div>

      {canRematch ? (
        <div className="match-actions">
          <button className="primary-button" onClick={props.onRematch} type="button">
            Rematch
          </button>
        </div>
      ) : null}

      <ClockStrip clock={props.match.clock} currentSeat={props.seat} />

      <div className="boards-grid">
        {props.match.boards.map((board) => (
          <BoardRenderer
            board={board}
            currentSeat={props.seat}
            isBusy={props.isBusy}
            key={board.id}
            onMove={(move) => props.onMove(board.id, move)}
          />
        ))}
      </div>
    </section>
  );
}

function ClockStrip(props: { clock: MatchClockView | null; currentSeat: SeatId | null }) {
  const snapshotReceivedAtMs = useMemo(() => Date.now(), [props.clock]);
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const hasRunningClock = props.clock?.status === "active" && props.clock.runningSeats.length > 0;

  useEffect(() => {
    setClientNowMs(Date.now());
    if (!hasRunningClock) return;

    const tick = window.setInterval(() => {
      setClientNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(tick);
    };
  }, [hasRunningClock, props.clock]);

  const clock = props.clock;
  if (!clock) return null;

  return (
    <section className="clock-strip" aria-label="Clocks">
      {getClockSeatOrder(props.currentSeat).map((seat) => {
        const seatClock = clock.seats[seat];
        const remainingMs = getProjectedClockRemainingMs(clock, seat, snapshotReceivedAtMs, clientNowMs);
        const label = formatRelativeSeat(seat, props.currentSeat);
        return (
          <div
            aria-label={`${label} clock`}
            className={`clock-card${seatClock?.isRunning ? " running" : ""}`}
            key={seat}
          >
            <span className="meta-label">{label}</span>
            <strong>{formatClockMs(remainingMs)}</strong>
            <span>{seatClock?.isRunning ? "Running" : "Paused"}</span>
          </div>
        );
      })}
    </section>
  );
}

function BoardRenderer(props: {
  board: MatchBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (move: MovePayload) => void;
}) {
  if (props.board.kind === "connect4") {
    return (
      <ConnectFourBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        onMove={(column) => props.onMove({ column })}
      />
    );
  }

  if (props.board.kind === "chess") {
    return (
      <ChessBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        onMove={(move) => props.onMove(move)}
      />
    );
  }

  if (props.board.kind === "gomoku") {
    return (
      <PlacementGridBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        label="Gomoku"
        onMove={(cell) => props.onMove({ cell })}
      />
    );
  }

  if (props.board.kind === "hex") {
    return (
      <HexBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        onMove={(cell) => props.onMove({ cell })}
      />
    );
  }

  if (props.board.kind === "reversi") {
    return (
      <ReversiBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        onMove={(cell) => props.onMove({ cell })}
      />
    );
  }

  if (props.board.kind === "breakthrough") {
    return (
      <BreakthroughBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        onMove={(move) => props.onMove(move)}
      />
    );
  }

  if (props.board.kind === "mancala") {
    return (
      <MancalaBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        onMove={(pit) => props.onMove({ pit })}
      />
    );
  }

  if (props.board.kind === "dots-boxes") {
    return (
      <DotsBoxesBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        onMove={(edge) => props.onMove({ edge })}
      />
    );
  }

  if (props.board.kind === "order-chaos") {
    return (
      <OrderChaosBoard
        board={props.board}
        currentSeat={props.currentSeat}
        isBusy={props.isBusy}
        onMove={(move) => props.onMove(move)}
      />
    );
  }

  return (
    <TicTacToeBoard
      board={props.board}
      currentSeat={props.currentSeat}
      isBusy={props.isBusy}
      onMove={(cell) => props.onMove({ cell })}
    />
  );
}

function ChessBoard(props: {
  board: ChessBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (move: { from: string; to: string; promotion?: "q" }) => void;
}) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const canAct =
    props.currentSeat !== null &&
    props.board.outcome.status === "in_progress" &&
    props.board.seatsToAct.includes(props.currentSeat);

  useEffect(() => {
    if (!canAct) setSelectedSquare(null);
  }, [canAct, props.board.fen]);

  function handleSquareClick(square: string, piece: PieceDataType | null) {
    if (!canAct) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      props.onMove({ from: selectedSquare, to: square, promotion: "q" });
      setSelectedSquare(null);
      return;
    }

    if (piece && getPieceSeatFromPieceType(props.board, piece.pieceType) === props.currentSeat) {
      setSelectedSquare(square);
    }
  }

  const chessboardOptions: ChessboardOptions = {
    id: `board-${props.board.id}-chessboard`,
    position: getChessboardPosition(props.board.fen),
    boardOrientation: getChessboardOrientation(props.board, props.currentSeat),
    allowDragging: canAct && !props.isBusy,
    showNotation: true,
    squareStyles: selectedSquare
      ? {
          [selectedSquare]: {
            boxShadow: "inset 0 0 0 3px #b74f2a"
          }
        }
      : {},
    canDragPiece({ piece }) {
      return canAct && !props.isBusy && getPieceSeatFromPieceType(props.board, piece.pieceType) === props.currentSeat;
    },
    onPieceDrop({ sourceSquare, targetSquare }) {
      if (!canAct || props.isBusy || !targetSquare || sourceSquare === targetSquare) return false;
      props.onMove({ from: sourceSquare, to: targetSquare, promotion: "q" });
      setSelectedSquare(null);
      return true;
    },
    onSquareClick({ piece, square }) {
      handleSquareClick(square, piece);
    },
    squareRenderer({ piece, square, children }) {
      return (
        <button
          aria-label={formatChessSquareLabel(props.board.id, square, piece)}
          className="react-chessboard-square-button"
          disabled={props.isBusy || !canAct}
          type="button"
        >
          {children}
        </button>
      );
    }
  };

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <div className="board-heading">
        <h2>Board {props.board.id}</h2>
        <p>{canAct ? "Your move" : formatBoardStatus(props.board, props.currentSeat)}</p>
      </div>
      <div
        className="react-chessboard-shell"
        data-board-id={props.board.id}
        data-interactive={canAct && !props.isBusy ? "true" : "false"}
        data-testid={`board-${props.board.id}-chessboard`}
      >
        <Chessboard options={chessboardOptions} />
      </div>
    </section>
  );
}

function TicTacToeBoard(props: {
  board: TicTacToeBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (cell: number) => void;
}) {
  const canAct =
    props.currentSeat !== null &&
    props.board.outcome.status === "in_progress" &&
    props.board.seatsToAct.includes(props.currentSeat);

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <div className="board-heading">
        <h2>Board {props.board.id}</h2>
        <p>{canAct ? "Your move" : formatBoardStatus(props.board, props.currentSeat)}</p>
      </div>
      <div className="tic-tac-toe-grid">
        {props.board.cells.map((cell, index) => (
          <button
            aria-label={`Board ${props.board.id} cell ${index + 1}`}
            className="cell-button"
            disabled={props.isBusy || !canAct || cell !== null}
            key={index}
            onClick={() => props.onMove(index)}
          >
            {cell ? formatMark(cell) : ""}
          </button>
        ))}
      </div>
    </section>
  );
}

function ConnectFourBoard(props: {
  board: ConnectFourBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (column: number) => void;
}) {
  const canAct =
    props.currentSeat !== null &&
    props.board.outcome.status === "in_progress" &&
    props.board.seatsToAct.includes(props.currentSeat);
  const columns = Array.from({ length: props.board.columns }, (_, column) => column);
  const rows = Array.from({ length: props.board.rows }, (_, row) => row);

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <div className="board-heading">
        <h2>Board {props.board.id}</h2>
        <p>{canAct ? "Your move" : formatBoardStatus(props.board, props.currentSeat)}</p>
      </div>
      <div className="connect-four-grid">
        {columns.map((column) => (
          <button
            aria-label={`Board ${props.board.id} column ${column + 1}`}
            className="connect-four-column"
            disabled={
              props.isBusy || !canAct || !props.board.playableColumns.includes(column)
            }
            key={column}
            onClick={() => props.onMove(column)}
          >
            {rows.map((row) => {
              const cell = props.board.cells[row * props.board.columns + column];
              return (
                <span
                  className={`connect-four-slot${cell ? ` occupied ${cell}` : ""}`}
                  key={row}
                >
                  {cell ? formatMark(cell) : ""}
                </span>
              );
            })}
          </button>
        ))}
      </div>
    </section>
  );
}

function PlacementGridBoard(props: {
  board: GomokuBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  label: string;
  onMove: (cell: number) => void;
}) {
  const canAct = canCurrentSeatAct(props.board, props.currentSeat);

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <BoardHeading board={props.board} currentSeat={props.currentSeat} canAct={canAct} />
      <div
        className="placement-grid gomoku-grid"
        style={{ gridTemplateColumns: `repeat(${props.board.columns}, minmax(0, 1fr))` }}
      >
        {props.board.cells.map((cell, index) => (
          <button
            aria-label={`Board ${props.board.id} ${props.label} cell ${index + 1}`}
            className={`stone-cell${cell ? ` occupied ${cell}` : ""}`}
            disabled={props.isBusy || !canAct || !props.board.playableCells.includes(index)}
            key={index}
            onClick={() => props.onMove(index)}
            type="button"
          >
            {cell ? formatMark(cell) : ""}
          </button>
        ))}
      </div>
    </section>
  );
}

function HexBoard(props: {
  board: HexBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (cell: number) => void;
}) {
  const canAct = canCurrentSeatAct(props.board, props.currentSeat);

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <BoardHeading board={props.board} currentSeat={props.currentSeat} canAct={canAct} />
      <div className="hex-grid" style={{ gridTemplateColumns: `repeat(${props.board.size}, minmax(0, 1fr))` }}>
        {props.board.cells.map((cell, index) => (
          <button
            aria-label={`Board ${props.board.id} Hex cell ${index + 1}`}
            className={`hex-cell${cell ? ` occupied ${cell}` : ""}`}
            disabled={props.isBusy || !canAct || !props.board.playableCells.includes(index)}
            key={index}
            onClick={() => props.onMove(index)}
            style={{ marginLeft: `${Math.floor(index / props.board.size) * 8}px` }}
            type="button"
          >
            {cell ? formatMark(cell) : ""}
          </button>
        ))}
      </div>
    </section>
  );
}

function ReversiBoard(props: {
  board: ReversiBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (cell: number) => void;
}) {
  const canAct = canCurrentSeatAct(props.board, props.currentSeat);

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <BoardHeading board={props.board} currentSeat={props.currentSeat} canAct={canAct} />
      <div
        className="placement-grid reversi-grid"
        style={{ gridTemplateColumns: `repeat(${props.board.columns}, minmax(0, 1fr))` }}
      >
        {props.board.cells.map((cell, index) => (
          <button
            aria-label={`Board ${props.board.id} Reversi cell ${index + 1}`}
            className={`stone-cell reversi-cell${cell ? ` occupied ${cell}` : ""}`}
            disabled={props.isBusy || !canAct || !props.board.playableCells.includes(index)}
            key={index}
            onClick={() => props.onMove(index)}
            type="button"
          >
            {cell ? formatMark(cell) : props.board.playableCells.includes(index) ? "." : ""}
          </button>
        ))}
      </div>
    </section>
  );
}

function BreakthroughBoard(props: {
  board: BreakthroughBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (move: { from: number; to: number }) => void;
}) {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const canAct = canCurrentSeatAct(props.board, props.currentSeat);
  const targetCells = selectedCell === null ? [] : props.board.playableMoves.filter((move) => move.from === selectedCell).map((move) => move.to);

  useEffect(() => {
    if (!canAct) setSelectedCell(null);
  }, [canAct, props.board.cells]);

  function handleCellClick(index: number) {
    if (!canAct || !props.currentSeat) return;

    if (selectedCell !== null && targetCells.includes(index)) {
      props.onMove({ from: selectedCell, to: index });
      setSelectedCell(null);
      return;
    }

    if (props.board.cells[index] === props.currentSeat) {
      setSelectedCell(index === selectedCell ? null : index);
    }
  }

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <BoardHeading board={props.board} currentSeat={props.currentSeat} canAct={canAct} />
      <div
        className="placement-grid breakthrough-grid"
        style={{ gridTemplateColumns: `repeat(${props.board.columns}, minmax(0, 1fr))` }}
      >
        {props.board.cells.map((cell, index) => {
          const isSelectable = canAct && cell === props.currentSeat;
          const isTarget = targetCells.includes(index);
          return (
            <button
              aria-label={`Board ${props.board.id} Breakthrough cell ${index + 1}${cell ? ` ${cell}` : " empty"}`}
              className={`square-cell${cell ? ` occupied ${cell}` : ""}${selectedCell === index ? " selected" : ""}${isTarget ? " target" : ""}`}
              disabled={props.isBusy || !canAct || (!isSelectable && !isTarget)}
              key={index}
              onClick={() => handleCellClick(index)}
              type="button"
            >
              {cell ? formatPawn(cell) : ""}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MancalaBoard(props: {
  board: MancalaBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (pit: number) => void;
}) {
  const canAct = canCurrentSeatAct(props.board, props.currentSeat);
  const topPits = props.board.pits.slice(props.board.pitsPerSide).map((stones, index) => ({
    seat: "seat2" as const,
    localPit: index,
    stones
  }));
  const bottomPits = props.board.pits.slice(0, props.board.pitsPerSide).map((stones, index) => ({
    seat: "seat1" as const,
    localPit: index,
    stones
  }));

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <BoardHeading board={props.board} currentSeat={props.currentSeat} canAct={canAct} />
      <div className="mancala-board">
        <div className="mancala-store" aria-label={`Board ${props.board.id} seat2 store`}>
          {props.board.stores.seat2}
        </div>
        <div className="mancala-pits">
          {[...topPits].reverse().map((pit) => (
            <MancalaPitButton
              board={props.board}
              canAct={canAct}
              currentSeat={props.currentSeat}
              isBusy={props.isBusy}
              key={`${pit.seat}-${pit.localPit}`}
              onMove={props.onMove}
              pit={pit}
            />
          ))}
          {bottomPits.map((pit) => (
            <MancalaPitButton
              board={props.board}
              canAct={canAct}
              currentSeat={props.currentSeat}
              isBusy={props.isBusy}
              key={`${pit.seat}-${pit.localPit}`}
              onMove={props.onMove}
              pit={pit}
            />
          ))}
        </div>
        <div className="mancala-store" aria-label={`Board ${props.board.id} seat1 store`}>
          {props.board.stores.seat1}
        </div>
      </div>
    </section>
  );
}

function MancalaPitButton(props: {
  board: MancalaBoardView;
  pit: { readonly seat: SeatId; readonly localPit: number; readonly stones: number };
  currentSeat: SeatId | null;
  canAct: boolean;
  isBusy: boolean;
  onMove: (pit: number) => void;
}) {
  const canPlayPit =
    props.canAct &&
    props.currentSeat === props.pit.seat &&
    props.board.playablePits.includes(props.pit.localPit);

  return (
    <button
      aria-label={`Board ${props.board.id} ${props.pit.seat} pit ${props.pit.localPit + 1}`}
      className="mancala-pit"
      disabled={props.isBusy || !canPlayPit}
      onClick={() => props.onMove(props.pit.localPit)}
      type="button"
    >
      {props.pit.stones}
    </button>
  );
}

function DotsBoxesBoard(props: {
  board: DotsBoxesBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (edge: string) => void;
}) {
  const canAct = canCurrentSeatAct(props.board, props.currentSeat);
  const edges = getDotsBoxesEdges(props.board);

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <BoardHeading board={props.board} currentSeat={props.currentSeat} canAct={canAct} />
      <div className="dots-score">
        <span>{props.board.scores.seat1}</span>
        <span>{props.board.scores.seat2}</span>
      </div>
      <div className="dots-edges">
        {edges.map((edge) => (
          <button
            aria-label={`Board ${props.board.id} edge ${edge}`}
            className={`edge-button ${edge.startsWith("h") ? "horizontal" : "vertical"}${props.board.drawnEdges.includes(edge) ? " drawn" : ""}`}
            disabled={props.isBusy || !canAct || !props.board.playableEdges.includes(edge)}
            key={edge}
            onClick={() => props.onMove(edge)}
            type="button"
          >
            {props.board.drawnEdges.includes(edge) ? "-" : ""}
          </button>
        ))}
      </div>
    </section>
  );
}

function OrderChaosBoard(props: {
  board: OrderChaosBoardView;
  currentSeat: SeatId | null;
  isBusy: boolean;
  onMove: (move: { cell: number; mark: "X" | "O" }) => void;
}) {
  const [selectedMark, setSelectedMark] = useState<"X" | "O">("X");
  const canAct = canCurrentSeatAct(props.board, props.currentSeat);

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <BoardHeading board={props.board} currentSeat={props.currentSeat} canAct={canAct} />
      <div className="mark-toggle" aria-label={`Board ${props.board.id} mark choice`}>
        {(["X", "O"] as const).map((mark) => (
          <button
            aria-pressed={selectedMark === mark}
            className="mark-button"
            disabled={!canAct}
            key={mark}
            onClick={() => setSelectedMark(mark)}
            type="button"
          >
            {mark}
          </button>
        ))}
      </div>
      <div
        className="placement-grid order-chaos-grid"
        style={{ gridTemplateColumns: `repeat(${props.board.columns}, minmax(0, 1fr))` }}
      >
        {props.board.cells.map((cell, index) => (
          <button
            aria-label={`Board ${props.board.id} Order and Chaos cell ${index + 1}`}
            className={`square-cell mark-cell${cell ? " occupied" : ""}`}
            disabled={props.isBusy || !canAct || !props.board.playableCells.includes(index)}
            key={index}
            onClick={() => props.onMove({ cell: index, mark: selectedMark })}
            type="button"
          >
            {cell ?? ""}
          </button>
        ))}
      </div>
    </section>
  );
}

function BoardHeading(props: { board: MatchBoardView; currentSeat: SeatId | null; canAct: boolean }) {
  return (
    <div className="board-heading">
      <h2>Board {props.board.id}</h2>
      <p>{props.canAct ? "Your move" : formatBoardStatus(props.board, props.currentSeat)}</p>
    </div>
  );
}

function getGameLabel(gameType: GameType) {
  return gameOptions.find((option) => option.gameType === gameType)?.label ?? "Game";
}

function parseMinutesInput(value: string, range: { readonly min: number; readonly max: number }) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return range.min;
  return clampMinutes(parsed, range);
}

function clampMinutes(minutes: number, range: { readonly min: number; readonly max: number }) {
  return Math.min(range.max, Math.max(range.min, minutes));
}

function minutesToMs(minutes: number, gameType: GameType) {
  return clampMinutes(minutes, gameTimeRanges[gameType]) * 60_000;
}

function formatTimeControl(match: OpenMatchView) {
  if (!match.clockInitialMs) return "Untimed";
  const minutes = Math.round(match.clockInitialMs / 60_000);
  return `${minutes} min`;
}

function formatListedMatchLabel(baseLabel: string, index: number) {
  return `${baseLabel} ${index + 1}`;
}

function formatMark(seat: SeatId) {
  return seat === "seat1" ? "X" : "O";
}

function formatPawn(seat: SeatId) {
  return seat === "seat1" ? "▲" : "▼";
}

function canCurrentSeatAct(board: MatchBoardView, currentSeat: SeatId | null) {
  return currentSeat !== null && board.outcome.status === "in_progress" && board.seatsToAct.includes(currentSeat);
}

function getDotsBoxesEdges(board: DotsBoxesBoardView) {
  const edges: string[] = [];
  for (let row = 0; row <= board.boxRows; row += 1) {
    for (let column = 0; column < board.boxColumns; column += 1) {
      edges.push(`h-${row}-${column}`);
    }
  }

  for (let row = 0; row < board.boxRows; row += 1) {
    for (let column = 0; column <= board.boxColumns; column += 1) {
      edges.push(`v-${row}-${column}`);
    }
  }

  return edges;
}

const startingChessFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function getChessboardPosition(fen: string) {
  return fen === "start" ? startingChessFen : fen;
}

function getChessboardOrientation(board: ChessBoardView, seat: SeatId | null) {
  return seat && board.blackSeat === seat ? "black" : "white";
}

function formatChessSquareLabel(boardId: BoardId, square: string, piece: PieceDataType | null) {
  if (!piece) return `Board ${boardId} square ${square} empty`;
  return `Board ${boardId} square ${square} ${formatChessPieceType(piece.pieceType)}`;
}

function getPieceSeatFromPieceType(board: ChessBoardView, pieceType: string) {
  return pieceType.startsWith("w") ? board.whiteSeat : board.blackSeat;
}

function formatChessPieceType(pieceType: string) {
  const color = pieceType.startsWith("w") ? "white" : "black";
  const piece = pieceType.slice(1).toLowerCase();
  const names: Record<string, string> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king"
  };
  return `${color} ${names[piece] ?? "piece"}`;
}

function formatClockMs(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getProjectedClockRemainingMs(
  clock: MatchClockView,
  seat: SeatId,
  snapshotReceivedAtMs: number,
  clientNowMs: number
) {
  const seatClock = clock.seats[seat];
  if (clock.status !== "active" || !seatClock.isRunning) return seatClock.remainingMs;

  const elapsedMs = Math.max(0, clientNowMs - snapshotReceivedAtMs);
  return Math.max(0, seatClock.remainingMs - elapsedMs);
}

function getClockSeatOrder(currentSeat: SeatId | null): SeatId[] {
  if (!currentSeat) return ["seat1", "seat2"];
  return [currentSeat, getOtherSeat(currentSeat)];
}

function getOtherSeat(seat: SeatId): SeatId {
  return seat === "seat1" ? "seat2" : "seat1";
}

function formatRelativeSeat(seat: SeatId, currentSeat: SeatId | null) {
  if (!currentSeat) return seat === "seat1" ? "Clock A" : "Clock B";
  return seat === currentSeat ? "You" : "Opponent";
}

function formatBoardStatus(board: MatchBoardView, currentSeat: SeatId | null) {
  if (board.outcome.status === "win") {
    if (!currentSeat) return "Won";
    return board.outcome.winner === currentSeat ? "You won" : "Opponent won";
  }
  if (board.outcome.status === "draw") return "Draw";
  if (board.outcome.status === "canceled") return "Canceled";
  if (board.seatsToAct.length === 0) return "Waiting";
  if (!currentSeat) return "Move pending";
  return board.seatsToAct.includes(currentSeat) ? "Your move" : "Opponent to move";
}

function formatScore(match: MatchView) {
  if (match.outcome.status === "canceled") return "Canceled";
  return `${match.outcome.score.seat1} - ${match.outcome.score.seat2}`;
}

function formatMatchOutcome(match: MatchView, currentSeat: SeatId | null = null) {
  if (match.outcome.status === "canceled") return "Canceled";
  if (match.outcome.status === "in_progress") return "In progress";
  if (match.outcome.winner === null) return "Draw match";
  if (!currentSeat) return "Win decided";
  return match.outcome.winner === currentSeat ? "You win" : "Opponent wins";
}

function isMatchWaitingForPlayers(match: MatchView) {
  return match.outcome.status === "in_progress" && match.joinedSeats < match.maxSeats;
}

function formatMatchStatus(match: MatchView, currentSeat: SeatId | null = null) {
  if (!isMatchWaitingForPlayers(match)) return formatMatchOutcome(match, currentSeat);
  return match.maxSeats === 2 && match.joinedSeats === 1 ? "Waiting for opponent" : "Waiting for players";
}

function formatError(error: string) {
  return error.replaceAll("-", " ");
}

function readRouteFromLocation(location: Location = window.location): AppRoute {
  const [section, id] = location.pathname.split("/").filter(Boolean);
  if (section === "matches" && id) return { view: "match", matchId: decodeURIComponent(id) };
  if (section === "games" && isGameType(id)) return { view: "lobby", gameType: id };

  const searchParams = new URLSearchParams(location.search);
  const matchId = searchParams.get("match");
  if (matchId) return { view: "match", matchId };

  const gameType = searchParams.get("game");
  if (isGameType(gameType)) return { view: "lobby", gameType };

  return { view: "picker" };
}

function getRouteUrl(route: AppRoute) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";

  if (route.view === "picker") {
    url.pathname = "/";
  }

  if (route.view === "lobby") {
    url.pathname = `/games/${route.gameType}`;
  }

  if (route.view === "match") {
    url.pathname = `/matches/${encodeURIComponent(route.matchId)}`;
  }

  return url;
}

function isGameType(candidate: string | null | undefined): candidate is GameType {
  return gameOptions.some((option) => option.gameType === candidate);
}

function loadRecentMatches(): RecentMatch[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentMatchesKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .flatMap((candidate): RecentMatch[] => {
        if (!isRecentMatchRecord(candidate)) return [];
        const gameType = getRecentMatchGameType(candidate);
        if (!gameType) return [];
        return [
          {
            id: candidate.id,
            gameType,
            gameLabel: candidate.gameLabel,
            result: candidate.result
          }
        ];
      })
      .slice(0, 5);
  } catch {
    return [];
  }
}

function saveRecentMatch(match: MatchView) {
  const next = [
    { id: match.id, gameType: match.gameType, gameLabel: match.gameLabel, result: formatMatchOutcome(match) },
    ...loadRecentMatches().filter((candidate) => candidate.id !== match.id)
  ].slice(0, 5);
  localStorage.setItem(recentMatchesKey, JSON.stringify(next));
}

function isRecentMatchRecord(candidate: unknown): candidate is {
  readonly id: string;
  readonly gameType?: unknown;
  readonly gameLabel: string;
  readonly result: string;
} {
  if (!candidate || typeof candidate !== "object") return false;
  const record = candidate as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.gameLabel === "string" && typeof record.result === "string";
}

function getRecentMatchGameType(candidate: {
  readonly gameType?: unknown;
  readonly gameLabel: string;
}): GameType | null {
  const gameType = typeof candidate.gameType === "string" ? candidate.gameType : null;
  if (isGameType(gameType)) {
    return gameType;
  }

  return gameOptions.find((option) => option.label === candidate.gameLabel)?.gameType ?? null;
}

async function loadOpenMatchList(): Promise<OpenMatchView[]> {
  try {
    return await listOpenMatches();
  } catch {
    return [];
  }
}
