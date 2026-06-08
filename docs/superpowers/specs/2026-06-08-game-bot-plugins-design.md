# Game Bot Plugins Design

## Summary

FairGame should support "play vs bot" for every game. Chess keeps the existing browser Stockfish implementation, but it should sit behind the same automated-seat and bot-capability interface that all other games use. Every non-Chess game gets its own replaceable random legal-move bot module, not one shared cross-game switch.

## Goals

- Add bot support for every supported game type.
- Keep each game's bot implementation separate so it can later be replaced by a stronger engine without changing framework code.
- Keep the framework game-agnostic: it owns automated seats, authorization, match lifecycle, timers, and `/agent-moves`; game plugins own how bot moves are chosen.
- Preserve Chess Stockfish behavior and difficulty controls.
- Start non-Chess bots as simple random legal-move bots.
- Submit all bot moves through normal server validation.

## Non-Goals

- Do not build strong AI for non-Chess games in this pass.
- Do not move Stockfish to the server.
- Do not add multi-bot matches or bot-vs-bot matches.
- Do not interpret game-specific board state inside the framework.
- Do not require persistence schema changes beyond existing snapshot-compatible automated-seat metadata.

## Current State

The app already has a generic-ish `automatedSeat` concept and `/agent-moves`, but the remaining implementation is Chess-specific:

- `apps/server/src/matches/seatAgents.ts` defines `AutomatedSeat` as only `kind: "browser-stockfish"` and `gameType: "chess"`.
- `apps/server/src/matches/routes.ts` accepts bot creation only for Chess and creates a browser Stockfish automated seat directly.
- `apps/web/src/browserChessBot.ts` chooses moves only for Stockfish and only for Chess.
- `apps/web/src/App.tsx` shows bot controls only in the Chess lobby and only starts the Stockfish controller.
- `apps/server/src/games/registry.ts` and `apps/web/src/games/registry.tsx` are now the right places to expose per-game capabilities.

## Architecture

### Automated Seat Metadata

`AutomatedSeat` becomes a generic discriminated shape:

```ts
export type SeatAgentDifficulty = "easy" | "normal" | "hard";

export type AutomatedSeat = {
  readonly seat: SeatId;
  readonly gameType: SupportedGameType;
  readonly kind: string;
  readonly difficulty: SeatAgentDifficulty;
  readonly displayName: string;
};
```

Chess uses:

```ts
{
  seat: "seat2",
  gameType: "chess",
  kind: "browser-stockfish",
  difficulty,
  displayName: "Stockfish Normal"
}
```

Non-Chess games use:

```ts
{
  seat: "seat2",
  gameType: "connect4",
  kind: "random-legal",
  difficulty: "normal",
  displayName: "Connect Four Bot"
}
```

Difficulty is still carried on all automated seats for UI/API consistency, but non-Chess random bots initially ignore it.

### Server Game Bot Capability

Server game plugins expose optional bot creation metadata:

```ts
type GameBotCapability = {
  readonly kind: "browser-stockfish" | "random-legal";
  readonly displayName: string;
  createAutomatedSeat(difficulty: SeatAgentDifficulty): AutomatedSeat;
};

type GameServerPlugin<TState, TMove, TBoardView> = {
  readonly gameType: SupportedGameType;
  readonly label: string;
  readonly clockRange: { readonly min: number; readonly max: number };
  readonly bot?: GameBotCapability;
  createMatch(id: string): FairMatch<TState>;
  parseMove(move: unknown): TMove | null;
  getSeatsToAct(state: TState): readonly SeatId[];
  applyMove(match: FairMatch<TState>, command: ApplyMoveCommand<TMove>): ApplyMoveResult<TState>;
  toBoardView(board: FairBoard<TState>): TBoardView;
};
```

Routes should no longer special-case `gameType !== "chess"` for bot creation. They should:

1. Parse `body.bot` as a request for an automated seat.
2. Look up the selected game plugin.
3. Reject with `unsupported-bot-game` only if the plugin has no `bot` capability.
4. Create the automated seat through `plugin.bot.createAutomatedSeat(difficulty)`.

The existing `/bot-moves` route remains a compatibility alias for `/agent-moves`.

### Web Game Bot Capability

Web game plugins expose bot execution capability separately from rendering metadata:

```ts
type WebGameBotCapability = {
  readonly kind: "browser-stockfish" | "random-legal";
  readonly displayName: string;
  readonly difficulties: readonly SeatAgentDifficulty[];
  chooseMove(input: BotMoveInput): Promise<MovePayload | null>;
};

type WebGamePlugin = {
  readonly gameType: GameType;
  readonly label: string;
  readonly timeRange: { readonly min: number; readonly max: number };
  readonly bot?: WebGameBotCapability;
  renderBoard(props: BoardRendererProps): ReactElement;
};
```

The framework-level controller should run for any `match.automatedSeat`, not only Stockfish. It asks the active game plugin for `bot.chooseMove(input)`, waits a short human-feeling delay, then submits the result through `makeAgentMove`.

Chess can keep its existing Stockfish controller internally, but it should be invoked through the same `chooseMove` interface. Stockfish remains an implementation detail of the Chess web bot module.

### Bot Module Layout

Each game gets a separate module. The exact names can be adjusted during implementation to match local style, but the responsibility split should remain:

```text
apps/web/src/games/bots/chessStockfish.ts
apps/web/src/games/bots/tictactoeRandom.ts
apps/web/src/games/bots/connectFourRandom.ts
apps/web/src/games/bots/gomokuRandom.ts
apps/web/src/games/bots/hexRandom.ts
apps/web/src/games/bots/reversiRandom.ts
apps/web/src/games/bots/breakthroughRandom.ts
apps/web/src/games/bots/mancalaRandom.ts
apps/web/src/games/bots/dotsBoxesRandom.ts
apps/web/src/games/bots/orderChaosRandom.ts
```

No non-Chess random bot should import another game's move-selection logic.

## Random Legal Move Behavior

Each random bot chooses from the legal moves already exposed in that game's board view:

- TicTacToe: choose a random empty index from `cells`.
- Connect Four: choose a random entry from `playableColumns`.
- Gomoku: choose a random entry from `playableCells`.
- Hex: choose a random entry from `playableCells`.
- Reversi: choose a random entry from `playableCells`.
- Breakthrough: choose a random entry from `playableMoves`.
- Mancala: choose a random entry from `playablePits`; the move payload is `{ pit }`. The controller only calls the Mancala bot when `board.seatsToAct.includes(automatedSeat.seat)`, so the local pit index is already for the automated seat.
- Dots and Boxes: choose a random entry from `playableEdges`.
- Order and Chaos: choose a random entry from `playableCells` and randomly choose the mark according to the existing move payload shape.

If a bot is not to move on a board, if the board is finished, or if no legal moves exist, `chooseMove` returns `null`. The controller should then do nothing for that board until the next match update.

## Lobby UX

The lobby should offer a bot mode for every game whose web plugin has `bot`.

- Human mode remains the default.
- Chess bot mode keeps the Easy / Normal / Hard choices and Stockfish labels.
- Non-Chess bot mode can show a single Normal option or hide difficulty controls while still sending `{ difficulty: "normal" }`.
- The create button label should become generic, for example `Creating bot game`, instead of Chess-specific copy.
- Match summary should show the automated opponent display name for every bot kind, not just Stockfish.

## Data Flow

1. User selects a game and chooses bot mode.
2. Web calls `createMatch(gameType, { bot: { difficulty } })`.
3. Server route looks up the game plugin's bot capability and creates `automatedSeat`.
4. Server seats human as `seat1` and automated seat as `seat2`.
5. Match view includes `automatedSeat`.
6. Web bot controller sees the automated seat and looks up the web game plugin.
7. Plugin-specific bot chooses a legal move for one actionable board.
8. Web posts to `/api/matches/:id/agent-moves`.
9. Server validates the seat-agent cookie and applies the move through normal game rules.
10. Realtime updates wake the controller for the next bot turn.

## Error Handling

- Creating a bot match for a game without `bot` capability returns `unsupported-bot-game`.
- If a web plugin lacks a bot capability for an automated match, the UI should show a non-blocking bot error and avoid submitting moves.
- If `chooseMove` returns `null`, the controller should stay idle instead of treating it as a failure.
- If `/agent-moves` rejects a move as invalid, surface the existing bot error state and stop retrying that exact board/action until the match changes.
- Compatibility errors from `/bot-moves` should remain mapped for existing tests and clients.

## Testing

### Domain

No new domain rules are required if all random bots choose from existing board views and server validation remains authoritative.

### Server

- Test that every current game plugin exposes a bot capability.
- Test that non-Chess bot match creation succeeds and returns `automatedSeat`.
- Test that Chess bot match creation still returns `browser-stockfish`.
- Test that bot creation still rejects an unknown/unsupported game or invalid difficulty.
- Test that authorized `/agent-moves` works for a representative non-Chess bot match.
- Keep `/bot-moves` compatibility tests for Chess.

### Web

- Test that the lobby shows bot mode for non-Chess games.
- Test that creating a non-Chess bot match sends `{ bot: { difficulty: "normal" } }`.
- Test each random bot module returns a legal move for a fixture board and `null` when no move is available.
- Test Chess Stockfish is still selected through the generic bot capability.
- Test the generic bot controller submits `/agent-moves` for a non-Chess automated seat.
- Keep existing Chess Stockfish timing and error tests.

### Browser Verification

Run at least:

- Create and play a Chess bot match long enough to confirm Stockfish still moves.
- Create one non-Chess bot match, preferably TicTacToe or Connect Four, and confirm the bot responds.
- Run the existing Playwright suite against local servers.

## Migration and Compatibility

- Existing match snapshots with `bot` or `browserBot` should continue to hydrate through the current compatibility path.
- Existing clients using `/bot-moves` should continue to work for Chess.
- New clients should prefer `automatedSeat` and `/agent-moves`.
- No production database migration is expected because automated-seat metadata is stored inside existing match snapshots.

## Implementation Constraints

- Prefer deterministic randomness in tests by extracting the random picker behind an injectable function or by testing set membership rather than exact selection.
- Do not add server-side bot move generation in this pass. Non-Chess random bots should run in the browser, matching the current browser-owned Stockfish model.
- Keep bot timing in one generic controller so individual bot modules only choose moves.
