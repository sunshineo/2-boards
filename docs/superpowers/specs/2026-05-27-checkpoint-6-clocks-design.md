# Checkpoint 6 Clock System Design

## Goal

Add shared player clocks that work across both boards without adding game-specific
knowledge to the fair-match framework.

## Semantics

Each seat has one match clock. A seat's clock runs when that seat is to-move on at
least one unfinished board. If both seats are to-move on different boards, both clocks
run at the same time. A seat to-move on both boards spends clock time once, not twice.

Clocks start only after both seats have joined. Creating a match reserves Player 1's
seat but does not start either clock while Player 2 is absent.

On an accepted move:

1. Charge elapsed wall-clock time to all currently running seats.
2. If any seat expires, reject the move as `clock-expired` and resolve unfinished boards
   by timeout.
3. Apply the move.
4. Add increment to the moving seat.
5. Recompute running seats from all unfinished boards.

Timeout is generic. If one seat expires, every unfinished board becomes a win for the
opponent with reason `timeout`. If both seats expire in the same advancement, every
unfinished board becomes a draw with reason `mutual-timeout`.

## Architecture

Clock math lives in the domain package as pure functions and types. `MatchService` owns
wall-clock time, starts clocks on join, advances clocks on reads and commands, persists
timeout outcomes, and includes a clock view in `MatchView`.

The game registry remains responsible for asking each game which seats are currently
to-move. The clock system consumes only generic `SeatId` activity and generic board
outcomes.

## UI

The match summary shows one clock per player, remaining seconds, and whether it is
running. This checkpoint uses server-returned time values after create, join, refresh,
and moves; live client-side countdown animation can be improved later.

## Testing

Domain tests cover zero, one, and two running seats, increments, single timeout, and
mutual timeout. Server tests use an injected `nowMs()` source to verify clocks start on
join, both clocks run at the opening position, a move can leave only one clock running,
and timeout resolves unfinished boards.

## Self-Review

- No game-specific concepts are interpreted by the clock system.
- Timeout resolution uses only generic board outcomes and existing scoring.
- The design avoids background server timers; clocks advance deterministically on reads
  and commands, which keeps tests reliable and persistence explicit.
