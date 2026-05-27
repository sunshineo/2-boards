# Checkpoint 7 Chess Design

## Goal

Add chess as a third game through the existing game-registry boundary, using `chess.js`
for legal move generation and rule adjudication.

## Domain

Chess state stores FEN, seats, which seat is white, which seat is black, and move
history. The first seat for a board plays white, so Player 1 is white on Board A and
Player 2 is white on Board B.

Chess moves use coordinate input:

```ts
{ from: "e2", to: "e4", promotion?: "q" | "r" | "b" | "n" }
```

The adapter delegates legal move validation, castling, en passant, promotion, check,
checkmate, stalemate, repetition, insufficient material, and fifty-move draws to
`chess.js`. Board outcomes stay generic: checkmate is a win, all chess draws are draws,
and reasons are strings such as `checkmate`, `stalemate`, or `insufficient-material`.

## Server

The server registry adds a `chess` definition that creates chess matches, parses chess
move payloads, applies moves, gets active seats, and projects chess board views. The
match service remains unchanged at the orchestration level.

Chess board views expose:

- `kind: "chess"`;
- FEN;
- 64 square records with square name and optional piece;
- white and black seats;
- seats to act;
- move history.

## UI

The setup selector adds Chess. Chess boards render as 8x8 square buttons. A player
selects one of their pieces, then clicks a destination square. Promotions default to
queen for this checkpoint. Move history appears next to each board.

## Testing

Domain tests prove legal moves, illegal moves, checkmate, stalemate/draw, castling,
en passant, and promotion. Server tests prove chess create/move commands and a two-board
Fool's Mate match that scores `1 - 1`. E2E verifies that a player can create a chess
match and make an opening move through the browser UI.

## Self-Review

- The framework remains game-agnostic.
- Chess complexity is isolated to the domain adapter, server registry projection, and
  chess board UI.
- Promotion UI is intentionally queen-only for now, but the API supports explicit
  promotion pieces.
