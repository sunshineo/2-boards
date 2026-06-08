import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { io } from "socket.io-client";

import {
  ApiError,
  createMatch,
  getApiBaseUrl,
  joinMatch,
  makeAgentMove,
  listOpenMatches,
  makeMove,
  restoreSession
} from "./api";
import {
  createBrowserGameBotController,
  type BrowserGameBotController,
  type BrowserGameBotStatus
} from "./browserChessBot";
import {
  gameOptions,
  gameTimeRanges,
  getGameLabel,
  getWebGamePlugin,
  isGameType,
  renderGameBoard
} from "./games/registry";
import type {
  AutomatedSeat,
  BoardId,
  BrowserChessBotDifficulty,
  GameType,
  MatchClockView,
  MatchView,
  MovePayload,
  OpenMatchView,
  SeatId,
  SeatSession
} from "./types";

const quickTimeOptions: readonly { readonly minutes: number; readonly label: string; readonly pace: string }[] = [
  { minutes: 3, label: "3 min", pace: "Fast" },
  { minutes: 5, label: "5 min", pace: "Normal" },
  { minutes: 10, label: "10 min", pace: "Long" }
];

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
  const [isChessZenMode, setIsChessZenMode] = useState(false);
  const [createMode, setCreateMode] = useState<"human" | "bot">("human");
  const [botDifficulty, setBotDifficulty] = useState<BrowserChessBotDifficulty>("normal");
  const [isCreatingBrowserBotGame, setIsCreatingBrowserBotGame] = useState(false);
  const [browserBotStatus, setBrowserBotStatus] = useState<BrowserGameBotStatus>("idle");
  const [browserBotRetryVersion, setBrowserBotRetryVersion] = useState(0);
  const restoreRequestRef = useRef<{ readonly matchId: string; readonly promise: Promise<SeatSession> } | null>(null);
  const mutationVersionRef = useRef(0);
  const isBusyRef = useRef(false);
  const isChessMatchActiveRef = useRef(false);
  const browserBotControllerRef = useRef<BrowserGameBotController | null>(null);
  const lobbyGame = route.view === "lobby" ? route.gameType : null;
  const activeSession = route.view === "match" && session?.match.id === route.matchId ? session : null;
  const isChessMatchActive = activeSession?.match.gameType === "chess";
  const activeAutomatedSeat = activeSession ? getAutomatedSeat(activeSession.match) : null;
  const selectedGamePlugin = lobbyGame ? getWebGamePlugin(lobbyGame) : null;
  const selectedBotCapability = selectedGamePlugin?.bot ?? null;
  const selectedBotDifficulty = selectedBotCapability?.difficulties.includes(botDifficulty) ? botDifficulty : "normal";
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
    const matchId = activeAutomatedSeat ? activeSession?.match.id ?? null : null;
    if (!matchId) {
      browserBotControllerRef.current?.dispose();
      browserBotControllerRef.current = null;
      setBrowserBotStatus("idle");
      return;
    }

    const controller = createBrowserGameBotController({
      onStatus: setBrowserBotStatus,
      submitMove: async ({ boardId, move }) => {
        const match = await makeAgentMove({ matchId, boardId, move });
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
  }, [activeAutomatedSeat?.kind, activeAutomatedSeat?.seat, activeSession?.match.id]);

  useEffect(() => {
    if (!activeAutomatedSeat || !activeSession) return;
    void browserBotControllerRef.current?.runForMatch(activeSession.match);
  }, [activeAutomatedSeat?.kind, activeAutomatedSeat?.seat, activeSession?.match, browserBotRetryVersion]);

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
    const shouldCreateBot = createMode === "bot" && !!selectedBotCapability;
    setIsCreatingBrowserBotGame(shouldCreateBot);
    try {
      await run(async () => {
        const nextSession = await createMatch(lobbyGame, {
          clockInitialMs: minutesToMs(minutes, lobbyGame),
          ...(shouldCreateBot ? { bot: { difficulty: selectedBotDifficulty } } : {})
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
    const automatedSeat = getAutomatedSeat(session.match);
    await run(async () => {
      const nextSession = await createMatch(session.match.gameType, {
        ...(session.match.clock ? { clockInitialMs: session.match.clock.config.initialMs } : {}),
        ...(automatedSeat ? { bot: { difficulty: automatedSeat.difficulty } } : {})
      });
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
  const activeBrowserBotStatus = activeAutomatedSeat ? browserBotStatus : "idle";
  const shouldShowFloatingBotStatus =
    !!activeAutomatedSeat &&
    activeBrowserBotStatus !== "idle" &&
    activeBrowserBotStatus !== "thinking" &&
    !isChessZenModeActive;

  return (
    <main className={appShellClassName}>
      {error || shouldShowFloatingBotStatus ? (
        <div className="floating-alerts" aria-live="polite">
          {shouldShowFloatingBotStatus ? (
            <div
              className={`bot-status${activeBrowserBotStatus === "error" ? " error" : ""}`}
              role={activeBrowserBotStatus === "error" ? "alert" : "status"}
            >
              <span>{formatBrowserBotStatus(activeBrowserBotStatus)}</span>
              {activeBrowserBotStatus === "error" ? (
                <button className="secondary-button compact-button" onClick={handleBrowserBotRetry} type="button">
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="error-banner" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

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
              {selectedBotCapability ? (
                <div className="mode-section" aria-label="Opponent">
                  <div className="mode-toggle" role="group" aria-label="Opponent">
                    <button
                      aria-pressed={createMode === "human"}
                      className={createMode === "human" ? "selected" : ""}
                      disabled={isBusy}
                      onClick={() => setCreateMode("human")}
                      type="button"
                    >
                      Human
                    </button>
                    <button
                      aria-pressed={createMode === "bot"}
                      className={createMode === "bot" ? "selected" : ""}
                      disabled={isBusy}
                      onClick={() => setCreateMode("bot")}
                      type="button"
                    >
                      Bot
                    </button>
                  </div>
                  {createMode === "bot" && selectedBotCapability.difficulties.length > 1 ? (
                    <div className="difficulty-grid" role="group" aria-label="Bot difficulty">
                      {selectedBotCapability.difficulties.map((difficulty) => (
                        <button
                          aria-pressed={selectedBotDifficulty === difficulty}
                          className={selectedBotDifficulty === difficulty ? "selected" : ""}
                          disabled={isBusy}
                          key={difficulty}
                          onClick={() => setBotDifficulty(difficulty)}
                          type="button"
                        >
                          {formatBotDifficulty(difficulty)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="quick-time-grid">
                {quickTimeOptions.map((option) => (
                  <button
                    aria-label={`${option.label} ${option.pace}`}
                    aria-pressed={customMinutes === option.minutes}
                    className={`time-preset-button${customMinutes === option.minutes ? " selected" : ""}`}
                    disabled={isBusy}
                    key={option.minutes}
                    onClick={() => setCustomMinutes(clampMinutes(option.minutes, selectedGameTimeRange))}
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
  onMove: (boardId: BoardId, move: MovePayload) => void;
  onRematch: () => void;
  isBusy: boolean;
  isZenMode: boolean;
}) {
  const status = formatMatchStatus(props.match, props.seat);
  const canRematch = props.match.outcome.status !== "in_progress" && !props.isZenMode;
  const matchRoomClassName = `match-room${props.match.gameType === "chess" ? " chess-match-room" : ""}${props.isZenMode ? " zen-match-room" : ""}`;
  const automatedSeat = getAutomatedSeat(props.match);

  return (
    <section
      aria-label={`${props.match.gameLabel} match`}
      className={matchRoomClassName}
      data-zen-mode={props.isZenMode ? "true" : "false"}
    >
      {props.isZenMode ? null : (
        <div className={`match-summary${automatedSeat ? " bot-match-summary" : ""}`}>
          <div>
            <span className="meta-label">Game</span>
            <strong data-testid="match-code" data-match-id={props.match.id}>
              {props.match.gameLabel}
            </strong>
          </div>
          {automatedSeat ? (
            <div>
              <span className="meta-label">Opponent</span>
              <strong data-testid="match-opponent-name">{automatedSeat.displayName}</strong>
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

      <ClockStrip clock={props.match.clock} currentSeat={props.seat} />

      <div className="boards-grid">
        {props.match.boards.map((board) => (
          <Fragment key={board.id}>
            {renderGameBoard({
              board,
              currentSeat: props.seat,
              isBusy: props.isBusy,
              onMove: (move) => props.onMove(board.id, move)
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

function formatBrowserBotStatus(status: BrowserGameBotStatus) {
  if (status === "loading") return "Bot loading";
  if (status === "error") return "Bot move failed";
  return "";
}

function formatBotDifficulty(difficulty: BrowserChessBotDifficulty) {
  return `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)}`;
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

function formatScore(match: MatchView) {
  if (match.outcome.status === "canceled") return "Canceled";
  return `${match.outcome.score.seat1} - ${match.outcome.score.seat2}`;
}

function getAutomatedSeat(match: MatchView): AutomatedSeat | null {
  return match.automatedSeat ?? match.bot ?? null;
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
