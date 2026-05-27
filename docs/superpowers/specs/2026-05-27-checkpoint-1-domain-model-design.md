# Checkpoint 1 Domain Model Design

## Goal

Implement the generic fair-match domain model and pure server-side match engine. This
checkpoint should prove the two-board fairness model without relying on UI behavior or
any specific game implementation.

## Scope

This checkpoint covers:

- generic seats, boards, board outcomes, match outcomes, and scoring;
- a `GameRules` interface that lets each game own state, move validation, move
  application, and outcome detection;
- pure functions to create a fair match and apply a move to one board;
- unit tests for starter assignment, independent board turns, illegal move rejection,
  match scoring, and whole-match cancellation.

This checkpoint does not cover room creation, persistence, sockets, cookies, clocks,
TicTacToe-specific rules, or UI gameplay.

## Domain Boundary

The framework may know:

- a match has two seats and two boards;
- board A starts with seat 1 and board B starts with seat 2;
- a board may be in progress, won, drawn, or canceled;
- a canceled board outcome cancels the whole match;
- scoring maps generic win/draw outcomes to match points.

The framework must not know game-specific concepts such as marks, columns, captures,
checkmate, stalemate, legal chess moves, or draw offers.

## Core Types

The domain package owns the generic match types:

- `FairMatch<TState>`: immutable match state with two boards.
- `FairBoard<TState>`: board id, first seat, current game state, and generic outcome.
- `GameRules<TState, TMove>`: game adapter interface.
- `ApplyMoveCommand<TMove>`: board id, seat id, and game-specific move payload.
- `ApplyMoveResult<TState>`: success or rejected command with reason.
- `MatchOutcome`: in-progress score, completed score/winner, or canceled reason.

The shared package continues to own cross-app identifiers and `BoardOutcome`.

## Scoring

- Win: winner receives `1`, loser receives `0`.
- Draw: both seats receive `0.5`.
- In-progress board: no score yet.
- Canceled: whole match is canceled and no completed match score is produced.
- Completed match winner is the seat with more points; `winner` is `null` for tied scores.

## Engine Behavior

`createFairMatch` creates board A and board B using the same `GameRules` adapter:

- board A initial state uses `firstSeat: "seat1"`;
- board B initial state uses `firstSeat: "seat2"`;
- both boards start with `outcome: { status: "in_progress" }`.

`applyMoveToMatch`:

- rejects moves after match completion or cancellation;
- rejects unknown boards;
- rejects moves on boards that are no longer in progress;
- asks game rules which seats may act on the board;
- rejects commands from seats not allowed to act;
- delegates move validation to the game rules;
- applies a valid move only to the targeted board;
- refreshes only that board's outcome from the game rules;
- returns a new immutable match value.

## Verification

Unit tests should cover:

- board A/B starter assignment;
- independent board state after a move;
- wrong-seat rejection without mutation;
- game validation rejection without mutation;
- win and draw scoring across two boards;
- whole-match cancellation from a canceled board outcome;
- rejecting moves after completion.
