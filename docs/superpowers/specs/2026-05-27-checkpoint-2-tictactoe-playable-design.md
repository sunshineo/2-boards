# Checkpoint 2 TicTacToe Playable Slice Design

## Goal

Make the product playable end-to-end with TicTacToe while preserving the generic
fair-match architecture. This checkpoint should prove that one game can plug into the
domain engine and be played through the server and browser.

## Scope

This checkpoint includes:

- TicTacToe rules as a `GameRules` adapter;
- an in-memory server-side match store;
- REST commands for create, join, read, and move;
- a React UI for create/join/play/finish;
- Playwright coverage for two clients playing both boards to a match result.

This checkpoint does not include:

- Socket.IO real-time updates;
- refresh-safe cookies/seat claims;
- durable persistence;
- spectators;
- clocks;
- Connect Four or Chess.

Those remain later roadmap checkpoints.

## TicTacToe Rules

TicTacToe is implemented as a game module inside `packages/domain/src/games/tictactoe`.
The match framework sees only generic rules:

- `createInitialState(firstSeat)`;
- `getSeatsToAct(state)`;
- `validateMove(state, move, seat)`;
- `applyMove(state, move, seat)`;
- `getOutcome(state)`.

The TicTacToe module owns marks, cells, winning lines, draw detection, and move format.

## Server API

The server owns canonical state. The client sends commands.

- `POST /api/matches`
  - Creates a TicTacToe match.
  - Returns the match view and `seat: "seat1"`.
- `POST /api/matches/:id/join`
  - Joins the second seat.
  - Returns the match view and `seat: "seat2"`.
- `GET /api/matches/:id`
  - Returns the current match view.
- `POST /api/matches/:id/moves`
  - Body: `{ boardId, seat, move }`.
  - Server validates and applies through the domain engine.
  - Returns the updated match view or a command rejection.

Seat continuity is intentionally simple for this checkpoint: the browser keeps its seat
in React state. Refresh-safe cookies are introduced in the real-time room flow checkpoint.

## Web UI

The web app shows the actual product surface, not a landing page:

- create match button;
- join-by-code form;
- current seat label;
- match id/code;
- two TicTacToe boards side by side;
- per-board turn/result labels;
- match score/result summary;
- error message for rejected moves.

The framework-level UI owns the two-board layout, seat label, score, and match result.
The TicTacToe board renderer owns cells and move input.

## Verification

Unit tests:

- TicTacToe starter and turn handling;
- occupied cell rejection;
- wrong-seat rejection through the engine;
- row/column/diagonal wins;
- draw detection.

Server tests:

- create match returns seat 1 and two boards;
- join returns seat 2;
- move applies only through server command;
- invalid move returns a rejection.

E2E:

- browser A creates a match;
- browser B joins by code;
- players make legal moves on both boards;
- both boards finish;
- final combined match score is visible.
