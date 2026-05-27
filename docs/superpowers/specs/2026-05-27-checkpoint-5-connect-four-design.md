# Checkpoint 5 Connect Four Design

## Goal

Add Connect Four as the second playable game while keeping the two-board match
framework game-agnostic.

## Design

Connect Four lives in the domain package as another `GameRules` implementation. Its
state owns rows, columns, cells, next seat, and board outcome. A move is `{ column }`.
The rules module owns gravity, legal column validation, four-in-row detection, and draw
detection.

The server gets a small supported-game registry. `MatchService` asks the registry to
create a match, parse a move body, apply a move, and project board state into a view.
The service should not know about TicTacToe cells or Connect Four columns beyond passing
commands through the registry.

The web app adds a setup-time game selector. Match views become a discriminated union
where each board view declares its renderer:

- TicTacToe board views expose `kind: "tictactoe"` and nine cells.
- Connect Four board views expose `kind: "connect4"`, six rows, seven columns, cells,
  and playable columns.

The board renderer switches by board `kind`. TicTacToe keeps the existing 3x3 button
grid. Connect Four renders seven column buttons, each containing six visible slots.
Clicking a column sends `{ column }`.

## API

`POST /api/matches` accepts an optional `gameType`:

```json
{ "gameType": "connect4" }
```

If omitted, the server creates TicTacToe for backward compatibility. Unsupported game
types return `400 { "error": "unsupported-game" }`.

`POST /api/matches/:id/moves` continues to accept generic command envelopes. The server
validates the move shape against the match's game type.

## Testing

Domain tests cover initial turns, gravity, illegal moves, vertical/horizontal/diagonal
wins, and draw detection. Server tests prove Connect Four creation and moves use the
same match API. Playwright gets a Connect Four flow where both boards finish with one
win per player, producing a `1 - 1` fair-match draw.

## Self-Review

- No placeholders or deferred requirements.
- The design keeps game-specific move parsing and board projection outside the match
  service.
- Scope is limited to Connect Four and the registry/renderer boundary needed to add it.
