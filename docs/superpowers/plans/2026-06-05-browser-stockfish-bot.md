# Browser Stockfish Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production-ready Chess "Play vs Bot" mode described in `docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md`.

**Architecture:** The server creates and authorizes browser-bot matches but never runs Stockfish. The browser loads Stockfish 18 lite single-threaded WASM in a Worker, proposes bot moves, and submits them through a dedicated bot move endpoint that validates and applies moves as `seat2`.

**Tech Stack:** TypeScript, Express, React, Vite, Vitest, Socket.IO, `stockfish` npm package, browser Web Workers.

---

## File Structure

- Modify `fairgame-rebuild/apps/server/src/config.ts`: add `browserChessBot.enabled` config from `FAIRGAME_BROWSER_CHESS_BOT`.
- Create `fairgame-rebuild/apps/server/src/matches/browserChessBot.ts`: shared server types, difficulty parsing, display names, cookie helpers.
- Modify `fairgame-rebuild/apps/server/src/matches/matchRepository.ts`: persist bot metadata and bot-control secrets in snapshots/events.
- Modify `fairgame-rebuild/apps/server/src/matches/matchService.ts`: create bot matches, serialize bot metadata, authorize/apply bot moves, and keep normal open-match behavior.
- Modify `fairgame-rebuild/apps/server/src/matches/matchView.ts`: expose `bot` metadata in `MatchView`.
- Modify `fairgame-rebuild/apps/server/src/matches/routes.ts`: parse bot create options, set bot-control cookies, and add `POST /:id/bot-moves`.
- Create `fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts`: focused server service/route tests.
- Modify `fairgame-rebuild/apps/web/package.json`: add `stockfish`, copy script, and run it before dev/build.
- Modify `fairgame-rebuild/package-lock.json`: npm lock update from installing `stockfish`.
- Create `fairgame-rebuild/apps/web/scripts/copy-stockfish.mjs`: copy Stockfish lite single-threaded assets to public vendor assets.
- Create generated assets under `fairgame-rebuild/apps/web/public/vendor/stockfish/`: copied `.js` and `.wasm` from `node_modules/stockfish/bin/`.
- Modify `fairgame-rebuild/apps/web/src/types.ts`: add bot difficulty and bot metadata types.
- Modify `fairgame-rebuild/apps/web/src/api.ts`: add create-match bot options and `makeBotMove`.
- Create `fairgame-rebuild/apps/web/src/browserChessBot.ts`: presets, UCI conversion, Stockfish worker wrapper, and controller helpers.
- Create `fairgame-rebuild/apps/web/src/browserChessBot.test.ts`: unit tests for move conversion, controller guards, and worker failure behavior.
- Modify `fairgame-rebuild/apps/web/src/App.tsx`: add mode/difficulty UI, start bot controller for bot matches, show bot status, and submit bot moves.
- Modify `fairgame-rebuild/apps/web/src/App.test.tsx`: cover mode toggle, create payload, bot controller start/guard behavior, status states, and retry.
- Modify `fairgame-rebuild/apps/web/src/styles.css`: compact lobby controls and bot status styles.
- Modify `fairgame-rebuild/.env.example`: add browser bot flags and remove old debug bot flags after the browser bot is stable.
- Modify `fairgame-rebuild/README.md`: document production/browser Stockfish bot and remove old heuristic debug bot docs after replacement.
- Modify `docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md`: record implementation evidence after completion.

---

### Task 1: Server Bot Match Model And Authorization

**Files:**
- Create: `fairgame-rebuild/apps/server/src/matches/browserChessBot.ts`
- Modify: `fairgame-rebuild/apps/server/src/config.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchRepository.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchView.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/routes.ts`
- Test: `fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts`

- [x] **Step 1: Write failing server tests for bot creation and authorization**

Create `fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts` with tests that construct `MatchService` and `createMatchRouter` directly:

```ts
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { MatchService } from "./matchService.js";
import { createMatchRouter } from "./routes.js";

function createTestApp(matchService = new MatchService()) {
  const app = express();
  app.use(express.json());
  app.use("/api/matches", createMatchRouter(matchService, { browserChessBotEnabled: true }));
  return app;
}

describe("browser Chess bot", () => {
  it("creates a Chess bot match with seat2 joined and bot metadata", async () => {
    const response = await request(createTestApp())
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      .expect(201);

    expect(response.body.seat).toBe("seat1");
    expect(response.body.match.joinedSeats).toBe(2);
    expect(response.body.match.bot).toEqual({
      seat: "seat2",
      kind: "browser-stockfish",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    });
    expect(response.body.match.players.seat2.name).toBe("Stockfish Normal");
    expect(response.headers["set-cookie"].join("\n")).toContain(`fg_bot_${response.body.match.id}=`);
  });

  it("rejects bot match creation for non-Chess games", async () => {
    await request(createTestApp())
      .post("/api/matches")
      .send({ gameType: "tictactoe", bot: { difficulty: "easy" } })
      .expect(400)
      .expect(({ body }) => expect(body.error).toBe("unsupported-bot-game"));
  });

  it("rejects bot moves without the bot-control cookie", async () => {
    const app = createTestApp();
    const created = await request(app)
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      .expect(201);

    await request(app)
      .post(`/api/matches/${created.body.match.id}/bot-moves`)
      .send({ boardId: "B", move: { from: "e2", to: "e4" } })
      .expect(403)
      .expect(({ body }) => expect(body.error).toBe("unauthorized-bot"));
  });

  it("applies authorized bot moves as seat2 and advances the opponent clock", async () => {
    const app = createTestApp();
    const created = await request(app)
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "normal" } })
      .expect(201);
    const cookie = created.headers["set-cookie"];

    const moved = await request(app)
      .post(`/api/matches/${created.body.match.id}/bot-moves`)
      .set("Cookie", cookie)
      .send({ boardId: "B", move: { from: "e2", to: "e4" } })
      .expect(200);

    const boardB = moved.body.match.boards.find((board: { id: string }) => board.id === "B");
    expect(boardB.moveHistory.at(-1)).toMatchObject({ seat: "seat2", from: "e2", to: "e4" });
    expect(moved.body.match.clock.runningSeats).toContain("seat1");
  });

  it("declines human draw offers through the bot endpoint", async () => {
    const app = createTestApp();
    const created = await request(app)
      .post("/api/matches")
      .send({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "easy" } })
      .expect(201);
    const cookie = created.headers["set-cookie"];

    await request(app)
      .post(`/api/matches/${created.body.match.id}/moves`)
      .send({ boardId: "A", seat: "seat1", move: { drawOffer: true } })
      .expect(200);

    const declined = await request(app)
      .post(`/api/matches/${created.body.match.id}/bot-moves`)
      .set("Cookie", cookie)
      .send({ boardId: "A", move: { declineDraw: true } })
      .expect(200);

    const boardA = declined.body.match.boards.find((board: { id: string }) => board.id === "A");
    expect(boardA.drawOffer).toBeNull();
    expect(boardA.moveHistory.at(-1)).toMatchObject({ seat: "seat2", drawDeclined: true });
  });
});
```

- [x] **Step 2: Run server bot tests and confirm they fail**

Run:

```bash
npm test -w @fairgame/server -- browserChessBot
```

Expected: FAIL because `browserChessBotEnabled`, bot metadata, bot cookies, and `/bot-moves` do not exist yet.

- [x] **Step 3: Implement server bot config, metadata, cookies, and endpoint**

Implementation details:

- Add `browserChessBot: { enabled: boolean }` to `ServerConfig` from `FAIRGAME_BROWSER_CHESS_BOT`, defaulting to `nodeEnv !== "production"`.
- Add `BrowserChessBotDifficulty`, `BrowserChessBot`, `parseBrowserChessBotDifficulty`, `getBrowserChessBotDisplayName`, `getBotControlCookieName`, and `parseBotControlCookie` helpers in `browserChessBot.ts`.
- Extend `StoredMatch` with:

```ts
browserBot: BrowserChessBot | null;
botControlSecret: string | null;
```

- Extend `SerializedStoredMatch` with optional `browserBot` and `botControlSecret`.
- Extend `CreateMatchOptions` with `browserBotDifficulty?: BrowserChessBotDifficulty`.
- When bot difficulty is present, create the match with `joinedSeats` containing both seats, `playerNames.seat2` set to the bot display name, `browserBot` metadata set, and a generated `botControlSecret`.
- Add a `createBrowserBotMove` or `applyBrowserBotMove` service method that always applies as `seat2` after checking the bot metadata and bot-control secret.
- Keep existing normal `applyMove` behavior unchanged.
- Extend `toMatchView` and `MatchView` to include `bot?: BrowserChessBot`.
- Add `POST /:id/bot-moves` in `routes.ts`. It must read the bot-control cookie, never accept a request `seat`, call the service bot-move method, and return the same `{ match }` shape.
- Set the bot-control cookie in `POST /api/matches` only for bot matches.

- [x] **Step 4: Run server tests and typecheck**

Run:

```bash
npm test -w @fairgame/server -- browserChessBot
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit server bot model**

```bash
git add fairgame-rebuild/apps/server/src/config.ts \
  fairgame-rebuild/apps/server/src/matches/browserChessBot.ts \
  fairgame-rebuild/apps/server/src/matches/browserChessBot.test.ts \
  fairgame-rebuild/apps/server/src/matches/matchRepository.ts \
  fairgame-rebuild/apps/server/src/matches/matchService.ts \
  fairgame-rebuild/apps/server/src/matches/matchView.ts \
  fairgame-rebuild/apps/server/src/matches/routes.ts
git commit -m "feat: add browser chess bot server flow"
```

**Task 1 Evidence:** Commit `da702a3`; `npm test -w @fairgame/server -- browserChessBot` passed; `npm run typecheck` passed.

---

### Task 2: Web API, Types, And Stockfish Asset Pipeline

**Files:**
- Modify: `fairgame-rebuild/apps/web/package.json`
- Modify: `fairgame-rebuild/package-lock.json`
- Create: `fairgame-rebuild/apps/web/scripts/copy-stockfish.mjs`
- Create: `fairgame-rebuild/apps/web/public/vendor/stockfish/stockfish-18-lite-single.js`
- Create: `fairgame-rebuild/apps/web/public/vendor/stockfish/stockfish-18-lite-single.wasm`
- Modify: `fairgame-rebuild/apps/web/src/types.ts`
- Modify: `fairgame-rebuild/apps/web/src/api.ts`
- Test: `fairgame-rebuild/apps/web/src/api.test.ts`

- [x] **Step 1: Write failing web API/type tests**

Extend `fairgame-rebuild/apps/web/src/api.test.ts`:

```ts
import { createMatch, makeBotMove } from "./api";

it("sends bot difficulty when creating a bot match", async () => {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ seat: "seat1", match: { id: "match-bot" } }), {
      status: 201,
      headers: { "content-type": "application/json" }
    })
  );
  vi.stubGlobal("fetch", fetchMock);

  await createMatch("chess", { clockInitialMs: 300_000, bot: { difficulty: "hard" } });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: JSON.stringify({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "hard" } })
    })
  );
});

it("submits bot moves without a user-supplied seat", async () => {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ match: { id: "match-bot" } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
  vi.stubGlobal("fetch", fetchMock);

  await makeBotMove({ matchId: "match-bot", boardId: "B", move: { from: "e7", to: "e5" } });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/matches/match-bot/bot-moves"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ boardId: "B", move: { from: "e7", to: "e5" } })
    })
  );
});
```

- [x] **Step 2: Run web API tests and confirm they fail**

Run:

```bash
npm test -w @fairgame/web -- api
```

Expected: FAIL because `makeBotMove` and create bot options do not exist.

- [x] **Step 3: Install Stockfish and add asset copy script**

Run:

```bash
npm install stockfish@18.0.7 -w @fairgame/web
```

Create `fairgame-rebuild/apps/web/scripts/copy-stockfish.mjs`:

```js
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDir, "..");
const stockfishRoot = join(webRoot, "..", "..", "node_modules", "stockfish", "bin");
const outputRoot = join(webRoot, "public", "vendor", "stockfish");
const files = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

await mkdir(outputRoot, { recursive: true });
await Promise.all(files.map((file) => copyFile(join(stockfishRoot, file), join(outputRoot, file))));
console.log(`Copied ${files.length} Stockfish assets to ${outputRoot}`);
```

Update `@fairgame/web` scripts:

```json
"predev": "node scripts/copy-stockfish.mjs",
"prebuild": "node scripts/copy-stockfish.mjs",
"dev": "vite",
"build": "tsc -p tsconfig.json --noEmit && vite build"
```

Run:

```bash
npm run prebuild -w @fairgame/web
```

Expected: `apps/web/public/vendor/stockfish/stockfish-18-lite-single.js` and `.wasm` exist.

- [x] **Step 4: Implement web bot types and API functions**

Add to `types.ts`:

```ts
export type BrowserChessBotDifficulty = "easy" | "normal" | "hard";

export type BrowserChessBot = {
  seat: "seat2";
  kind: "browser-stockfish";
  difficulty: BrowserChessBotDifficulty;
  displayName: string;
};
```

Extend `MatchView`:

```ts
bot?: BrowserChessBot;
```

Extend `CreateMatchOptions` in `api.ts`:

```ts
export type CreateMatchOptions = {
  readonly clockInitialMs?: number;
  readonly bot?: { readonly difficulty: BrowserChessBotDifficulty };
};
```

Add:

```ts
export async function makeBotMove(input: {
  matchId: string;
  boardId: BoardId;
  move: MovePayload;
}): Promise<MatchView> {
  const response = await request<{ match: MatchView }>(
    `/api/matches/${encodeURIComponent(input.matchId)}/bot-moves`,
    {
      method: "POST",
      body: JSON.stringify({ boardId: input.boardId, move: input.move })
    }
  );
  return response.match;
}
```

- [x] **Step 5: Run web API tests and typecheck**

Run:

```bash
npm test -w @fairgame/web -- api
npm run typecheck
```

Expected: PASS.

- [x] **Step 6: Commit web API and assets**

```bash
git add fairgame-rebuild/apps/web/package.json fairgame-rebuild/package-lock.json \
  fairgame-rebuild/apps/web/scripts/copy-stockfish.mjs \
  fairgame-rebuild/apps/web/public/vendor/stockfish/ \
  fairgame-rebuild/apps/web/src/api.ts fairgame-rebuild/apps/web/src/api.test.ts \
  fairgame-rebuild/apps/web/src/types.ts
git commit -m "feat: add browser chess bot web API"
```

**Task 2 Evidence:** Commit `f0424dd`; `npm run prebuild -w @fairgame/web` copied 2 assets; `npm test -w @fairgame/web -- api` passed; `npm run typecheck` passed.

---

### Task 3: Browser Stockfish Engine And Bot Controller

**Files:**
- Create: `fairgame-rebuild/apps/web/src/browserChessBot.ts`
- Create: `fairgame-rebuild/apps/web/src/browserChessBot.test.ts`

- [x] **Step 1: Write failing browser bot utility tests**

Create `browserChessBot.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import {
  browserChessBotPresets,
  createBrowserChessBotController,
  toChessMovePayloadFromUci,
  selectBrowserChessBotAction
} from "./browserChessBot";
import type { ChessBoardView, MatchView } from "./types";

describe("browserChessBot", () => {
  it("maps UCI moves to legal move payloads including promotions", () => {
    const legalMoves = [
      { color: "w", piece: "p", from: "e7", to: "e8", promotion: "q", san: "e8=Q", lan: "e7e8q" },
      { color: "w", piece: "p", from: "e7", to: "e8", promotion: "n", san: "e8=N", lan: "e7e8n" }
    ] as const;

    expect(toChessMovePayloadFromUci("e7e8q", legalMoves)).toEqual({ from: "e7", to: "e8", promotion: "q" });
    expect(toChessMovePayloadFromUci("e7e8r", legalMoves)).toBeNull();
  });

  it("selects draw and takeback declines before engine search", () => {
    const match = createBotMatch({
      drawOffer: { offeredBy: "seat1" },
      takebackRequest: null,
      seatsToAct: ["seat2"]
    });

    expect(selectBrowserChessBotAction(match)).toEqual({
      kind: "control",
      boardId: "A",
      move: { declineDraw: true }
    });
  });

  it("selects the first board where the bot needs a chess move", () => {
    const match = createBotMatch({
      drawOffer: null,
      takebackRequest: null,
      seatsToAct: ["seat2"]
    });

    expect(selectBrowserChessBotAction(match)).toMatchObject({ kind: "engine", boardId: "A" });
  });

  it("does not select actions for non-bot matches", () => {
    const match = createBotMatch({ drawOffer: null, takebackRequest: null, seatsToAct: ["seat2"] });
    delete match.bot;

    expect(selectBrowserChessBotAction(match)).toBeNull();
  });

  it("configures Stockfish with preset skill and movetime", async () => {
    const messages: string[] = [];
    const controller = createBrowserChessBotController({
      createEngine: () => ({
        post: (message) => messages.push(message),
        nextBestMove: async () => "e7e5",
        dispose: vi.fn()
      }),
      submitMove: vi.fn(async () => undefined)
    });

    await controller.runForMatch(createBotMatch({ drawOffer: null, takebackRequest: null, seatsToAct: ["seat2"] }));

    expect(messages).toContain(`setoption name Skill Level value ${browserChessBotPresets.normal.skillLevel}`);
    expect(messages).toContain("position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(messages).toContain(`go movetime ${browserChessBotPresets.normal.moveTimeMs}`);
  });
});
```

Use a local `createBotMatch` fixture with one Chess board containing `fen`, `legalMoves`, `drawOffer`, `takebackRequest`, and `seatsToAct`.

- [x] **Step 2: Run browser bot utility tests and confirm they fail**

Run:

```bash
npm test -w @fairgame/web -- browserChessBot
```

Expected: FAIL because `browserChessBot.ts` does not exist.

- [x] **Step 3: Implement presets, UCI conversion, selection, and controller**

Create `browserChessBot.ts` with:

- `browserChessBotPresets` for easy/normal/hard skill and movetime.
- `toChessMovePayloadFromUci(uci, legalMoves)`.
- `selectBrowserChessBotAction(match)` that returns:

```ts
type BrowserChessBotAction =
  | { kind: "control"; boardId: BoardId; move: MovePayload }
  | { kind: "engine"; boardId: BoardId; board: ChessBoardView };
```

- A worker engine interface:

```ts
type BrowserChessBotEngine = {
  post(message: string): void;
  nextBestMove(): Promise<string>;
  dispose(): void;
};
```

- `createStockfishEngine()` that starts a Worker from `/vendor/stockfish/stockfish-18-lite-single.js`.
- `createBrowserChessBotController({ createEngine, submitMove, onStatus })` that serializes bot work, validates best moves against `board.legalMoves`, reports status, and exposes `runForMatch(match)` and `dispose()`.

- [x] **Step 4: Run browser bot utility tests and typecheck**

Run:

```bash
npm test -w @fairgame/web -- browserChessBot
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit browser bot utilities**

```bash
git add fairgame-rebuild/apps/web/src/browserChessBot.ts fairgame-rebuild/apps/web/src/browserChessBot.test.ts
git commit -m "feat: add browser stockfish controller"
```

**Task 3 Evidence:** Commit `e478d90`; `npm test -w @fairgame/web -- browserChessBot` passed; `npm run typecheck` passed.

---

### Task 4: App UI And Bot Controller Integration

**Files:**
- Modify: `fairgame-rebuild/apps/web/src/App.tsx`
- Modify: `fairgame-rebuild/apps/web/src/App.test.tsx`
- Modify: `fairgame-rebuild/apps/web/src/styles.css`

- [x] **Step 1: Write failing app integration tests**

Add tests to `App.test.tsx`:

- Chess lobby shows `Human` and `Bot` mode controls only for Chess.
- Bot mode shows `Easy`, `Normal`, `Hard`.
- Creating a Normal bot game sends `{ bot: { difficulty: "normal" } }`.
- Human games do not include `bot`.
- Bot status renders `Bot thinking` when the controller reports thinking.
- Bot controller does not start for normal human matches.

Mock `./browserChessBot` at the top of the file:

```ts
const browserChessBotMock = vi.hoisted(() => ({
  createBrowserChessBotController: vi.fn(() => ({
    runForMatch: vi.fn(async () => undefined),
    dispose: vi.fn()
  }))
}));

vi.mock("./browserChessBot", async () => {
  const actual = await vi.importActual<typeof import("./browserChessBot")>("./browserChessBot");
  return {
    ...actual,
    createBrowserChessBotController: browserChessBotMock.createBrowserChessBotController
  };
});
```

- [x] **Step 2: Run app tests and confirm they fail**

Run:

```bash
npm test -w @fairgame/web -- App
```

Expected: FAIL because the UI and integration are not implemented.

- [x] **Step 3: Implement lobby mode and difficulty UI**

In `App.tsx`:

- Add state:

```ts
const [chessCreateMode, setChessCreateMode] = useState<"human" | "bot">("human");
const [browserBotDifficulty, setBrowserBotDifficulty] = useState<BrowserChessBotDifficulty>("normal");
```

- Update `handleCreate` to include `bot` only when `lobbyGame === "chess"` and mode is `bot`.
- Add a compact `Human` / `Bot` segmented control in the Chess lobby create panel.
- Add `Easy` / `Normal` / `Hard` buttons when Bot is selected.
- Keep quick-pairing buttons using the current selected mode/difficulty.

- [x] **Step 4: Integrate bot controller in the match screen**

In `App.tsx`:

- Import `createBrowserChessBotController`.
- Add bot status state:

```ts
type BrowserBotStatus = "idle" | "loading" | "thinking" | "error";
```

- Start a controller in a `useEffect` when the active session match has `bot.kind === "browser-stockfish"`.
- Pass `makeBotMove` as `submitMove`.
- On every relevant match update, call `controller.runForMatch(activeSession.match)`.
- Dispose the controller when leaving the match.
- Render lightweight status text in `MatchRoom`, such as `Bot loading`, `Bot thinking`, or `Bot move failed`.
- Add a retry button when status is `error`.

- [x] **Step 5: Add compact styles**

In `styles.css`, add focused styles for:

- `.mode-toggle`
- `.difficulty-grid`
- `.bot-status`
- `.bot-status.error`

Keep controls dense and consistent with existing buttons. Do not add a marketing-style panel or nested cards.

- [x] **Step 6: Run app tests and typecheck**

Run:

```bash
npm test -w @fairgame/web -- App
npm run typecheck
```

Expected: PASS.

- [x] **Step 7: Commit app integration**

```bash
git add fairgame-rebuild/apps/web/src/App.tsx fairgame-rebuild/apps/web/src/App.test.tsx fairgame-rebuild/apps/web/src/styles.css
git commit -m "feat: add chess bot UI"
```

**Task 4 Evidence:** Commit `f655843`; `npm test -w @fairgame/web -- App` passed; `npm run typecheck` passed.

---

### Task 5: Retire The Server Heuristic Debug Bot And Update Docs

**Files:**
- Delete: `fairgame-rebuild/apps/server/src/matches/debugChessBot.ts`
- Modify: `fairgame-rebuild/apps/server/src/config.ts`
- Modify: `fairgame-rebuild/apps/server/src/matches/matchService.ts`
- Modify: `fairgame-rebuild/apps/server/src/index.ts`
- Modify: `fairgame-rebuild/.env.example`
- Modify: `fairgame-rebuild/README.md`
- Modify: `docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md`

- [x] **Step 1: Write or update tests proving heuristic debug bot is gone**

Update server config tests or add coverage in `browserChessBot.test.ts`:

```ts
it("does not auto-seat a server debug bot for normal Chess match creation", async () => {
  const response = await request(createTestApp())
    .post("/api/matches")
    .send({ gameType: "chess", clockInitialMs: 300_000 })
    .expect(201);

  expect(response.body.match.joinedSeats).toBe(1);
  expect(response.body.match.bot).toBeUndefined();
  expect(response.body.match.players.seat2.name).toBe("Player 2");
});
```

- [x] **Step 2: Remove debug bot config and service hooks**

Remove:

- `DebugChessBotConfig`
- `debugChessBot` from `ServerConfig`
- `FAIRGAME_DEBUG_CHESS_BOT*` docs/env vars
- `maybeStartDebugChessBot`, scheduling, and heuristic move code from `MatchService`
- import and construction of old debug bot configuration

Keep `FAIRGAME_BROWSER_CHESS_BOT` as the only Chess bot server flag.

- [x] **Step 3: Update docs and implementation evidence**

Update `.env.example`:

```env
FAIRGAME_BROWSER_CHESS_BOT=true
VITE_BROWSER_CHESS_BOT=true
```

Update `README.md` to document:

```bash
FAIRGAME_BROWSER_CHESS_BOT=true VITE_BROWSER_CHESS_BOT=true npm run dev
```

Add an "Implementation evidence" section to the design doc listing:

- commits made
- files changed
- verification commands and results
- browser verification result

- [x] **Step 4: Run checks**

Run:

```bash
rg "DEBUG_CHESS_BOT|debugChessBot|Debug Bot|debug chess bot" fairgame-rebuild docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md
npm run typecheck
npm test
```

Expected: `rg` finds no old debug bot references in product code or the active design spec; typecheck and tests pass.

- [x] **Step 5: Commit cleanup and docs**

```bash
git add -A fairgame-rebuild docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md
git commit -m "chore: retire heuristic chess debug bot"
```

**Task 5 Evidence:** Commit `0f771dd`; legacy debug-bot scan returned no matches in product code or active spec; `npm run typecheck` passed; `npm test` passed.

---

### Task 6: End-To-End Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md`
- Optional Modify: `roadmap.md` if the work completes or changes roadmap status.

- [x] **Step 1: Run full automated verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all pass.

**Task 6 Step 1 Evidence:** `npm test -w @fairgame/web -- App` passed with 39 tests; `npm run typecheck` passed; final `npm test` passed with 214 tests across shared/domain/server/web workspaces; `npm run build` passed and copied 2 Stockfish assets. One earlier full-suite `npm test` run hit a transient 404 in `tests/matches.test.ts`; `npm test -w @fairgame/server -- tests/matches.test.ts`, `npm test -w @fairgame/server`, and the final full `npm test` rerun all passed.

- [x] **Step 2: Start local servers with browser bot enabled**

Run from `fairgame-rebuild`:

```bash
FAIRGAME_BROWSER_CHESS_BOT=true VITE_BROWSER_CHESS_BOT=true PORT=4110 DATABASE_URL=postgresql://fairgame:password@localhost:5432/fairgame npm run dev
```

If local Postgres is unavailable, use the existing project local database setup or a test-safe `DATABASE_URL` that the server accepts.

**Task 6 Step 2 Evidence:** Started a test-safe in-memory API on `http://localhost:4110` with `FAIRGAME_BROWSER_CHESS_BOT=true` and Vite on `http://localhost:5176` with `VITE_BROWSER_CHESS_BOT=true`. The API used the real Express router, Socket.IO registration, and `MatchService` with no production database writes.

- [x] **Step 3: Browser verification**

Open `http://localhost:5173/games/chess` or the Vite port reported by the server logs.

Verify:

- Bot mode is available in the Chess lobby.
- Normal difficulty can create a bot match.
- The bot appears as `Stockfish Normal`.
- Human makes a legal move.
- Bot clock visibly counts down while Stockfish thinks.
- Bot move appears after Stockfish returns `bestmove`.
- Draw offer is automatically declined by the bot.
- Takeback request is automatically declined by the bot.
- Refresh during bot turn resumes bot thinking.

**Task 6 Step 3 Evidence:** In-app browser verification at `http://localhost:5176/games/chess` passed. Bot mode appeared in the Chess lobby, Normal difficulty created bot matches, `Stockfish Normal` rendered in the match header, a human `e2-e4` move started `seat2` thinking, the opponent clock dropped from `296789ms` to `295583ms` during a 1200ms observation window, reload happened while `seat2` was still to act, the restored controller submitted `e7-e5`, draw and takeback requests were automatically declined, and a fresh final smoke match confirmed `Stockfish Normal` plus a Stockfish Board B opening move.

- [x] **Step 4: Record final evidence in the design doc**

Append evidence to `docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md`:

```md
## Implementation Evidence

- Plan: `docs/superpowers/plans/2026-06-05-browser-stockfish-bot.md`
- Commits:
  - `<hash>` ...
- Verification:
  - `npm run typecheck` - PASS
  - `npm test` - PASS
  - `npm run build` - PASS
- Browser verification at `http://localhost:<port>/games/chess` - PASS
```

**Task 6 Step 4 Evidence:** Final implementation evidence was appended to `docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md`.

- [x] **Step 5: Commit final evidence**

```bash
git add docs/superpowers/specs/2026-06-05-browser-stockfish-bot-design.md
git commit -m "docs: record browser chess bot evidence"
```

**Task 6 Step 5 Evidence:** Commit `371459d` recorded the implementation evidence in the design doc, updated this execution plan through final verification, and added the roadmap follow-up that supersedes the retired local heuristic bot. Follow-up commit `6978cb5` closed the final UI-state audit gap by adding the pending `Creating bot game` state; verification was rerun afterward.

---

## Self-Review

- [x] Spec coverage: every design-doc section maps to at least one task above.
- [x] Placeholder scan: no placeholder markers, incomplete sections, or vague error-handling steps remain.
- [x] Type consistency: `BrowserChessBotDifficulty`, `BrowserChessBot`, and `/bot-moves` names are consistent across tasks.
- [x] Verification coverage: server tests, web tests, full build, and browser verification are all required before completion.
