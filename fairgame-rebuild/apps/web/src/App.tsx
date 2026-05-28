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
  BoardId,
  ChessBoardView,
  ConnectFourBoardView,
  GameType,
  MatchBoardView,
  MatchClockView,
  MatchView,
  MovePayload,
  OpenMatchView,
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
  chess: { min: 3, max: 60 }
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
  const [copiedInvite, setCopiedInvite] = useState(false);
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
      setCopiedInvite(false);
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
    setCopiedInvite(false);
  }, [session?.match.id]);

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

  async function handleCopyInvite() {
    if (!session) return;
    const inviteUrl = getInviteUrl(session.match.id);
    const copied = await copyTextToClipboard(inviteUrl);
    if (copied) {
      setCopiedInvite(true);
      return;
    }
    setError("Unable to copy invite link.");
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
      setCopiedInvite(false);
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
          onCopyInvite={handleCopyInvite}
          onRematch={handleRematch}
          copiedInvite={copiedInvite}
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
  onCopyInvite: () => void;
  onRematch: () => void;
  copiedInvite: boolean;
  isBusy: boolean;
}) {
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
          <span className="meta-label">Your seat</span>
          <strong>{props.seat ? formatPlayer(props.match, props.seat) : "Spectator"}</strong>
        </div>
        <div>
          <span className="meta-label">Invite</span>
          <strong data-testid="invite-url" data-invite-url={getInviteUrl(props.match.id)}>
            Use Copy invite
          </strong>
        </div>
        <div>
          <span className="meta-label">Score</span>
          <strong>{formatScore(props.match)}</strong>
        </div>
        <div>
          <span className="meta-label">Result</span>
          <strong>{formatMatchOutcome(props.match)}</strong>
        </div>
      </div>

      <div className="match-actions">
        <button className="secondary-button" onClick={props.onCopyInvite} type="button">
          {props.copiedInvite ? "Copied" : "Copy invite"}
        </button>
        {props.match.outcome.status !== "in_progress" ? (
          <button className="primary-button" onClick={props.onRematch} type="button">
            Rematch
          </button>
        ) : null}
      </div>

      <ClockStrip clock={props.match.clock} />

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

function ClockStrip(props: { clock: MatchClockView | null }) {
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
    <section className="clock-strip" aria-label="Player clocks">
      {(["seat1", "seat2"] as const).map((seat) => {
        const seatClock = clock.seats[seat];
        const remainingMs = getProjectedClockRemainingMs(clock, seat, snapshotReceivedAtMs, clientNowMs);
        return (
          <div
            aria-label={`${formatSeat(seat)} clock`}
            className={`clock-card${seatClock?.isRunning ? " running" : ""}`}
            key={seat}
          >
            <span className="meta-label">{formatSeat(seat)}</span>
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
        <p>{canAct ? "Your move" : formatBoardStatus(props.board)}</p>
      </div>
      <div className="chess-layout">
        <div
          className="react-chessboard-shell"
          data-board-id={props.board.id}
          data-interactive={canAct && !props.isBusy ? "true" : "false"}
          data-testid={`board-${props.board.id}-chessboard`}
        >
          <Chessboard options={chessboardOptions} />
        </div>
        <div className="move-history" aria-label={`Board ${props.board.id} move history`} role="region">
          <h3>Moves</h3>
          {props.board.moveHistory.length === 0 ? (
            <p>No moves</p>
          ) : (
            <ol>
              {props.board.moveHistory.map((move, index) => (
                <li key={`${move.lan}-${index}`}>{move.san}</li>
              ))}
            </ol>
          )}
        </div>
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
        <p>{canAct ? "Your move" : formatBoardStatus(props.board)}</p>
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
        <p>{canAct ? "Your move" : formatBoardStatus(props.board)}</p>
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

function formatSeat(seat: SeatId) {
  return seat === "seat1" ? "Player 1" : "Player 2";
}

function formatPlayer(match: MatchView, seat: SeatId) {
  const player = match.players[seat];
  return player.name === player.label ? player.label : `${player.name} (${player.label})`;
}

function formatMark(seat: SeatId) {
  return seat === "seat1" ? "X" : "O";
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

function formatBoardStatus(board: MatchBoardView) {
  if (board.outcome.status === "win") return `${formatSeat(board.outcome.winner)} won`;
  if (board.outcome.status === "draw") return "Draw";
  if (board.outcome.status === "canceled") return "Canceled";
  if (board.seatsToAct.length === 0) return "Waiting";
  return `${formatSeat(board.seatsToAct[0] ?? "seat1")} to move`;
}

function formatScore(match: MatchView) {
  if (match.outcome.status === "canceled") return "Canceled";
  return `${match.outcome.score.seat1} - ${match.outcome.score.seat2}`;
}

function formatMatchOutcome(match: MatchView) {
  if (match.outcome.status === "canceled") return "Canceled";
  if (match.outcome.status === "in_progress") return "In progress";
  if (match.outcome.winner === null) return "Draw match";
  return `${formatSeat(match.outcome.winner)} wins`;
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
  return candidate === "tictactoe" || candidate === "connect4" || candidate === "chess";
}

function getInviteUrl(matchId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/matches/${encodeURIComponent(matchId)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
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
  if (candidate.gameType === "tictactoe" || candidate.gameType === "connect4" || candidate.gameType === "chess") {
    return candidate.gameType;
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

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the selection fallback for non-secure dev URLs.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();
  try {
    return document.execCommand("copy");
  } finally {
    textArea.remove();
  }
}
