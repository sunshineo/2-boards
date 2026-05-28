# Seven Board Games Design

## Goal

Add seven more playable game plug-ins to FairGame without changing the two-board match engine: Gomoku, Hex, Reversi, Breakthrough, Mancala, Dots and Boxes, and Order and Chaos.

## Scope

Each new game is a normal two-player board game adapted to the existing fair-match model. Board A starts with seat1 and Board B starts with seat2. The match framework continues to understand only generic board outcomes and scoring.

## Game Rules

- Gomoku: 15 by 15 placement game. A move places one stone on an empty cell. Five contiguous stones in any row, column, or diagonal wins; a full board without five is a draw.
- Hex: 11 by 11 placement game. Seat1 connects top to bottom; seat2 connects left to right. A move places one stone on an empty hex. A completed connection wins.
- Reversi: 8 by 8 Othello-style game. Initial four discs are centered. Legal moves must flip at least one bracketed line. If the opponent has no legal move after a move, the turn returns to the mover; if neither player can move, disc count decides win or draw.
- Breakthrough: 8 by 8 movement game. Each side starts with two pawn rows. Pawns move one step forward into an empty square or diagonally forward to capture. Reaching the far rank or removing all opposing pieces wins.
- Mancala: 6-pit Kalah. A move sows stones from one owned pit counter-clockwise, skips the opponent store, captures from the opposite pit when the last stone lands in an empty owned pit, and grants an extra turn when the last stone lands in the mover store. When one side is empty, remaining stones sweep to stores and store count decides win or draw.
- Dots and Boxes: 3 by 3 box grid using 4 by 4 dots. A move draws one undrawn edge. Completed boxes are owned by the mover, and completing at least one box grants another turn. When all edges are drawn, box count decides win or draw.
- Order and Chaos: 6 by 6 placement game. Seat1 is Order and seat2 is Chaos. A move places either X or O on an empty cell. Order wins immediately with five contiguous matching marks; Chaos wins if the board fills without that line.

## Architecture

Workers implement one domain rules module and its unit tests per game in isolated branches. The gate branch then integrates all modules into exports, server game registry, route time ranges, web API types, UI picker, board renderers, thumbnails, server tests, web tests, and e2e coverage.

The implementation keeps game-specific concepts inside rule modules and board renderers. `MatchService`, scoring, clocks, persistence, and room flow remain generic.

## Verification

Verification must include:

- Domain unit tests for each new game.
- Server API tests for create, board projection, legal move application, and invalid move shapes for representative new games.
- Web tests for picker/lobby rendering and one representative board renderer per move family.
- Playwright e2e for creating/joining and making opening moves in the new games.
- Final `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.
- Built-in browser verification after starting the dev server.
