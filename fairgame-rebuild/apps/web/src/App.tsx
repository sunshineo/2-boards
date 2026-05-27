import { type FormEvent, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { ApiError, createMatch, getApiBaseUrl, joinMatch, makeMove, restoreSession } from "./api";
import type {
  BoardId,
  ChessBoardView,
  ChessPiece,
  ChessSquareView,
  ConnectFourBoardView,
  GameType,
  MatchBoardView,
  MatchClockView,
  MatchView,
  MovePayload,
  SeatId,
  SeatSession,
  TicTacToeBoardView
} from "./types";

const gameOptions: readonly { readonly gameType: GameType; readonly label: string }[] = [
  { gameType: "tictactoe", label: "TicTacToe" },
  { gameType: "connect4", label: "Connect Four" },
  { gameType: "chess", label: "Chess" }
];

export function App() {
  const [session, setSession] = useState<SeatSession | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameType>("tictactoe");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const matchId = new URLSearchParams(window.location.search).get("match");
    if (!matchId) return;

    let isCurrent = true;
    setIsBusy(true);
    restoreSession(matchId)
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
  }, []);

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

  async function handleCreate() {
    await run(async () => {
      const nextSession = await createMatch(selectedGame);
      setSession(nextSession);
      setMatchUrl(nextSession.match.id);
    });
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matchId = joinCode.trim();
    if (!matchId) return;

    await run(async () => {
      const nextSession = await joinMatch(matchId);
      setSession(nextSession);
      setMatchUrl(nextSession.match.id);
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

  const selectedGameLabel = getGameLabel(selectedGame);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">FairGame</p>
          <h1>Two-board fair games</h1>
        </div>
        {session ? (
          <button className="secondary-button" onClick={handleRefresh} disabled={isBusy}>
            Refresh
          </button>
        ) : null}
      </header>

      {session ? (
        <MatchRoom
          match={session.match}
          seat={session.seat}
          onMove={handleMove}
          isBusy={isBusy}
        />
      ) : (
        <section className="setup-grid" aria-label="Match setup">
          <div className="panel">
            <h2>Create</h2>
            <fieldset className="game-selector" aria-label="Game">
              {gameOptions.map((option) => (
                <label className="game-option" key={option.gameType}>
                  <input
                    checked={selectedGame === option.gameType}
                    name="game-type"
                    onChange={() => setSelectedGame(option.gameType)}
                    type="radio"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <p>Start a new fair two-board {selectedGameLabel} match as Player 1.</p>
            <button className="primary-button" onClick={handleCreate} disabled={isBusy}>
              Create {selectedGameLabel} match
            </button>
          </div>
          <form className="panel" onSubmit={handleJoin}>
            <h2>Join</h2>
            <label htmlFor="join-code">Match code</label>
            <input
              id="join-code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="match id"
            />
            <button className="primary-button" disabled={isBusy || !joinCode.trim()}>
              Join match
            </button>
          </form>
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
  isBusy: boolean;
}) {
  return (
    <section className="match-room" aria-label={`${props.match.gameLabel} match`}>
      <div className="match-summary">
        <div>
          <span className="meta-label">Match code</span>
          <strong data-testid="match-code">{props.match.id}</strong>
        </div>
        <div>
          <span className="meta-label">Your seat</span>
          <strong>{props.seat ? formatSeat(props.seat) : "Spectator"}</strong>
        </div>
        <div>
          <span className="meta-label">Invite URL</span>
          <strong data-testid="invite-url">{getInviteUrl(props.match.id)}</strong>
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
  if (!props.clock) return null;

  return (
    <section className="clock-strip" aria-label="Player clocks">
      {(["seat1", "seat2"] as const).map((seat) => {
        const seatClock = props.clock?.seats[seat];
        return (
          <div
            aria-label={`${formatSeat(seat)} clock`}
            className={`clock-card${seatClock?.isRunning ? " running" : ""}`}
            key={seat}
          >
            <span className="meta-label">{formatSeat(seat)}</span>
            <strong>{formatClockMs(seatClock?.remainingMs ?? 0)}</strong>
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

  function handleSquareClick(square: ChessSquareView) {
    if (!canAct) return;

    if (selectedSquare) {
      if (selectedSquare === square.square) {
        setSelectedSquare(null);
        return;
      }

      props.onMove({ from: selectedSquare, to: square.square, promotion: "q" });
      setSelectedSquare(null);
      return;
    }

    if (square.piece && getPieceSeat(props.board, square.piece) === props.currentSeat) {
      setSelectedSquare(square.square);
    }
  }

  return (
    <section className="board-panel" aria-label={`Board ${props.board.id}`}>
      <div className="board-heading">
        <h2>Board {props.board.id}</h2>
        <p>{formatBoardStatus(props.board)}</p>
      </div>
      <div className="chess-layout">
        <div className="chess-grid">
          {props.board.squares.map((square, index) => (
            <button
              aria-label={formatChessSquareLabel(props.board.id, square)}
              className={`chess-square ${getChessSquareTone(index)}${
                selectedSquare === square.square ? " selected" : ""
              }`}
              disabled={props.isBusy || !canAct}
              key={square.square}
              onClick={() => handleSquareClick(square)}
            >
              {square.piece ? getChessPieceSymbol(square.piece) : ""}
            </button>
          ))}
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
    <section className="board-panel" aria-label={`Board ${props.board.id}`}>
      <div className="board-heading">
        <h2>Board {props.board.id}</h2>
        <p>{formatBoardStatus(props.board)}</p>
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
    <section className="board-panel" aria-label={`Board ${props.board.id}`}>
      <div className="board-heading">
        <h2>Board {props.board.id}</h2>
        <p>{formatBoardStatus(props.board)}</p>
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

function formatSeat(seat: SeatId) {
  return seat === "seat1" ? "Player 1" : "Player 2";
}

function formatMark(seat: SeatId) {
  return seat === "seat1" ? "X" : "O";
}

function formatChessSquareLabel(boardId: BoardId, square: ChessSquareView) {
  if (!square.piece) return `Board ${boardId} square ${square.square} empty`;
  return `Board ${boardId} square ${square.square} ${formatChessColor(square.piece.color)} ${formatChessPieceType(
    square.piece.type
  )}`;
}

function getPieceSeat(board: ChessBoardView, piece: ChessPiece) {
  return piece.color === "w" ? board.whiteSeat : board.blackSeat;
}

function formatChessColor(color: ChessPiece["color"]) {
  return color === "w" ? "white" : "black";
}

function formatChessPieceType(type: ChessPiece["type"]) {
  const names: Record<ChessPiece["type"], string> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king"
  };
  return names[type];
}

function getChessPieceSymbol(piece: ChessPiece) {
  const symbols: Record<ChessPiece["color"], Record<ChessPiece["type"], string>> = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
  };
  return symbols[piece.color][piece.type];
}

function getChessSquareTone(index: number) {
  const row = Math.floor(index / 8);
  const column = index % 8;
  return (row + column) % 2 === 0 ? "light" : "dark";
}

function formatClockMs(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

function setMatchUrl(matchId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("match", matchId);
  window.history.replaceState(null, "", url);
}

function getInviteUrl(matchId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("match", matchId);
  return url.toString();
}
