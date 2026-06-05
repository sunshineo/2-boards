import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent
} from "react";
import { Chessboard, type ChessboardOptions, type PieceDataType } from "react-chessboard";
import { io } from "socket.io-client";

import {
  ApiError,
  createMatch,
  getApiBaseUrl,
  joinMatch,
  makeBotMove,
  listOpenMatches,
  makeMove,
  restoreSession
} from "./api";
import {
  createBrowserChessBotController,
  type BrowserChessBotController,
  type BrowserChessBotStatus
} from "./browserChessBot";
import type {
  BreakthroughBoardView,
  BoardId,
  BrowserChessBotDifficulty,
  ChessBoardView,
  ChessLegalMove,
  ChessMoveRecord,
  ChessPiece,
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
    gameType: "chess",
    imageAlt: "Chess preview",
    imageSrc: "/game-thumbnails/chess.png",
    label: "Chess"
  },
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
    gameType: "gomoku",
    imageAlt: "Gomoku preview",
    imageSrc: "/game-thumbnails/gomoku.png",
    label: "Gomoku"
  },
  {
    gameType: "hex",
    imageAlt: "Hex preview",
    imageSrc: "/game-thumbnails/hex.png",
    label: "Hex"
  },
  {
    gameType: "reversi",
    imageAlt: "Reversi preview",
    imageSrc: "/game-thumbnails/reversi.png",
    label: "Reversi"
  },
  {
    gameType: "breakthrough",
    imageAlt: "Breakthrough preview",
    imageSrc: "/game-thumbnails/breakthrough.png",
    label: "Breakthrough"
  },
  {
    gameType: "mancala",
    imageAlt: "Mancala preview",
    imageSrc: "/game-thumbnails/mancala.png",
    label: "Mancala"
  },
  {
    gameType: "dots-boxes",
    imageAlt: "Dots and Boxes preview",
    imageSrc: "/game-thumbnails/dots-boxes.png",
    label: "Dots and Boxes"
  },
  {
    gameType: "order-chaos",
    imageAlt: "Order and Chaos preview",
    imageSrc: "/game-thumbnails/order-chaos.png",
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
const isBrowserChessBotEnabled = import.meta.env["VITE_BROWSER_CHESS_BOT"] !== "false";
const browserChessBotDifficultyOptions: readonly {
  readonly difficulty: BrowserChessBotDifficulty;
  readonly label: string;
}[] = [
  { difficulty: "easy", label: "Easy" },
  { difficulty: "normal", label: "Normal" },
  { difficulty: "hard", label: "Hard" }
];

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
  const [isChessZenMode, setIsChessZenMode] = useState(false);
  const [chessCreateMode, setChessCreateMode] = useState<"human" | "bot">("human");
  const [browserBotDifficulty, setBrowserBotDifficulty] = useState<BrowserChessBotDifficulty>("normal");
  const [isCreatingBrowserBotGame, setIsCreatingBrowserBotGame] = useState(false);
  const [browserBotStatus, setBrowserBotStatus] = useState<BrowserChessBotStatus>("idle");
  const [browserBotRetryVersion, setBrowserBotRetryVersion] = useState(0);
  const restoreRequestRef = useRef<{ readonly matchId: string; readonly promise: Promise<SeatSession> } | null>(null);
  const mutationVersionRef = useRef(0);
  const isBusyRef = useRef(false);
  const isChessMatchActiveRef = useRef(false);
  const browserBotControllerRef = useRef<BrowserChessBotController | null>(null);
  const lobbyGame = route.view === "lobby" ? route.gameType : null;
  const activeSession = route.view === "match" && session?.match.id === route.matchId ? session : null;
  const isChessMatchActive = activeSession?.match.gameType === "chess";
  isChessMatchActiveRef.current = isChessMatchActive;
  const isChessZenModeActive = isChessMatchActive && isChessZenMode;
  const appShellClassName = `app-shell${isChessMatchActive ? " chess-match-shell" : ""}${isChessZenModeActive ? " chess-zen-mode" : ""}`;

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

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

    let restoreRequest = restoreRequestRef.current;
    if (!restoreRequest || restoreRequest.matchId !== route.matchId) {
      restoreRequest = {
        matchId: route.matchId,
        promise: restoreSession(route.matchId)
      };
      restoreRequest.promise.then(() => {
        if (restoreRequestRef.current === restoreRequest) {
          restoreRequestRef.current = null;
        }
      }, () => {
        if (restoreRequestRef.current === restoreRequest) {
          restoreRequestRef.current = null;
        }
      });
      restoreRequestRef.current = restoreRequest;
    }

    restoreRequest.promise
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
      addTrailingSlash: false,
      withCredentials: true
    });
    const watchMatch = () => {
      socket.emit("watch-match", { matchId: session.match.id });
    };

    socket.on("match:update", (match: MatchView) => {
      setSession((current) => {
        if (!current || current.match.id !== match.id) return current;
        return { ...current, match };
      });
    });
    socket.on("connect", watchMatch);
    if (socket.connected) watchMatch();

    return () => {
      socket.close();
    };
  }, [session?.match.id]);

  useEffect(() => {
    if (!session?.match.id || session.match.outcome.status !== "in_progress") return;

    const matchId = session.match.id;
    let isCurrent = true;
    let isInFlight = false;
    const refreshActiveMatch = async () => {
      if (isInFlight || isBusyRef.current) return;
      isInFlight = true;
      const mutationVersion = mutationVersionRef.current;
      try {
        const restoredSession = await restoreSession(matchId);
        if (!isCurrent || isBusyRef.current || mutationVersion !== mutationVersionRef.current) return;
        setSession((current) => (current?.match.id === matchId ? restoredSession : current));
      } catch {
        // Socket updates remain primary; polling failures should not interrupt play.
      } finally {
        isInFlight = false;
      }
    };

    const interval = window.setInterval(() => {
      void refreshActiveMatch();
    }, 2_000);

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
    };
  }, [session?.match.id, session?.match.outcome.status]);

  useEffect(() => {
    if (!session) return;
    saveRecentMatch(session.match);
    setRecentMatches(loadRecentMatches());
  }, [session]);

  useEffect(() => {
    if (!lobbyGame) return;
    setCustomMinutes((current) => clampMinutes(current, gameTimeRanges[lobbyGame]));
  }, [lobbyGame]);

  useEffect(() => {
    if (!isChessMatchActive) setIsChessZenMode(false);
  }, [isChessMatchActive]);

  useEffect(() => {
    const matchId = activeSession?.match.bot?.kind === "browser-stockfish" ? activeSession.match.id : null;
    if (!matchId) {
      browserBotControllerRef.current?.dispose();
      browserBotControllerRef.current = null;
      setBrowserBotStatus("idle");
      return;
    }

    const controller = createBrowserChessBotController({
      onStatus: setBrowserBotStatus,
      submitMove: async ({ boardId, move }) => {
        const match = await makeBotMove({ matchId, boardId, move });
        setSession((current) => (current?.match.id === match.id ? { ...current, match } : current));
      }
    });
    browserBotControllerRef.current = controller;

    return () => {
      controller.dispose();
      if (browserBotControllerRef.current === controller) {
        browserBotControllerRef.current = null;
      }
    };
  }, [activeSession?.match.bot?.kind, activeSession?.match.id]);

  useEffect(() => {
    if (activeSession?.match.bot?.kind !== "browser-stockfish") return;
    void browserBotControllerRef.current?.runForMatch(activeSession.match);
  }, [activeSession?.match, browserBotRetryVersion]);

  useEffect(() => {
    function handleZenModeKeyDown(event: globalThis.KeyboardEvent) {
      if (!isChessMatchActiveRef.current) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.key.toLowerCase() !== "z") {
        return;
      }
      if (isEditableShortcutTarget(event.target)) return;
      event.preventDefault();
      setIsChessZenMode((value) => !value);
    }

    window.addEventListener("keydown", handleZenModeKeyDown);

    return () => {
      window.removeEventListener("keydown", handleZenModeKeyDown);
    };
  }, []);

  function navigateTo(nextRoute: AppRoute) {
    window.history.pushState(null, "", getRouteUrl(nextRoute));
    setRoute(nextRoute);
  }

  async function run(action: () => Promise<void>) {
    mutationVersionRef.current += 1;
    isBusyRef.current = true;
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
      isBusyRef.current = false;
      setIsBusy(false);
    }
  }

  async function refreshOpenMatchList() {
    setOpenMatches(await loadOpenMatchList());
  }

  async function handleCreate(minutes = customMinutes) {
    if (!lobbyGame) return;
    const shouldCreateBot = isBrowserChessBotEnabled && lobbyGame === "chess" && chessCreateMode === "bot";
    setIsCreatingBrowserBotGame(shouldCreateBot);
    try {
      await run(async () => {
        const nextSession = await createMatch(lobbyGame, {
          clockInitialMs: minutesToMs(minutes, lobbyGame),
          ...(shouldCreateBot ? { bot: { difficulty: browserBotDifficulty } } : {})
        });
        setSession(nextSession);
        navigateTo({ view: "match", matchId: nextSession.match.id });
      });
    } finally {
      setIsCreatingBrowserBotGame(false);
    }
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

  function handleBrowserBotRetry() {
    setBrowserBotStatus("idle");
    setBrowserBotRetryVersion((version) => version + 1);
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
    <main className={appShellClassName}>
      {isChessZenModeActive ? (
        <p className="sr-only">Chess Zen mode active. Press z to exit.</p>
      ) : (
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
      )}

      {activeSession ? (
        <MatchRoom
          isZenMode={isChessZenModeActive}
          match={activeSession.match}
          seat={activeSession.seat}
          botStatus={activeSession.match.bot?.kind === "browser-stockfish" ? browserBotStatus : "idle"}
          onMove={handleMove}
          onRematch={handleRematch}
          onBotRetry={handleBrowserBotRetry}
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
              {isBrowserChessBotEnabled && lobbyGame === "chess" ? (
                <div className="mode-section" aria-label="Chess opponent">
                  <div className="mode-toggle" role="group" aria-label="Opponent">
                    <button
                      aria-pressed={chessCreateMode === "human"}
                      className={chessCreateMode === "human" ? "selected" : ""}
                      disabled={isBusy}
                      onClick={() => setChessCreateMode("human")}
                      type="button"
                    >
                      Human
                    </button>
                    <button
                      aria-pressed={chessCreateMode === "bot"}
                      className={chessCreateMode === "bot" ? "selected" : ""}
                      disabled={isBusy}
                      onClick={() => setChessCreateMode("bot")}
                      type="button"
                    >
                      Bot
                    </button>
                  </div>
                  {chessCreateMode === "bot" ? (
                    <div className="difficulty-grid" role="group" aria-label="Bot difficulty">
                      {browserChessBotDifficultyOptions.map((option) => (
                        <button
                          aria-pressed={browserBotDifficulty === option.difficulty}
                          className={browserBotDifficulty === option.difficulty ? "selected" : ""}
                          disabled={isBusy}
                          key={option.difficulty}
                          onClick={() => setBrowserBotDifficulty(option.difficulty)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
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
              {isCreatingBrowserBotGame ? "Creating bot game" : `Create ${selectedGameLabel} match`}
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

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function MatchRoom(props: {
  match: MatchView;
  seat: SeatId | null;
  botStatus: BrowserChessBotStatus;
  onMove: (boardId: BoardId, move: MovePayload) => void;
  onRematch: () => void;
  onBotRetry: () => void;
  isBusy: boolean;
  isZenMode: boolean;
}) {
  const status = formatMatchStatus(props.match, props.seat);
  const canRematch = props.match.outcome.status !== "in_progress" && !props.isZenMode;
  const matchRoomClassName = `match-room${props.match.gameType === "chess" ? " chess-match-room" : ""}${props.isZenMode ? " zen-match-room" : ""}`;

  return (
    <section
      aria-label={`${props.match.gameLabel} match`}
      className={matchRoomClassName}
      data-zen-mode={props.isZenMode ? "true" : "false"}
    >
      {props.isZenMode ? null : (
        <div className={`match-summary${props.match.bot?.kind === "browser-stockfish" ? " bot-match-summary" : ""}`}>
          <div>
            <span className="meta-label">Game</span>
            <strong data-testid="match-code" data-match-id={props.match.id}>
              {props.match.gameLabel}
            </strong>
          </div>
          {props.match.bot?.kind === "browser-stockfish" ? (
            <div>
              <span className="meta-label">Opponent</span>
              <strong data-testid="match-opponent-name">{props.match.bot.displayName}</strong>
            </div>
          ) : null}
          <div>
            <span className="meta-label">Score</span>
            <strong>{formatScore(props.match)}</strong>
          </div>
          <div>
            <span className="meta-label">Status</span>
            <strong>{status}</strong>
          </div>
        </div>
      )}

      {canRematch ? (
        <div className="match-actions">
          <button className="primary-button" onClick={props.onRematch} type="button">
            Rematch
          </button>
        </div>
      ) : null}

      {props.match.bot?.kind === "browser-stockfish" && props.botStatus !== "idle" && !props.isZenMode ? (
        <div className={`bot-status${props.botStatus === "error" ? " error" : ""}`}>
          <span>{formatBrowserBotStatus(props.botStatus)}</span>
          {props.botStatus === "error" ? (
            <button className="secondary-button compact-button" onClick={props.onBotRetry} type="button">
              Retry
            </button>
          ) : null}
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

function formatBrowserBotStatus(status: BrowserChessBotStatus) {
  if (status === "loading") return "Bot loading";
  if (status === "thinking") return "Bot thinking";
  if (status === "error") return "Bot move failed";
  return "";
}

function ClockStrip(props: { clock: MatchClockView | null; currentSeat: SeatId | null }) {
  const { clientNowMs, snapshotReceivedAtMs } = useProjectedClockTime(props.clock);

  const clock = props.clock;
  if (!clock) return null;

  return (
    <section className="clock-strip" aria-label="Clocks">
      {getClockSeatOrder(props.currentSeat).map((seat) => {
        const seatClock = clock.seats[seat];
        const remainingMs = getProjectedClockRemainingMs(clock, seat, snapshotReceivedAtMs, clientNowMs);
        const label = formatRelativeSeat(seat, props.currentSeat);
        const clockState = seatClock?.isRunning ? "running" : "paused";
        return (
          <div
            aria-label={`${label} clock`}
            className={`clock-card${clockState === "running" ? " running" : ""}`}
            data-clock-state={clockState}
            key={seat}
          >
            <span className="meta-label">{label}</span>
            <strong>{formatClockMs(remainingMs)}</strong>
            <span>{clockState === "running" ? "Running" : "Paused"}</span>
          </div>
        );
      })}
    </section>
  );
}

function useProjectedClockTime(clock: MatchClockView | null) {
  const snapshotReceivedAtMs = useMemo(() => Date.now(), [clock]);
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const hasRunningClock = clock?.status === "active" && clock.runningSeats.length > 0;

  useEffect(() => {
    setClientNowMs(Date.now());
    if (!hasRunningClock) return;

    const tick = window.setInterval(() => {
      setClientNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(tick);
    };
  }, [hasRunningClock, clock]);

  return { clientNowMs, snapshotReceivedAtMs };
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
  onMove: (move: MovePayload) => void;
}) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const [annotationCircles, setAnnotationCircles] = useState<Record<string, ChessAnnotationColor>>({});
  const [annotationArrows, setAnnotationArrows] = useState<readonly ChessAnnotationArrow[]>([]);
  const pendingAnnotationArrow = useRef<{ readonly color: ChessAnnotationColor; readonly from: string } | null>(null);
  const skipNextContextMenuAnnotation = useRef(false);
  const [pendingPromotion, setPendingPromotion] = useState<{
    readonly from: string;
    readonly to: string;
    readonly moves: readonly ChessLegalMove[];
  } | null>(null);
  const [pendingPremove, setPendingPremove] = useState<ChessPremove | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<"drawOffer" | "resign" | null>(null);
  const reviewMove = reviewPly === null || reviewPly === 0 ? null : props.board.moveHistory[reviewPly - 1] ?? null;
  const reviewFen = reviewPly === null ? null : reviewPly === 0 ? startingChessFen : (reviewMove?.fenAfter ?? null);
  const isReviewing = reviewFen !== null;
  const displayedFen = reviewFen ?? props.board.fen;
  const canActLive =
    props.currentSeat !== null &&
    props.board.outcome.status === "in_progress" &&
    props.board.seatsToAct.includes(props.currentSeat);
  const canAct = canActLive && !isReviewing;
  const isSeatOnBoard = props.currentSeat === props.board.whiteSeat || props.currentSeat === props.board.blackSeat;
  const canPlanPremove =
    props.currentSeat !== null &&
    isSeatOnBoard &&
    props.board.outcome.status === "in_progress" &&
    props.board.seatsToAct.length > 0 &&
    !canActLive &&
    !isReviewing;
  const canResign =
    props.currentSeat !== null &&
    props.board.outcome.status === "in_progress" &&
    props.board.seatsToAct.length > 0 &&
    !isReviewing;
  const canUseDrawControls = canResign;
  const drawOffer = props.board.drawOffer;
  const isOwnDrawOffer = drawOffer !== null && drawOffer.offeredBy === props.currentSeat;
  const isOpponentDrawOffer =
    drawOffer !== null && props.currentSeat !== null && drawOffer.offeredBy !== props.currentSeat;
  const takebackRequest = props.board.takebackRequest ?? null;
  const isOwnTakebackRequest = takebackRequest !== null && takebackRequest.requestedBy === props.currentSeat;
  const isOpponentTakebackRequest =
    takebackRequest !== null && props.currentSeat !== null && takebackRequest.requestedBy !== props.currentSeat;
  const isConfirmingDrawOffer = pendingConfirmation === "drawOffer";
  const isConfirmingResign = pendingConfirmation === "resign";
  const selectedLegalMoves = useMemo(
    () => (canAct && selectedSquare ? getChessMovesFromSquare(props.board, selectedSquare) : []),
    [canAct, props.board, selectedSquare]
  );
  const latestReplayableMove = getLatestReplayableChessMoveRecord(props.board.moveHistory);
  const lastMove = isReviewing ? reviewMove : latestReplayableMove;
  const displayedCheckSquare = isReviewing ? null : props.board.checkSquare;
  const canUseTakebackControls =
    props.currentSeat !== null && props.board.outcome.status === "in_progress" && !isReviewing;
  const canRequestTakeback = canUseTakebackControls && latestReplayableMove !== null && takebackRequest === null;
  const boardOrientation = getChessboardOrientation(props.board, props.currentSeat);
  const pendingPromotionPosition = pendingPromotion ? getChessSquareGridPosition(pendingPromotion.to, boardOrientation) : null;
  const boardStatus =
    isReviewing && reviewPly === 0
      ? "Starting position"
      : isReviewing && reviewPly !== null
        ? `Reviewing move ${reviewPly}`
        : formatChessBoardStatus(props.board, props.currentSeat, canAct);
  const replayNavigation = getChessReplayNavigation(props.board.moveHistory, isReviewing ? reviewPly : null);

  useEffect(() => {
    setPendingPromotion(null);
    if (!canAct) {
      setSelectedSquare(null);
      setPendingConfirmation(null);
    }
  }, [canAct, props.board.fen]);

  useEffect(() => {
    if (!pendingPremove) return;
    if (props.board.outcome.status !== "in_progress" || isReviewing) {
      setPendingPremove(null);
      return;
    }
    if (!canAct || props.isBusy) return;

    const legalMoves = getChessMovesBetween(props.board, pendingPremove.from, pendingPremove.to);
    if (legalMoves.length === 0) {
      setPendingPremove(null);
      return;
    }

    setPendingPremove(null);
    void submitChessMoveCandidates(legalMoves);
  }, [canAct, isReviewing, pendingPremove, props.board, props.board.outcome.status, props.isBusy]);

  useEffect(() => {
    setPendingConfirmation(null);
  }, [props.board.fen, props.board.drawOffer, props.board.outcome.status, props.board.takebackRequest]);

  useEffect(() => {
    if (reviewPly === 0 && getReplayableChessMovePlys(props.board.moveHistory).length === 0) {
      setReviewPly(null);
    }
    if (reviewPly !== null && reviewPly > 0 && !props.board.moveHistory[reviewPly - 1]?.fenAfter) {
      setReviewPly(null);
    }
  }, [props.board.moveHistory, reviewPly]);

  function handleSquareClick(square: string, piece: PieceDataType | null) {
    const isLegalTarget = selectedSquare ? getChessMovesBetween(props.board, selectedSquare, square).length > 0 : false;
    const isOwnPiece = piece ? getPieceSeatFromPieceType(props.board, piece.pieceType) === props.currentSeat : false;
    if (!piece && !isLegalTarget) {
      clearChessAnnotations();
    }

    if (canPlanPremove) {
      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          setPendingPromotion(null);
          return;
        }

        if (isOwnPiece) {
          setSelectedSquare(square);
          setPendingPremove(null);
          setPendingPromotion(null);
          setPendingConfirmation(null);
          return;
        }

        setPendingPremove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setPendingPromotion(null);
        setPendingConfirmation(null);
        return;
      }

      if (isOwnPiece) {
        setSelectedSquare(square);
        setPendingPremove(null);
        setPendingPromotion(null);
        setPendingConfirmation(null);
      }
      return;
    }

    if (!canAct) return;

    if (selectedSquare) {
      const legalMoves = isLegalTarget ? getChessMovesBetween(props.board, selectedSquare, square) : [];
      if (legalMoves.length > 0) {
        void submitChessMoveCandidates(legalMoves);
        return;
      }

      if (isOwnPiece && getChessMovesFromSquare(props.board, square).length > 0) {
        setSelectedSquare(square);
        setPendingPremove(null);
        setPendingPromotion(null);
        return;
      }

      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPendingPromotion(null);
        return;
      }

      setSelectedSquare(null);
      setPendingPromotion(null);
      return;
    }

    if (isOwnPiece && getChessMovesFromSquare(props.board, square).length > 0) {
      setSelectedSquare(square);
      setPendingPremove(null);
    }
  }

  function submitChessMoveCandidates(legalMoves: readonly ChessLegalMove[]) {
    if (legalMoves.length === 0) return false;
    const promotionMoves = sortPromotionMoves(legalMoves.filter((move) => move.promotion));
    if (promotionMoves.length > 1) {
      const [firstMove] = promotionMoves;
      if (!firstMove) return false;
      setPendingPromotion({ from: firstMove.from, to: firstMove.to, moves: promotionMoves });
      return false;
    }

    const move = promotionMoves[0] ?? legalMoves[0];
    if (!move) return false;
    props.onMove(toChessMovePayload(move));
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
    return true;
  }

  function handlePromotionChoice(move: ChessLegalMove) {
    props.onMove(toChessMovePayload(move));
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
  }

  function handleReviewPly(nextReviewPly: number) {
    setReviewPly(nextReviewPly);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
  }

  function handleReturnToLive() {
    setReviewPly(null);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
  }

  function handleFirstReplay() {
    if (replayNavigation.firstPly === null) return false;
    handleReviewPly(replayNavigation.firstPly);
    return true;
  }

  function handleLatestReplay() {
    if (replayNavigation.latestPly === null) return false;
    handleReturnToLive();
    return true;
  }

  function handlePreviousReplay() {
    if (replayNavigation.previousPly === null) return false;
    handleReviewPly(replayNavigation.previousPly);
    return true;
  }

  function handleNextReplay() {
    if (replayNavigation.nextPly === null) return false;
    if (replayNavigation.isNextLive) {
      handleReturnToLive();
      return true;
    }
    handleReviewPly(replayNavigation.nextPly);
    return true;
  }

  function handleCancelChessInteraction() {
    if (selectedSquare === null && pendingPremove === null && pendingPromotion === null && pendingConfirmation === null) {
      return false;
    }
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
    return true;
  }

  function handleChessKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const key = event.key.toLowerCase();
    const didNavigate =
      event.key === "Escape"
        ? handleCancelChessInteraction()
        : event.key === "ArrowLeft" || key === "h"
        ? handlePreviousReplay()
        : event.key === "ArrowRight" || key === "l"
          ? handleNextReplay()
          : event.key === "ArrowUp" || key === "k"
          ? handleFirstReplay()
          : event.key === "ArrowDown" || key === "j"
            ? handleLatestReplay()
          : false;

    if (didNavigate) {
      event.preventDefault();
    }
  }

  function handleChessWheel(event: WheelEvent<HTMLElement>) {
    if (event.deltaY === 0) return;
    const didNavigate = event.deltaY < 0 ? handlePreviousReplay() : handleNextReplay();
    if (didNavigate) {
      event.preventDefault();
    }
  }

  function handleChessContextMenu(event: MouseEvent<HTMLElement>) {
    const square = getChessSquareFromEventTarget(event.target);
    if (!square) return;

    event.preventDefault();
    if (skipNextContextMenuAnnotation.current) {
      skipNextContextMenuAnnotation.current = false;
      return;
    }

    if (canPlanPremove && (pendingPremove !== null || selectedSquare !== null)) {
      pendingAnnotationArrow.current = null;
      setSelectedSquare(null);
      setPendingPremove(null);
      setPendingPromotion(null);
      setPendingConfirmation(null);
      return;
    }

    const color = getChessAnnotationColor(event);
    setAnnotationCircles((current) => {
      if (current[square] === color) {
        const next = { ...current };
        delete next[square];
        return next;
      }
      return { ...current, [square]: color };
    });
  }

  function clearChessAnnotations() {
    setAnnotationCircles({});
    setAnnotationArrows([]);
  }

  function handleChessMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.button !== 2) return;
    const square = getChessSquareFromEventTarget(event.target);
    if (!square) return;
    pendingAnnotationArrow.current = { color: getChessAnnotationColor(event), from: square };
  }

  function handleChessMouseUp(event: MouseEvent<HTMLElement>) {
    if (event.button !== 2) return;
    const pendingArrow = pendingAnnotationArrow.current;
    pendingAnnotationArrow.current = null;
    const to = getChessSquareFromEventTarget(event.target);
    if (!pendingArrow || !to || pendingArrow.from === to) return;

    event.preventDefault();
    skipNextContextMenuAnnotation.current = true;
    setAnnotationArrows((current) => {
      const isSameArrow = (arrow: ChessAnnotationArrow) =>
        arrow.from === pendingArrow.from && arrow.to === to && arrow.color === pendingArrow.color;
      if (current.some(isSameArrow)) {
        return current.filter((arrow) => !isSameArrow(arrow));
      }
      return [...current, { from: pendingArrow.from, to, color: pendingArrow.color }];
    });
  }

  function handleResign() {
    setReviewPly(null);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    if (pendingConfirmation !== "resign") {
      setPendingConfirmation("resign");
      return;
    }
    setPendingConfirmation(null);
    props.onMove({ resign: true });
  }

  function handleDrawOffer() {
    setReviewPly(null);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    if (pendingConfirmation !== "drawOffer") {
      setPendingConfirmation("drawOffer");
      return;
    }
    setPendingConfirmation(null);
    props.onMove({ drawOffer: true });
  }

  function handleTakebackRequest() {
    setReviewPly(null);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
    props.onMove({ requestTakeback: true });
  }

  function handleAcceptDraw() {
    setReviewPly(null);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
    props.onMove({ acceptDraw: true });
  }

  function handleAcceptTakeback() {
    setReviewPly(null);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
    props.onMove({ acceptTakeback: true });
  }

  function handleDeclineDraw() {
    setReviewPly(null);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
    props.onMove({ declineDraw: true });
  }

  function handleDeclineTakeback() {
    setReviewPly(null);
    setSelectedSquare(null);
    setPendingPremove(null);
    setPendingPromotion(null);
    setPendingConfirmation(null);
    props.onMove({ declineTakeback: true });
  }

  const chessboardOptions: ChessboardOptions = {
    id: `board-${props.board.id}-chessboard`,
    position: getChessboardPosition(displayedFen),
    boardOrientation,
    animationDurationInMs: 0,
    showAnimations: false,
    allowDragging: canAct && !props.isBusy,
    showNotation: true,
    squareStyles: getChessSquareStyles({
      checkSquare: displayedCheckSquare,
      lastMove,
      selectedLegalMoves,
      selectedSquare
    }),
    canDragPiece({ piece, square }) {
      return (
        canAct &&
        !props.isBusy &&
        square !== null &&
        getPieceSeatFromPieceType(props.board, piece.pieceType) === props.currentSeat &&
        getChessMovesFromSquare(props.board, square).length > 0
      );
    },
    onPieceDrop({ sourceSquare, targetSquare }) {
      if (!canAct || props.isBusy || !targetSquare || sourceSquare === targetSquare) return false;
      const legalMoves = getChessMovesBetween(props.board, sourceSquare, targetSquare);
      return submitChessMoveCandidates(legalMoves);
    },
    onSquareClick({ piece, square }) {
      handleSquareClick(square, piece);
    },
    squareRenderer({ piece, square, children }) {
      const legalTargetMove = selectedLegalMoves.find((move) => move.to === square);
      const isLegalTarget = legalTargetMove !== undefined;
      const isCaptureTarget = Boolean(legalTargetMove?.captured || piece);
      const isSelected = selectedSquare === square;
      const isCheckedKing = displayedCheckSquare === square;
      const isLastMoveSquare = lastMove?.from === square || lastMove?.to === square;
      const annotationColor = annotationCircles[square] ?? null;
      const isOwnPiece =
        piece !== null && getPieceSeatFromPieceType(props.board, piece.pieceType) === props.currentSeat;
      const isPremoveSource = pendingPremove?.from === square;
      const isPremoveTarget = pendingPremove?.to === square;
      const isPremoveDestination =
        canPlanPremove && selectedSquare !== null && selectedSquare !== square && !isOwnPiece;
      const canMovePiece =
        isOwnPiece && (canAct ? getChessMovesFromSquare(props.board, square).length > 0 : canPlanPremove);
      const canInteractWithSquare = canAct
        ? canMovePiece || isLegalTarget || isSelected
        : canPlanPremove
          ? canMovePiece || isSelected || isPremoveDestination
          : false;
      return (
        <button
          aria-label={formatChessSquareLabel(props.board.id, square, piece, {
            annotationColor,
            isCheckedKing,
            isLastMoveSquare,
            isLegalTarget,
            isPremoveDestination,
            isPremoveSource,
            isPremoveTarget,
            isSelected
          })}
          className={`react-chessboard-square-button${isSelected ? " selected" : ""}${isLegalTarget ? " legal-target" : ""}${isPremoveDestination ? " premove-destination" : ""}${isPremoveSource ? " premove-source" : ""}${isPremoveTarget ? " premove-target" : ""}${isLastMoveSquare ? " last-move" : ""}${isCheckedKing ? " checked-king" : ""}${annotationColor ? ` annotation-${annotationColor}` : ""}`}
          disabled={props.isBusy || !canInteractWithSquare}
          type="button"
        >
          {isLegalTarget ? (
            <span
              aria-hidden="true"
              className={`chess-legal-move-dot${isCaptureTarget ? " capture" : ""}`}
            />
          ) : null}
          {children}
        </button>
      );
    }
  };

  return (
    <section
      aria-label={`Board ${props.board.id}`}
      className={`board-panel chess-board-panel${canAct ? " active-board" : ""}`}
      onContextMenu={handleChessContextMenu}
      onKeyDown={handleChessKeyDown}
      onMouseDown={handleChessMouseDown}
      onMouseUp={handleChessMouseUp}
      onWheel={handleChessWheel}
      tabIndex={0}
    >
      <div className="board-heading chess-heading">
        <div>
          <h2>Board {props.board.id}</h2>
          <p>{boardStatus}</p>
        </div>
        <div className="chess-heading-actions">
          {isOpponentTakebackRequest ? (
            <span className="chess-takeback-response-group">
              <button
                aria-label={`Accept Takeback Board ${props.board.id}`}
                className="secondary-button compact-button chess-takeback-button accept"
                disabled={props.isBusy || !canUseTakebackControls}
                onClick={handleAcceptTakeback}
                type="button"
              >
                Accept
              </button>
              <button
                aria-label={`Decline Takeback Board ${props.board.id}`}
                className="secondary-button compact-button chess-takeback-button"
                disabled={props.isBusy || !canUseTakebackControls}
                onClick={handleDeclineTakeback}
                type="button"
              >
                Decline
              </button>
            </span>
          ) : (
            <button
              aria-label={
                isOwnTakebackRequest
                  ? `Takeback Requested Board ${props.board.id}`
                  : `Request Takeback Board ${props.board.id}`
              }
              className={`secondary-button compact-button chess-takeback-button${isOwnTakebackRequest ? " pending" : ""}`}
              disabled={props.isBusy || !canRequestTakeback || isOwnTakebackRequest || takebackRequest !== null}
              onClick={handleTakebackRequest}
              type="button"
            >
              {isOwnTakebackRequest ? "Takeback requested" : "Takeback"}
            </button>
          )}
          {isOpponentDrawOffer ? (
            <span className="chess-draw-response-group">
              <button
                aria-label={`Accept Draw Board ${props.board.id}`}
                className="secondary-button compact-button chess-draw-button accept"
                disabled={props.isBusy || !canUseDrawControls}
                onClick={handleAcceptDraw}
                type="button"
              >
                Accept
              </button>
              <button
                aria-label={`Decline Draw Board ${props.board.id}`}
                className="secondary-button compact-button chess-draw-button"
                disabled={props.isBusy || !canUseDrawControls}
                onClick={handleDeclineDraw}
                type="button"
              >
                Decline
              </button>
            </span>
          ) : (
            <button
              aria-label={
                isOwnDrawOffer
                  ? `Draw Offered Board ${props.board.id}`
                  : isConfirmingDrawOffer
                    ? `Confirm Draw Offer Board ${props.board.id}`
                    : `Offer Draw Board ${props.board.id}`
              }
              className={`secondary-button compact-button chess-draw-button${isOwnDrawOffer ? " pending" : ""}${isConfirmingDrawOffer ? " confirming" : ""}`}
              disabled={props.isBusy || !canUseDrawControls || isOwnDrawOffer || drawOffer !== null}
              onClick={handleDrawOffer}
              type="button"
            >
              {isOwnDrawOffer ? "Draw offered" : isConfirmingDrawOffer ? "Confirm" : "Draw"}
            </button>
          )}
          <button
            aria-label={isConfirmingResign ? `Confirm Resign Board ${props.board.id}` : `Resign Board ${props.board.id}`}
            className={`secondary-button compact-button chess-resign-button${isConfirmingResign ? " confirming" : ""}`}
            disabled={props.isBusy || !canResign}
            onClick={handleResign}
            type="button"
          >
            {isConfirmingResign ? "Confirm" : "Resign"}
          </button>
        </div>
      </div>
      <div className="chess-board-layout">
        <div className="chess-board-stage">
          <div
            className="react-chessboard-shell"
            data-board-id={props.board.id}
            data-interactive={canAct && !props.isBusy ? "true" : "false"}
            data-orientation={boardOrientation}
            data-position-fen={displayedFen}
            data-review-ply={isReviewing ? String(reviewPly) : "live"}
            data-testid={`board-${props.board.id}-chessboard`}
          >
            <Chessboard options={chessboardOptions} />
            <ChessAnnotationArrows arrows={annotationArrows} boardId={props.board.id} orientation={boardOrientation} />
          </div>
          {pendingPromotion ? (
            <div
              className="promotion-picker"
              data-board-orientation={boardOrientation}
              data-promotion-square={pendingPromotion.to}
              role="dialog"
              aria-label={`Board ${props.board.id} choose promotion`}
              style={
                pendingPromotionPosition
                  ? ({
                      "--promotion-file": String(pendingPromotionPosition.file),
                      "--promotion-rank": String(pendingPromotionPosition.rank),
                      "--promotion-offset-y": pendingPromotionPosition.rank <= 3 ? "0" : "-75%"
                    } as CSSProperties)
                  : undefined
              }
            >
              {pendingPromotion.moves.map((move) => (
                <button
                  aria-label={`Promote to ${formatPromotionPiece(move.promotion ?? "q")}`}
                  className="promotion-button"
                  key={move.promotion}
                  onClick={() => handlePromotionChoice(move)}
                  type="button"
                >
                  {getPromotionGlyph(move)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <aside className="chess-side-panel" aria-label={`Board ${props.board.id} chess details`}>
          <ChessMoveHistory
            board={props.board}
            onReturnToLive={handleReturnToLive}
            onReviewPly={handleReviewPly}
            reviewPly={isReviewing ? reviewPly : null}
          />
        </aside>
      </div>
    </section>
  );
}

function ChessAnnotationArrows(props: {
  readonly arrows: readonly ChessAnnotationArrow[];
  readonly boardId: BoardId;
  readonly orientation: "white" | "black";
}) {
  if (props.arrows.length === 0) return null;

  return (
    <svg
      aria-label={`Board ${props.boardId} annotation arrows`}
      className="chess-annotation-overlay"
      viewBox="0 0 100 100"
    >
      <defs>
        {(Object.keys(chessAnnotationSvgColors) as ChessAnnotationColor[]).map((color) => (
          <marker
            id={getChessAnnotationMarkerId(props.boardId, color)}
            key={color}
            markerHeight="5"
            markerUnits="strokeWidth"
            markerWidth="5"
            orient="auto"
            refX="4.4"
            refY="2.5"
            viewBox="0 0 5 5"
          >
            <path d="M 0 0 L 5 2.5 L 0 5 z" fill={chessAnnotationSvgColors[color]} />
          </marker>
        ))}
      </defs>
      {props.arrows.map((arrow) => {
        const from = getChessSquareCenter(arrow.from, props.orientation);
        const to = getChessSquareCenter(arrow.to, props.orientation);
        return (
          <line
            aria-label={`Board ${props.boardId} arrow ${arrow.from} to ${arrow.to} ${arrow.color}`}
            className={`chess-annotation-arrow annotation-arrow-${arrow.color}`}
            key={`${arrow.from}-${arrow.to}-${arrow.color}`}
            markerEnd={`url(#${getChessAnnotationMarkerId(props.boardId, arrow.color)})`}
            role="img"
            stroke={chessAnnotationSvgColors[arrow.color]}
            x1={from.x}
            x2={to.x}
            y1={from.y}
            y2={to.y}
          />
        );
      })}
    </svg>
  );
}

function ChessMoveHistory(props: {
  board: ChessBoardView;
  onReturnToLive: () => void;
  onReviewPly: (ply: number) => void;
  reviewPly: number | null;
}) {
  const pairs = getChessMovePairs(props.board.moveHistory);
  const currentMove = props.board.moveHistory.at(-1) ?? null;
  const replayNavigation = getChessReplayNavigation(props.board.moveHistory, props.reviewPly);
  const replayMeta =
    props.reviewPly === null
      ? `${props.board.moveHistory.length} ply`
      : props.reviewPly === 0
        ? `Start / ${props.board.moveHistory.length}`
        : `Review ${props.reviewPly}/${props.board.moveHistory.length}`;

  function handleFirstReplay() {
    if (replayNavigation.firstPly === null) return;
    props.onReviewPly(replayNavigation.firstPly);
  }

  function handleLatestReplay() {
    if (replayNavigation.latestPly === null) return;
    props.onReturnToLive();
  }

  function handlePreviousReplay() {
    if (replayNavigation.previousPly === null) return;
    props.onReviewPly(replayNavigation.previousPly);
  }

  function handleNextReplay() {
    if (replayNavigation.nextPly === null) return;
    if (replayNavigation.isNextLive) {
      props.onReturnToLive();
      return;
    }
    props.onReviewPly(replayNavigation.nextPly);
  }

  return (
    <section className="chess-move-card" aria-label={`Board ${props.board.id} move history`}>
      <div className="chess-side-title">
        <h3>Moves</h3>
        <div className="chess-replay-meta">
          <span>{replayMeta}</span>
          <span className="chess-replay-controls">
            <button
              aria-label={`Board ${props.board.id} first move`}
              className="chess-live-button"
              disabled={replayNavigation.firstPly === null}
              onClick={handleFirstReplay}
              type="button"
            >
              First
            </button>
            <button
              aria-label={`Board ${props.board.id} previous move`}
              className="chess-live-button"
              disabled={replayNavigation.previousPly === null}
              onClick={handlePreviousReplay}
              type="button"
            >
              Prev
            </button>
            <button
              aria-label={`Board ${props.board.id} next move`}
              className="chess-live-button"
              disabled={replayNavigation.nextPly === null}
              onClick={handleNextReplay}
              type="button"
            >
              Next
            </button>
            <button
              aria-label={`Board ${props.board.id} latest move`}
              className="chess-live-button"
              disabled={replayNavigation.latestPly === null}
              onClick={handleLatestReplay}
              type="button"
            >
              Last
            </button>
          </span>
          {props.reviewPly === null ? null : (
            <button
              aria-label={`Board ${props.board.id} return to live position`}
              className="chess-live-button"
              onClick={props.onReturnToLive}
              type="button"
            >
              Live
            </button>
          )}
        </div>
      </div>
      {pairs.length === 0 ? (
        <p className="chess-empty-history">No moves yet</p>
      ) : (
        <ol className="chess-move-list">
          {pairs.map((pair) => (
            <li key={pair.number}>
              <span className="move-number">{pair.number}.</span>
              <ChessMoveHistoryButton
                boardId={props.board.id}
                currentMove={currentMove}
                move={pair.white}
                onReturnToLive={props.onReturnToLive}
                onReviewPly={props.onReviewPly}
                ply={pair.whitePly}
                reviewPly={props.reviewPly}
              />
              <ChessMoveHistoryButton
                boardId={props.board.id}
                currentMove={currentMove}
                move={pair.black}
                onReturnToLive={props.onReturnToLive}
                onReviewPly={props.onReviewPly}
                ply={pair.blackPly}
                reviewPly={props.reviewPly}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ChessMoveHistoryButton(props: {
  boardId: BoardId;
  currentMove: ChessMoveRecord | null;
  move: ChessMoveRecord | null;
  onReturnToLive: () => void;
  onReviewPly: (ply: number) => void;
  ply: number | null;
  reviewPly: number | null;
}) {
  if (!props.move || props.ply === null) {
    return <span className="chess-move-empty" />;
  }

  const isCurrentMove = props.currentMove === props.move;
  const isReviewMove = props.reviewPly === props.ply;
  const isReplayable = isReplayableChessMoveRecord(props.move);
  return (
    <button
      aria-label={
        isCurrentMove ? `Board ${props.boardId} current move ${props.move.san}` : `Board ${props.boardId} review move ${props.move.san}`
      }
      className={`chess-move-button${isCurrentMove ? " current-move" : ""}${isReviewMove ? " review-move" : ""}`}
      disabled={!isReplayable}
      onClick={() => {
        if (!isReplayable) return;
        if (isCurrentMove) {
          props.onReturnToLive();
          return;
        }
        props.onReviewPly(props.ply ?? 0);
      }}
      type="button"
    >
      {props.move.san}
    </button>
  );
}

function isReplayableChessMoveRecord(move: ChessMoveRecord) {
  return Boolean(move.fenAfter && move.from && move.to);
}

function getReplayableChessMovePlys(moveHistory: readonly ChessMoveRecord[]) {
  return moveHistory.flatMap((move, index) => (isReplayableChessMoveRecord(move) ? [index + 1] : []));
}

function getChessReplayNavigation(moveHistory: readonly ChessMoveRecord[], reviewPly: number | null) {
  const replayablePlys = getReplayableChessMovePlys(moveHistory);
  const navigationPlys = replayablePlys.length > 0 ? [0, ...replayablePlys] : [];
  const currentReplayIndex = reviewPly === null ? navigationPlys.length - 1 : navigationPlys.indexOf(reviewPly);
  const previousPly = currentReplayIndex > 0 ? (navigationPlys[currentReplayIndex - 1] ?? null) : null;
  const nextPly =
    reviewPly !== null && currentReplayIndex >= 0 && currentReplayIndex < navigationPlys.length - 1
      ? (navigationPlys[currentReplayIndex + 1] ?? null)
      : null;
  const latestPly =
    reviewPly !== null && currentReplayIndex >= 0 && currentReplayIndex < navigationPlys.length - 1
      ? (navigationPlys[navigationPlys.length - 1] ?? null)
      : null;

  return {
    firstPly: currentReplayIndex > 0 ? 0 : null,
    isNextLive: nextPly !== null && currentReplayIndex + 1 === navigationPlys.length - 1,
    latestPly,
    nextPly,
    previousPly
  };
}

function getLatestReplayableChessMoveRecord(moveHistory: readonly ChessMoveRecord[]) {
  for (let index = moveHistory.length - 1; index >= 0; index -= 1) {
    const move = moveHistory[index];
    if (move && isReplayableChessMoveRecord(move)) return move;
  }
  return null;
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
  const visualRows = props.board.boxRows * 2 + 1;
  const visualColumns = props.board.boxColumns * 2 + 1;

  return (
    <section className={`board-panel${canAct ? " active-board" : ""}`} aria-label={`Board ${props.board.id}`}>
      <BoardHeading board={props.board} currentSeat={props.currentSeat} canAct={canAct} />
      <div className="dots-score">
        <span>{props.board.scores.seat1}</span>
        <span>{props.board.scores.seat2}</span>
      </div>
      <div
        aria-label={`Board ${props.board.id} Dots and Boxes grid`}
        className="dots-board"
        role="group"
        style={{ gridTemplateColumns: `repeat(${visualColumns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: visualRows }, (_, visualRow) =>
          Array.from({ length: visualColumns }, (_, visualColumn) =>
            renderDotsBoxesCell({
              board: props.board,
              canAct,
              isBusy: props.isBusy,
              onMove: props.onMove,
              visualColumn,
              visualRow
            })
          )
        )}
      </div>
    </section>
  );
}

function renderDotsBoxesCell(props: {
  board: DotsBoxesBoardView;
  canAct: boolean;
  isBusy: boolean;
  onMove: (edge: string) => void;
  visualColumn: number;
  visualRow: number;
}) {
  if (props.visualRow % 2 === 0 && props.visualColumn % 2 === 0) {
    return (
      <span
        aria-hidden="true"
        className="dot-node"
        key={`dot-${props.visualRow}-${props.visualColumn}`}
      />
    );
  }

  if (props.visualRow % 2 === 0) {
    const edge = `h-${props.visualRow / 2}-${Math.floor(props.visualColumn / 2)}`;
    return (
      <DotsBoxesEdgeButton
        board={props.board}
        canAct={props.canAct}
        edge={edge}
        isBusy={props.isBusy}
        key={edge}
        orientation="horizontal"
        onMove={props.onMove}
      />
    );
  }

  if (props.visualColumn % 2 === 0) {
    const edge = `v-${Math.floor(props.visualRow / 2)}-${props.visualColumn / 2}`;
    return (
      <DotsBoxesEdgeButton
        board={props.board}
        canAct={props.canAct}
        edge={edge}
        isBusy={props.isBusy}
        key={edge}
        orientation="vertical"
        onMove={props.onMove}
      />
    );
  }

  const boxIndex = Math.floor(props.visualRow / 2) * props.board.boxColumns + Math.floor(props.visualColumn / 2);
  const owner = props.board.boxes[boxIndex] ?? null;
  return (
    <span
      aria-label={`Board ${props.board.id} box ${boxIndex + 1}${owner ? ` ${owner}` : " empty"}`}
      className={`dots-box${owner ? ` owned ${owner}` : ""}`}
      key={`box-${boxIndex}`}
    >
      {owner ? formatMark(owner) : ""}
    </span>
  );
}

function DotsBoxesEdgeButton(props: {
  board: DotsBoxesBoardView;
  canAct: boolean;
  edge: string;
  isBusy: boolean;
  onMove: (edge: string) => void;
  orientation: "horizontal" | "vertical";
}) {
  const isDrawn = props.board.drawnEdges.includes(props.edge);

  return (
    <button
      aria-label={`Board ${props.board.id} edge ${props.edge}`}
      aria-pressed={isDrawn}
      className={`edge-button ${props.orientation}${isDrawn ? " drawn" : ""}`}
      disabled={props.isBusy || !props.canAct || !props.board.playableEdges.includes(props.edge)}
      onClick={() => props.onMove(props.edge)}
      type="button"
    />
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

const startingChessFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const chessPromotionOrder = ["q", "r", "b", "n"] as const;
const chessPieceNames: Record<ChessPiece["type"], string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king"
};
const chessPieceGlyphs: Record<ChessPiece["color"], Record<ChessPiece["type"], string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" }
};

type ChessMovePair = {
  readonly number: number;
  readonly white: ChessMoveRecord | null;
  readonly whitePly: number | null;
  readonly black: ChessMoveRecord | null;
  readonly blackPly: number | null;
};

type ChessAnnotationColor = "green" | "red" | "blue" | "yellow";

type ChessAnnotationArrow = {
  readonly color: ChessAnnotationColor;
  readonly from: string;
  readonly to: string;
};

type ChessPremove = {
  readonly from: string;
  readonly to: string;
};

const chessAnnotationSvgColors: Record<ChessAnnotationColor, string> = {
  blue: "rgb(61 111 134 / 90%)",
  green: "rgb(98 158 79 / 90%)",
  red: "rgb(183 79 42 / 90%)",
  yellow: "rgb(222 178 72 / 92%)"
};

function getChessboardPosition(fen: string) {
  return fen === "start" ? startingChessFen : fen;
}

function getChessboardOrientation(board: ChessBoardView, seat: SeatId | null) {
  return seat && board.blackSeat === seat ? "black" : "white";
}

function getChessMovesFromSquare(board: ChessBoardView, square: string) {
  return board.legalMoves.filter((move) => move.from === square);
}

function getChessMovesBetween(board: ChessBoardView, from: string, to: string) {
  return board.legalMoves.filter((move) => move.from === from && move.to === to);
}

function sortPromotionMoves(moves: readonly ChessLegalMove[]) {
  return [...moves].sort(
    (left, right) =>
      chessPromotionOrder.indexOf(left.promotion ?? "q") - chessPromotionOrder.indexOf(right.promotion ?? "q")
  );
}

function toChessMovePayload(move: ChessLegalMove) {
  return move.promotion ? { from: move.from, to: move.to, promotion: move.promotion } : { from: move.from, to: move.to };
}

function getChessAnnotationColor(event: { readonly altKey: boolean; readonly shiftKey: boolean }): ChessAnnotationColor {
  if (event.shiftKey && event.altKey) return "yellow";
  if (event.shiftKey) return "red";
  if (event.altKey) return "blue";
  return "green";
}

function getChessSquareFromEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const squareElement = target.closest("[data-square]");
  if (!(squareElement instanceof HTMLElement)) return null;
  return squareElement.dataset["square"] ?? null;
}

function getChessAnnotationMarkerId(boardId: BoardId, color: ChessAnnotationColor) {
  return `chess-annotation-arrow-${String(boardId).replace(/[^a-zA-Z0-9_-]/g, "-")}-${color}`;
}

function getChessSquareGridPosition(square: string, orientation: "white" | "black") {
  const fileIndex = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number.parseInt(square.slice(1), 10);
  return {
    file: orientation === "white" ? fileIndex : 7 - fileIndex,
    rank: orientation === "white" ? 8 - rank : rank - 1
  };
}

function getChessSquareCenter(square: string, orientation: "white" | "black") {
  const position = getChessSquareGridPosition(square, orientation);
  return {
    x: (position.file + 0.5) * 12.5,
    y: (position.rank + 0.5) * 12.5
  };
}

function getChessSquareStyles(props: {
  readonly checkSquare: string | null;
  readonly lastMove: ChessMoveRecord | null;
  readonly selectedLegalMoves: readonly ChessLegalMove[];
  readonly selectedSquare: string | null;
}) {
  const styles: Record<string, CSSProperties> = {};

  if (props.checkSquare) {
    mergeChessSquareStyle(styles, props.checkSquare, {
      background: "radial-gradient(circle, rgb(183 79 42 / 78%) 0 54%, rgb(183 79 42 / 38%) 55%, transparent 74%)"
    });
  }

  if (props.lastMove?.from && props.lastMove.to) {
    mergeChessSquareStyle(styles, props.lastMove.from, {
      background: "linear-gradient(135deg, rgb(244 209 143 / 72%), rgb(244 209 143 / 52%))"
    });
    mergeChessSquareStyle(styles, props.lastMove.to, {
      background: "linear-gradient(135deg, rgb(244 209 143 / 92%), rgb(244 209 143 / 58%))"
    });
  }

  if (props.selectedSquare) {
    mergeChessSquareStyle(styles, props.selectedSquare, {
      boxShadow: "inset 0 0 0 4px rgb(183 79 42 / 78%)"
    });
  }

  for (const move of props.selectedLegalMoves) {
    mergeChessSquareStyle(
      styles,
      move.to,
      move.captured
        ? { boxShadow: "inset 0 0 0 4px rgb(52 168 83 / 64%)" }
        : { background: "radial-gradient(circle, rgb(52 168 83 / 20%) 0 24%, transparent 25%)" }
    );
  }

  return styles;
}

function mergeChessSquareStyle(styles: Record<string, CSSProperties>, square: string, style: CSSProperties) {
  styles[square] = { ...(styles[square] ?? {}), ...style };
}

function formatChessSquareLabel(
  boardId: BoardId,
  square: string,
  piece: PieceDataType | null,
  state: {
    readonly annotationColor: ChessAnnotationColor | null;
    readonly isCheckedKing: boolean;
    readonly isLastMoveSquare: boolean;
    readonly isLegalTarget: boolean;
    readonly isPremoveDestination: boolean;
    readonly isPremoveSource: boolean;
    readonly isPremoveTarget: boolean;
    readonly isSelected: boolean;
  }
) {
  const base = piece
    ? `Board ${boardId} square ${square} ${formatChessPieceType(piece.pieceType)}`
    : `Board ${boardId} square ${square} empty`;
  const annotation = state.annotationColor ? ` ${state.annotationColor} circle` : "";
  if (state.isCheckedKing) return `${base} in check${annotation}`;
  if (state.isPremoveSource) return `${base} premove source${annotation}`;
  if (state.isPremoveTarget) return `${base} premove target${annotation}`;
  if (state.isSelected) return `${base} selected${annotation}`;
  if (state.isLegalTarget) return `${base} legal destination${annotation}`;
  if (state.isPremoveDestination) return `${base} premove destination${annotation}`;
  if (state.isLastMoveSquare) return `${base} last move${annotation}`;
  return `${base}${annotation}`;
}

function getPieceSeatFromPieceType(board: ChessBoardView, pieceType: string) {
  return pieceType.startsWith("w") ? board.whiteSeat : board.blackSeat;
}

function formatChessPieceType(pieceType: string) {
  const color = pieceType.startsWith("w") ? "white" : "black";
  const piece = pieceType.slice(1).toLowerCase();
  return `${color} ${chessPieceNames[piece as ChessPiece["type"]] ?? "piece"}`;
}

function formatChessColor(color: "w" | "b") {
  return color === "w" ? "White" : "Black";
}

function getSeatForChessColor(board: ChessBoardView, color: "w" | "b") {
  return color === "w" ? board.whiteSeat : board.blackSeat;
}

function formatChessBoardStatus(board: ChessBoardView, currentSeat: SeatId | null, canAct: boolean) {
  if (board.outcome.status !== "in_progress") return formatChessOutcomeStatus(board, currentSeat);
  if (board.takebackRequest && board.takebackRequest.requestedBy === currentSeat) return "Takeback request sent";
  if (board.takebackRequest && currentSeat && board.takebackRequest.requestedBy !== currentSeat) {
    return "Opponent requests takeback";
  }
  if (board.drawOffer && board.drawOffer.offeredBy === currentSeat) return "Draw offer sent";
  if (board.drawOffer && currentSeat && board.drawOffer.offeredBy !== currentSeat) return "Opponent offers draw";
  if (board.seatsToAct.length === 0) return "Waiting";
  if (canAct) return board.isCheck ? "Your king is in check" : "Your move";

  const turnSeat = getSeatForChessColor(board, board.turnColor);
  if (!currentSeat) return board.isCheck ? `${formatChessColor(board.turnColor)} in check` : `${formatChessColor(board.turnColor)} to move`;
  if (turnSeat === currentSeat) return board.isCheck ? "Your king is in check" : "Your move";
  return board.isCheck ? "Opponent in check" : "Opponent to move";
}

function formatChessOutcomeStatus(board: ChessBoardView, currentSeat: SeatId | null) {
  const baseStatus = formatBoardStatus(board, currentSeat);
  if (board.outcome.status !== "win" && board.outcome.status !== "draw") return baseStatus;

  return `${baseStatus} by ${formatChessOutcomeReason(board.outcome.reason)}`;
}

function formatChessOutcomeReason(reason: string) {
  switch (reason) {
    case "insufficient-material":
      return "insufficient material";
    case "threefold-repetition":
      return "threefold repetition";
    case "fifty-move-rule":
      return "fifty-move rule";
    case "draw":
      return "rule";
    default:
      return reason.split("-").join(" ");
  }
}

function getChessMovePairs(moveHistory: readonly ChessMoveRecord[]): ChessMovePair[] {
  const pairs: ChessMovePair[] = [];
  let currentPair = createChessMovePair(1);

  moveHistory.forEach((move, index) => {
    if (move.color === "w") {
      if (currentPair.white || currentPair.black) {
        pairs.push(currentPair);
        currentPair = createChessMovePair(currentPair.number + 1);
      }
      currentPair = { ...currentPair, white: move, whitePly: index + 1 };
      return;
    }

    if (currentPair.black) {
      pairs.push(currentPair);
      currentPair = createChessMovePair(currentPair.number + 1);
    }
    currentPair = { ...currentPair, black: move, blackPly: index + 1 };
    pairs.push(currentPair);
    currentPair = createChessMovePair(currentPair.number + 1);
  });

  if (currentPair.white || currentPair.black) pairs.push(currentPair);
  return pairs;
}

function createChessMovePair(number: number): ChessMovePair {
  return { number, white: null, whitePly: null, black: null, blackPly: null };
}

function formatPromotionPiece(piece: "q" | "r" | "b" | "n") {
  return chessPieceNames[piece];
}

function getPromotionGlyph(move: ChessLegalMove) {
  return chessPieceGlyphs[move.color][move.promotion ?? "q"];
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
