# Browser Stockfish Bot Design

## Goal

Add a production-ready "Play vs Bot" mode for Chess where the chess engine runs in the user's browser, while the FairGame server remains authoritative for match state, clocks, persistence, legal move validation, and realtime updates.

## Decisions

- Use the `stockfish` npm package from `nmrugg/stockfish.js`, starting with the lite single-threaded Stockfish 18 WASM build.
- Run Stockfish in a browser Web Worker only for Chess bot matches.
- Keep the server authoritative for all match changes. Browser Stockfish proposes moves; the server validates and applies them.
- Implement this as a production feature, not as a local-only debug mode.
- Keep bot games simple: normal Chess matches where the human receives `seat1` and the bot occupies `seat2`.
- Bot games only progress while the human player's browser tab is open. If the tab closes, the bot stops; when the player restores the match, the bot resumes if it is still the bot's turn.
- Use three initial difficulty presets: Easy, Normal, Hard.
- Keep bot identity lightweight. A bot display name is enough for the first version.

## Non-Goals

- Do not run Stockfish on the server.
- Do not build a custom chess engine or heuristic bot.
- Do not add ratings, accounts, or bot-game history distinctions beyond the existing match model.
- Do not support human take-over of the bot seat in the first version.
- Do not support bot play for non-Chess games in this spec.
- Do not implement a fully local/offline practice board that bypasses server match flow.

## User Flow

The Chess lobby/create panel gets a mode control with `Human` and `Bot`.

When `Bot` is selected, the UI shows difficulty buttons:

- `Easy`
- `Normal`
- `Hard`

When the player starts a bot game:

1. The web app sends `gameType: "chess"` and the selected bot difficulty to the create-match API.
2. The server creates a normal Chess match.
3. The server assigns the human to `seat1`.
4. The server marks `seat2` as joined by the bot.
5. The server stores bot metadata on the match.
6. The server returns the human seat session and sets a hidden bot-control authorization cookie.
7. The match screen opens normally.
8. The browser starts the bot controller for that match.
9. When a Chess board is waiting for `seat2`, the controller asks Stockfish for a move and submits it through the bot move API.

## Bot Difficulty

Use Stockfish UCI options and real search time. The first preset values are:

| Preset | Bot Name | Stockfish Skill Level | Move Time |
| --- | --- | ---: | ---: |
| Easy | Stockfish Easy | 2 | 1200 ms |
| Normal | Stockfish Normal | 7 | 2500 ms |
| Hard | Stockfish Hard | 12 | 5000 ms |

The bot uses `go movetime <ms>` so the bot clock visibly counts down while the engine thinks.

If Stockfish fails to load, crashes, times out, or returns an invalid move, the UI shows a recoverable bot error and does not submit a fake or random fallback move in production.

## Server Model

Add bot metadata to stored matches. The metadata should be absent for normal human matches and present for bot matches.

Use this metadata shape:

```ts
type MatchBot = {
  seat: "seat2";
  kind: "browser-stockfish";
  difficulty: "easy" | "normal" | "hard";
  displayName: string;
};
```

The match view should expose enough bot metadata for the browser to start the controller:

```ts
type MatchView = {
  // existing fields
  bot?: MatchBot;
};
```

The server must create bot games through an explicit creation option rather than by overloading player names.

Use this create request extension:

```ts
type CreateMatchRequest = {
  gameType: GameType;
  clockInitialMs?: number;
  playerName?: string;
  bot?: {
    difficulty: "easy" | "normal" | "hard";
  };
};
```

Server validation rules:

- `bot` is accepted only when `gameType === "chess"`.
- Bot difficulty must be one of `easy`, `normal`, `hard`.
- A bot match starts with both seats joined.
- The bot seat is always `seat2` in the first version.
- Bot metadata is persisted in snapshots and events.
- Bot matches do not appear in the open-match list because `seat2` is already joined.
- Existing session restore continues to return the human seat claim to the browser that created the match.

## Bot Move Authorization

Browser-hosted Stockfish is untrusted. The server must authorize bot moves separately from normal human moves.

Add a bot-control secret for bot matches. The creating browser receives it as an HTTP-only cookie scoped to the match. The JavaScript app does not need to read the cookie; `fetch` sends it with credentials.

Add a dedicated bot move endpoint:

```http
POST /api/matches/:id/bot-moves
```

Request body:

```json
{
  "boardId": "A",
  "move": { "from": "e7", "to": "e5" }
}
```

Authorization and validation:

- Reject if the match does not exist.
- Reject if the match has no browser Stockfish bot metadata.
- Reject if the bot-control cookie is missing or invalid.
- Reject if the requested board is not a Chess board.
- Reject if the match or board is complete.
- Reject if `seat2` is not one of the board's `seatsToAct`.
- Parse and validate the move with the existing Chess move parser.
- Apply the move as `seat2` through the same server-side match application path used by normal moves.
- Emit the normal match update event after success.

Normal human move endpoints should continue to require the human's current seat flow. The bot endpoint must not accept a user-supplied seat.

## Chess Control Actions

The bot does not initiate draw offers, takeback requests, or resignations.

If the human offers a draw or requests a takeback while the bot controls the opposing seat, the browser bot controller submits an automatic bot response:

- Human draw offer -> bot submits `{ "declineDraw": true }`
- Human takeback request -> bot submits `{ "declineTakeback": true }`

These control responses use the same bot move endpoint and the same bot-control authorization.

## Browser Bot Controller

Add a focused browser bot subsystem rather than embedding engine logic in the board component.

Responsibilities:

- Detect whether the active match is a Chess browser-bot match.
- Start one Stockfish worker per active bot match tab.
- Configure Stockfish with the selected preset.
- Watch match updates and identify when `seat2` needs to act.
- Select one actionable Chess board at a time.
- Send the board FEN to Stockfish.
- Wait for `bestmove`.
- Convert UCI bestmove into the existing move payload.
- Submit the move through `/api/matches/:id/bot-moves`.
- Auto-decline draw and takeback requests from the human.
- Avoid duplicate submissions while a bot move is already in flight.
- Stop thinking when the match ends, the browser leaves the match, or the board no longer needs the bot.
- Resume after restore if the match still needs a bot move.

The controller should validate Stockfish output against `board.legalMoves` before submitting. Promotion moves must include the promotion piece from the Stockfish UCI move, such as `e7e8q`.

## Asset Loading

Do not bundle Stockfish into the main React JavaScript bundle.

Install `stockfish` as a web-app dependency and copy `stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm` from `node_modules/stockfish/bin/` into `apps/web/public/vendor/stockfish/` before local dev and production builds. The copied files are generated build assets and should not be hand-edited.

The worker loader should reference stable same-origin URLs so local development and production deployments both load the engine without CDN dependency.

If the selected Stockfish build requires special headers for multithreading, do not use that build for the first version. The first version should prefer the single-threaded lite build to avoid cross-origin isolation requirements.

## UI States

The match UI should stay close to the current Chess experience.

Required bot states:

- Creating bot game
- Loading bot engine
- Bot thinking
- Bot move failed with retry action

The bot state can be lightweight text near the Chess match controls or status area. It should not block normal board rendering.

The bot should not move instantly. Thinking time comes from Stockfish `movetime`, so the opponent clock naturally ticks while the engine searches.

## Error Handling

Recoverable browser-side errors:

- Stockfish worker fails to load.
- Worker returns malformed output.
- Worker returns a move not present in `board.legalMoves`.
- Bot move submission returns a stale-match error because the board changed before submission.

Behavior:

- Show a bot error state.
- Keep the match playable and restorable.
- Offer retry when the bot still needs to act.
- Do not submit random legal moves as fallback.

Server-side errors:

- Unauthorized bot move returns 403.
- Invalid bot move returns 400 with the current match when available.
- Missing match returns 404.
- Bot move against a non-bot match returns 409.

## Security Notes

Client-side bot games are casual product games, not trusted competitive games. A user can tamper with browser code or intercept requests. The server protects the match from arbitrary third parties by requiring the hidden bot-control cookie, and it protects game integrity by validating every move before applying it.

If the product later adds ratings, prizes, public leaderboards, or anti-cheat-sensitive outcomes, bot games should be excluded from those systems or moved to server-side engine execution.

## Testing Strategy

Server tests:

- Creating a Chess bot match joins `seat2` immediately and stores bot metadata.
- Creating a bot match for a non-Chess game is rejected.
- Bot match creation sets the bot-control cookie.
- Bot move endpoint rejects missing or invalid bot-control cookies.
- Bot move endpoint rejects attempts against normal human matches.
- Bot move endpoint applies legal `seat2` moves and advances clocks.
- Bot move endpoint rejects illegal moves.
- Draw offer and takeback request declines work through the bot endpoint.
- Bot metadata survives snapshot serialization/deserialization.

Web unit tests:

- Chess lobby shows `Human` / `Bot` mode control.
- Difficulty buttons appear only in Bot mode.
- Creating a bot game sends the selected difficulty.
- Bot controller starts only for browser Stockfish bot matches.
- Bot controller does not start for human matches or non-Chess matches.
- UCI bestmove conversion handles normal moves and promotions.
- Bot controller validates worker moves against `board.legalMoves`.
- Bot controller avoids duplicate in-flight submissions.
- Bot load failure displays recoverable UI state.

Browser verification:

- Start the local web and API servers.
- Create a Chess bot game in Bot mode with Normal difficulty.
- Make a human move.
- Verify the bot clock visibly counts down while Stockfish thinks.
- Verify a bot move appears and the match remains synchronized through Socket.IO.
- Offer a draw and verify the bot declines.
- Request a takeback and verify the bot declines.
- Refresh the match while it is the bot's turn and verify the bot resumes.

## Rollout

The previous local server-side heuristic Chess bot is retired after the browser Stockfish bot is implemented and verified.

Add a production feature flag for cautious rollout:

```env
VITE_BROWSER_CHESS_BOT=true
FAIRGAME_BROWSER_CHESS_BOT=true
```

The web flag controls whether the UI exposes Bot mode. The server flag controls whether bot match creation and bot move endpoints are enabled. Production can enable both when ready.

After browser bot mode is stable, keep the browser Stockfish path as the only Chess bot architecture.

## References

- Browser engine package: https://github.com/nmrugg/stockfish.js
- Stockfish UCI options: https://official-stockfish.github.io/docs/stockfish-wiki/UCI-%26-Commands.html
