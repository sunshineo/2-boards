# Lichess-Like Chess Experience Plan

Status: Done
Started: 2026-06-03
Worktree: `.worktrees/lichess-like-chess`
Branch: `codex/lichess-like-chess`

Goal: Make Chess feel closer to a serious lichess-style chess client while preserving the two independent board model.

## Tasks

- [x] Project server-authoritative chess UX data.
  Evidence: Added legal moves, turn color, check state, and move number projection through `packages/domain/src/games/chess.ts`, `apps/server/src/matches/gameRegistry.ts`, and `apps/web/src/types.ts`.
- [x] Improve the Chess board interaction model.
  Evidence: Updated `apps/web/src/App.tsx` with server-projected legal target highlights, last-move highlighting, source selection, drag/drop legality checks, and promotion choice handling.
- [x] Add lichess-style Chess side information for each board.
  Evidence: Updated `apps/web/src/App.tsx` and `apps/web/src/styles.css` with per-board player rows, active turn labels, captured material display, and move history.
- [x] Add focused tests and run verification.
  Evidence: `npm run typecheck`, `npm test -w @fairgame/domain -- chess`, `npm test -w @fairgame/server -- matches`, and `npm test -w @fairgame/web -- App` passed on 2026-06-03.
- [x] Update roadmap and final evidence.
  Evidence: Final verification passed on 2026-06-03 with `npm run typecheck`, `npm test`, and `npm run build`. Playwright e2e passed in focused slices against a disposable built API backed by `pg-mem` and Vite: `browser history|player can make an opening Chess move`, `two players can finish both TicTacToe boards`, `two players can finish both Connect Four boards|Connect Four columns contain all six slots`, and `players can make opening moves in the added board games`. Manual Playwright smoke created a Chess match, joined Player 2, verified Board A `White (You)`, Board B `Black (You)`, selected `e2`, verified `e4` as a legal destination, played `e4`, and confirmed Board A move history showed `e4`; screenshot saved at `/tmp/fairgame-chess-smoke.png`.

## Follow-Up: Board-Local Chess Clocks

Status: Done
Started: 2026-06-03

- [x] Add a failing web test for lichess-style board-local clocks in Chess player rows.
  Evidence: `npm test -w @fairgame/web -- App.test.tsx` failed on 2026-06-03 with `Unable to find a label with the text of: Board A White clock`.
- [x] Render each Chess board's player rows with the correct seat clock and running state.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-03 after adding board-local clock projection and row rendering.
- [x] Remove the generic top clock strip for Chess now that clocks are board-local.
  Evidence: Red App test failed first because the generic `Clocks` region still rendered for Chess. After implementation, Playwright smoke found `globalClockCount: 0` for a live two-player Chess match.
- [x] Polish the Chess player-row layout so color labels and clocks fit in the two-board view.
  Evidence: Playwright smoke verified Board A/B player text included full `White (You)` / `Black (You)` labels with board-local clocks ticking from `5:00` to `4:59`; screenshot saved at `/tmp/fairgame-chess-board-clocks-wide.png`.
- [x] Verify focused web tests, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-03.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local Chess clock details, red/green test evidence, full verification, and Playwright screenshot paths.

## Follow-Up: Board-Local Material Balance

Status: Done
Started: 2026-06-03

- [x] Add a failing web test for per-board Chess material advantage beside captured pieces.
  Evidence: `npm test -w @fairgame/web -- App.test.tsx` failed on 2026-06-03 with `Unable to find a label with the text of: Board A White material advantage`.
- [x] Render captured material with a lichess-style material score for each Chess board.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-03 after adding board-local captured-material scoring.
- [x] Verify focused web tests, typecheck, full tests, build, and browser smoke where useful.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-03. Playwright smoke created and joined a Chess match, played `e4 d5 exd5` on Board A, verified Board A White material advantage `+1`, and saved `/tmp/fairgame-chess-material-advantage.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with material-balance details, red/green test evidence, full verification, and browser smoke screenshot path.

## Follow-Up: Checked King Highlight

Status: Done
Started: 2026-06-03

- [x] Add failing domain/server/web tests for checked king square projection and highlighting.
  Evidence: Focused red tests failed on 2026-06-03: domain `getChessCheckSquare is not a function`, server `board.checkSquare` was `undefined`, and web could not find `Board A square e8 black king in check`.
- [x] Project the checked king square through the Chess domain, server board view, and web types.
  Evidence: Passed focused domain and server tests on 2026-06-03 after adding `getChessCheckSquare` and `checkSquare` to Chess board views.
- [x] Render the checked king square with a lichess-style warning highlight.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-03 with `Board A square e8 black king in check` receiving the `checked-king` class.
- [x] Verify focused tests, typecheck, full tests, build, and browser smoke.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts`, `npm test -w @fairgame/server -- matches.test.ts`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-03. Playwright smoke created and joined a Chess match, played `e4 f5 Qh5+`, verified `Board A square e8 black king in check` had `checked-king`, confirmed the red inset ring computed style, and saved `/tmp/fairgame-chess-checked-king-ring.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with checked-king projection, red/green test evidence, full verification, and browser smoke screenshot path.

## Follow-Up: Current Move Highlight

Status: Done
Started: 2026-06-03

- [x] Add a failing web test for highlighting the current SAN move in each Chess move list.
  Evidence: `npm test -w @fairgame/web -- App.test.tsx` failed on 2026-06-03 with `Unable to find a label with the text of: Board A current move e5`.
- [x] Render the latest Chess move with current-move styling and accessible labeling.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-03 with `Board A current move e5` receiving `current-move`.
- [x] Verify focused web tests, typecheck, full tests, build, and browser smoke.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-03. Playwright smoke created and joined a Chess match, played `e4 e5`, verified `Board A current move e5` had `current-move` with contrast styling, and saved `/tmp/fairgame-chess-current-move.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with current-move highlighting details, red/green test evidence, full verification, and browser smoke screenshot path.

## Follow-Up: Per-Board Flip Controls

Status: Done
Started: 2026-06-03

- [x] Add a failing web test for a per-board Chess flip control.
  Evidence: `npm test -w @fairgame/web -- App.test.tsx` failed on 2026-06-03 with `data-orientation="white"` missing from Board A.
- [x] Implement per-board orientation override without affecting the other board.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-03 after adding per-board flip state, flip controls, and board orientation metadata.
- [x] Verify focused web tests, typecheck, full tests, build, and browser smoke.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-03. Browser smoke created a Chess match, verified initial orientations Board A `white` and Board B `black`, flipped Board A without changing Board B, flipped Board B without changing Board A, and saved `/tmp/fairgame-chess-flip-board.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with per-board flip-control details, red/green test evidence, full verification, and browser smoke screenshot path.

## Follow-Up: Board-Local Move Replay

Status: Done
Started: 2026-06-04

- [x] Add failing domain and web tests for replayable Chess move positions.
  Evidence: Focused RED tests failed on 2026-06-04: domain `state.moveHistory[0]?.fenAfter` was `undefined`, and web Board A lacked `data-review-ply="live"`.
- [x] Store/replay per-move FEN positions and expose board-local replay controls.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts` and `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after recording `fenAfter` and adding board-local move-list replay controls.
- [x] Verify focused tests, typecheck, full tests, build, and browser smoke.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. Browser smoke created and joined a Chess match, played `e4 e5`, reviewed Board A ply 1, verified Board A became noninteractive with its prior FEN while Board B stayed live, returned Board A to live, and saved `/tmp/fairgame-chess-move-replay.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local move replay details, red/green test evidence, full verification, and browser smoke screenshot path.

## Follow-Up: Per-Board Chess Resign

Status: Done
Started: 2026-06-04

- [x] Add failing domain, server, and web tests for per-board Chess resignation.
  Evidence: Focused RED tests failed on 2026-06-04: domain threw `seat-not-to-act` for non-turn resignation, server returned `400 Bad Request` for `{ resign: true }`, and web could not find `Resign Board A`.
- [x] Implement a Chess resign move that ends only the selected board and scores it for the opponent.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts` and, after `npm run build:packages`, `npm test -w @fairgame/server -- matches.test.ts` on 2026-06-04.
- [x] Add a board-local resign control that is disabled while reviewing or after the board is over.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding board-local Chess resign controls.
- [x] Verify focused tests, typecheck, full tests, build, and browser smoke.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts`, `npm test -w @fairgame/server -- matches.test.ts`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. Browser smoke created and joined a Chess match, resigned Board A as Player 1, verified Board A showed `Opponent won` with its resign control disabled, verified Board B stayed live with its resign control enabled, and saved `/tmp/fairgame-chess-resign.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with per-board Chess resignation details, red/green test evidence, full verification, and browser smoke screenshot path.

## Follow-Up: Per-Board Chess Draw Offers

Status: Done
Started: 2026-06-04

- [x] Add failing domain, server, and web tests for board-local Chess draw offers.
  Evidence: Focused RED tests failed on 2026-06-04: domain threw `seat-not-to-act` for `{ drawOffer: true }`, server returned `400 Bad Request`, and web could not find `Offer Draw Board A` / draw-response controls.
- [x] Implement Chess draw-offer, accept-draw, and decline-draw commands that affect only the selected board.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts` and, after `npm run build:packages`, `npm test -w @fairgame/server -- matches.test.ts` on 2026-06-04.
- [x] Add board-local draw-offer controls that are unavailable while reviewing or after the board is over.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding board-local offer, accept, and decline controls.
- [x] Verify focused tests, typecheck, full tests, build, and browser smoke.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts`, `npm test -w @fairgame/server -- matches.test.ts`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. The in-app browser tab crashed before loading the local app, so project Playwright Chromium smoke created and joined a Chess match, offered a draw on Board A, verified the own-offer `Draw offered` disabled state, accepted the draw as Player 2 through the local API, verified Board A showed `Draw`, verified Board B stayed live with `Offer Draw Board B` enabled, and saved `/tmp/fairgame-chess-draw-offer.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with per-board Chess draw-offer details, red/green test evidence, full verification, and Playwright smoke screenshot path.

## Follow-Up: Board-Control Records In Move History

Status: Done
Started: 2026-06-04

- [x] Add a failing web test for out-of-turn Chess board-control records appearing in the move history.
  Evidence: Focused RED test failed on 2026-06-04 with Board A move history rendering only `Moves1 ply1.` instead of the black `offers draw` record.
- [x] Render Chess move-history pairs by each record's color instead of fixed array position.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after updating `getChessMovePairs` to place records by `ChessMoveRecord.color`; the black `offers draw` control record now appears in the black column when it is the first history entry.
- [x] Verify focused web tests, typecheck, full tests, build, and UI smoke.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. Project Playwright Chromium smoke created and joined a Chess match, submitted a black `drawOffer` on Board A before any white move, verified Board A move history showed `offers draw` with `current-move`, verified Board B remained in progress with `Offer Draw Board B` enabled and `White to move`, and saved `/tmp/fairgame-chess-control-history.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-control move-history red/green test evidence, full verification, and Playwright smoke screenshot path.

## Follow-Up: Review Mode Check Highlight Isolation

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving live checked-king markers are hidden while reviewing an older Chess ply.
  Evidence: Focused RED test failed on 2026-06-04 because the reviewed Board A `e8` button still had `aria-label="Board A square e8 black king in check"` and class `checked-king`.
- [x] Suppress checked-king class and accessible label state while a board is in review mode.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after routing both square styles and square renderer state through a review-aware `displayedCheckSquare`.
- [x] Verify focused web tests, typecheck, full tests, build, and UI smoke if useful.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow review-state fix because the focused DOM test exercises the rendered Chessboard square label/class directly in review mode.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with review-mode checked-king isolation red/green test evidence and verification results.

## Follow-Up: Non-Move History Records Are Not Replayable

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving Chess board-control history records cannot enter board review mode.
  Evidence: Focused RED test failed on 2026-06-04 because `Board A current move offers draw` rendered as an enabled move-history button.
- [x] Disable replay behavior for Chess history records without board coordinates.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making history buttons replayable only when the record has `fenAfter`, `from`, and `to`.
- [x] Verify focused web tests, typecheck, full tests, build, and UI smoke if useful.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow move-history control fix because the focused DOM test directly verifies the disabled record and live board state.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with non-move Chess history replay red/green test evidence and verification results.

## Follow-Up: Review Mode Status Label

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving a reviewed Chess board does not show the live `Your move` status.
  Evidence: Focused RED test failed on 2026-06-04 because Board A showed `Your move` while replaying review ply 1.
- [x] Render an explicit board-local review status while a Chess board is replaying an older move.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding a review-aware Board heading status that displays `Reviewing move N`.
- [x] Verify focused web tests, typecheck, full tests, build, and UI smoke if useful.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow heading-state fix because the focused DOM test directly verifies the board panel text while entering and leaving review mode.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with review-mode status-label red/green test evidence and verification results.

## Follow-Up: Review Mode Turn Pill Isolation

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving a reviewed Chess board does not show the live turn/check pill.
  Evidence: Focused RED test failed on 2026-06-04 because Board A still showed the live `Black in check` turn pill while replaying review ply 1.
- [x] Render a review-specific turn pill while a Chess board is replaying an older move.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making the Chess turn pill show `Review` without live turn/check classes in review mode.
- [x] Verify focused web tests, typecheck, full tests, build, and UI smoke if useful.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow review-pill fix because the focused DOM test directly verifies the board panel text while replaying an older move.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with review-mode turn-pill red/green test evidence and verification results.

## Follow-Up: Review Mode Player Row Isolation

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving a reviewed Chess board does not show live to-move player-row highlighting.
  Evidence: Focused RED test failed on 2026-06-04 because Board A still had one `.to-move` player row while replaying review ply 1.
- [x] Suppress player-row to-move highlighting while a Chess board is replaying an older move.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making Chess player-row `to-move` styling conditional on the board not being in review mode.
- [x] Verify focused web tests, typecheck, full tests, build, and UI smoke if useful.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow review-row fix because the focused DOM test directly verifies player-row highlighting while entering and leaving review mode.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with review-mode player-row red/green test evidence and verification results.

## Follow-Up: Chess Outcome Reason Status

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving Chess board headings surface outcome reasons for resignation and agreed draws.
  Evidence: Focused RED test failed on 2026-06-04 with Board A still rendering `Opponent won` and `Draw` instead of `Opponent won by resignation` and `Draw by agreement`.
- [x] Render Chess-specific outcome reason text for wins and draws.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding Chess-specific outcome reason formatting for board heading statuses.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow text-rendering fix because the focused DOM tests directly verify the rendered Chess board-heading text after resignation and draw acceptance.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with Chess outcome-reason status red/green test evidence and verification results.

## Follow-Up: Chess Result Pill Outcome Reasons

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving completed Chess boards show outcome reasons in the result pill without stale live-turn color classes.
  Evidence: Focused RED test failed on 2026-06-04 because Board A result pills still rendered `Won` and `Draw` instead of `Won by resignation` and `Draw by agreement`.
- [x] Render a neutral Chess result pill with outcome reason text for completed boards.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after routing completed Chess result-pill text through Chess outcome formatting and switching completed boards to the `chess-turn-pill result` class.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow result-pill fix because the focused DOM tests directly verify the rendered pill text and classes after resignation and draw acceptance.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with Chess result-pill red/green test evidence and verification results.

## Follow-Up: Current Chess Move Keeps Live Mode

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving clicking the current/latest Chess move keeps the board at the live interactive position.
  Evidence: Focused RED test failed on 2026-06-04 because clicking `Board A current move e5` changed Board A to `data-review-ply="2"` instead of staying live.
- [x] Route current-move clicks to the live position instead of board review mode.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making replayable current-move clicks call the board-local return-to-live handler. The older checked-king review fixture was adjusted to review a non-current move while keeping the live checked position as the latest move.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow move-history interaction fix because the focused DOM test directly verifies Board A remains live and interactive after clicking the current move.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with current Chess move live-mode red/green test evidence and verification results.

## Follow-Up: Board-Local Chess Clock Running Styling

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving Chess clock `running` styling appears only on the player row that is to move on that specific board.
  Evidence: Focused RED test failed on 2026-06-04 because Board B black clock still had `chess-player-clock running` even though black was not to move on Board B.
- [x] Keep shared seat clock time projection while making the Chess clock row running class board-local and review-aware.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making Chess clock `running` styling depend on the board's `seatsToAct`, live board state, and the shared seat clock running flag.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow row-state fix because the focused DOM test directly verifies the rendered clock text and class state on Board A and Board B.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local Chess clock running styling red/green test evidence and verification results.

## Follow-Up: Last Coordinate Move Highlight Survives Control Records

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving a Chess board still highlights the latest coordinate move after a board-control history record.
  Evidence: Focused RED test failed on 2026-06-04 because Board A square `e2` still had only its normal background after an `e4` move followed by an `offers draw` control record. After shifting the assertion to the app-owned square button contract, the test failed because `Board A square e2 empty last move` did not exist.
- [x] Use the latest replayable coordinate move for live last-move square styling while keeping the control record current in history.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making live last-move selection skip non-coordinate records and adding an app-owned `last-move` square class plus accessible label state.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow square-state fix because the focused DOM test directly verifies both the control-history record and the rendered last-move square class/label.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with last-coordinate-move highlight red/green test evidence and verification results.

## Follow-Up: Pending Draw Offer Status Labels

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving Chess board headings distinguish sent and received draw offers.
  Evidence: Focused RED test failed on 2026-06-04 because pending own and opponent draw-offer boards still rendered `Your move` instead of `Draw offer sent` or `Opponent offers draw`.
- [x] Render draw-offer-aware Chess board status text while preserving board-local offer/accept/decline controls.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making Chess board status show `Draw offer sent` for own offers and `Opponent offers draw` for incoming offers.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow status-label fix because the focused DOM tests directly verify sent and received draw-offer board headings plus the existing board-local controls.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with pending draw-offer status red/green test evidence and verification results.

## Follow-Up: Pending Draw Offer Turn Pill

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving pending Chess draw offers render a neutral draw-offer turn pill instead of stale side-to-move state.
  Evidence: Focused RED test failed on 2026-06-04 because pending draw-offer boards still rendered `White to move` in the Chess turn pill.
- [x] Render `Draw offered` in the Chess turn pill with a neutral draw-offer class while a board draw offer is active.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after rendering active draw offers as a neutral draw-offer turn pill and tightening the pending-offer button query.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow pill-state fix because the focused DOM tests directly verify the rendered turn-pill text and classes for sent and received draw offers.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with pending draw-offer turn-pill red/green test evidence and verification results.

## Follow-Up: Board-Local Chess Takebacks

Status: Done
Started: 2026-06-04

- [x] Add failing domain, server, and web tests for board-local Chess takeback requests, acceptance, and decline.
  Evidence: Focused RED tests failed on 2026-06-04 because domain rejected `requestTakeback` as `seat-not-to-act`, server returned `400 Bad Request`, and the web header lacked request/accept/decline takeback controls and status.
- [x] Implement Chess takeback request, accept-takeback, and decline-takeback commands that affect only the selected board.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts` and, after `npm run build:packages`, `npm test -w @fairgame/server -- matches.test.ts` on 2026-06-04.
- [x] Add board-local takeback controls that are unavailable before a coordinate move, while reviewing, or after the board is over.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding board-local request, pending, accept, and decline controls with takeback-aware board status.
- [x] Verify focused tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/domain -- chess.test.ts`, `npm run build:packages`, `npm test -w @fairgame/server -- matches.test.ts`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. Playwright smoke with an in-memory API and Vite created and joined a Chess match, played `e4` on Board A, requested a Board A takeback, accepted it as Player 2, verified Board A returned the pawn to `e2`, verified Board B stayed live, and saved `/tmp/fairgame-chess-takeback.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local Chess takeback red/green test evidence, full verification, and Playwright smoke screenshot path.

## Follow-Up: Confirm Draw And Resign Actions

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving board-local Chess draw offers and resignations require a confirmation click before submitting.
  Evidence: Focused RED test failed on 2026-06-04 because clicking `Resign Board A` or `Offer Draw Board A` did not render `Confirm Resign Board A` / `Confirm Draw Offer Board A`; the current UI still submitted on first click.
- [x] Implement board-local confirmation state for outgoing draw offers and resignations without affecting the other board's controls.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making first click arm Board A-only `Confirm Resign` / `Confirm Draw Offer` controls and second click submit the unchanged server command.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. Playwright smoke with an in-memory API and Vite created and joined a Chess match, verified first-click `Confirm Draw Offer Board A` and `Confirm Resign Board A` states without arming Board B, submitted each action on the second click, verified Board B stayed live, and saved `/tmp/fairgame-chess-confirm-actions.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local draw/resign confirmation red/green test evidence, full verification, and Playwright smoke screenshot path.

## Follow-Up: Board-Local Replay Navigation Controls

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving each Chess board has independent previous/next replay controls.
  Evidence: Focused RED test failed on 2026-06-04 because Board A/Board B move history did not render `previous move` / `next move` replay controls.
- [x] Implement board-local replay navigation controls that step through replayable coordinate moves and return to live at the latest move.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding board-local Prev/Next controls that skip non-coordinate history records and return to live when stepping to the latest move.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke with an in-memory API and Vite created and joined a Chess match, applied `e4 e5` on Board A, verified Board A Prev entered `data-review-ply="1"` while Board B stayed live, verified Board A Next returned to `data-review-ply="live"` and interactive, and saved `/tmp/fairgame-chess-replay-navigation.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local replay-navigation red/green test evidence, full verification, and in-app browser smoke screenshot path.

## Follow-Up: Board-Scoped Keyboard Replay Shortcuts

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving focused Chess boards handle keyboard previous/next replay shortcuts independently.
  Evidence: Focused RED test failed on 2026-06-04 because Board A and Board B panels did not render `tabindex="0"`, leaving no focusable board target for keyboard replay.
- [x] Implement board-scoped keyboard replay handling for the focused Chess board without affecting the other board.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after making Chess board panels focusable and routing ArrowLeft/ArrowRight plus h/l through the same board-local replay navigation as the visible Prev/Next controls.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke with an in-memory API and Vite created and joined a Chess match, applied `e4 e5` on Board A, verified Board B ArrowLeft did not affect either board, verified Board A ArrowLeft/h entered `data-review-ply="1"` while Board B stayed live, verified Board A ArrowRight/l returned live and interactive, and saved `/tmp/fairgame-chess-keyboard-replay.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-scoped keyboard replay red/green test evidence, full verification, and in-app browser smoke screenshot path.

## Follow-Up: Board-Local First And Latest Replay Controls

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving each Chess board has independent first/latest replay controls and focused-board start/end keyboard shortcuts.
  Evidence: Focused RED test failed on 2026-06-04 because Board A/Board B move history did not render `first move` / `latest move` replay controls.
- [x] Implement board-local first/latest replay controls, including starting-position review and focused-board ArrowUp/ArrowDown plus k/j shortcuts.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding starting-position review as `data-review-ply="0"`, rendering board-local First/Last controls, and wiring focused-board ArrowUp/ArrowDown plus k/j through the shared replay navigation helper.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke with an in-memory API and Vite created and joined a Chess match, applied `e4 e5` on Board A, verified Board A First entered `data-review-ply="0"` with the starting FEN while Board B stayed live, verified Latest returned Board A live, verified Board B ArrowUp did not affect either board, verified Board A ArrowUp/k entered start and ArrowDown/j returned live, verified replay cards stayed within each board panel, and saved `/tmp/fairgame-chess-first-latest-replay.png`.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with first/latest replay red/green test evidence, full verification, layout smoke evidence, and in-app browser screenshot path.

## Follow-Up: Board-Scoped Flip Keyboard Shortcut

Status: Done
Started: 2026-06-04

- [x] Add failing web tests proving the focused Chess board handles the `f` flip shortcut independently.
  Evidence: Focused RED test failed on 2026-06-04 because pressing `f` on the focused Board B panel left Board B at `data-orientation="white"` instead of flipping it back to black.
- [x] Implement focused-board `f` keyboard flip handling without affecting the other board.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after routing focused board `f` keydown events through the same per-board flip state used by the visible flip control.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke created a Chess match, verified initial orientations Board A `white` and Board B `black`, pressed `f` on Board B and verified only Board B flipped to `white`, pressed `f` on Board A and verified only Board A flipped to `black`, saved `/tmp/fairgame-chess-keyboard-flip.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-scoped keyboard flip red/green test evidence, full verification, in-app browser smoke evidence, and screenshot path.

## Follow-Up: Two-Board Chess Zen Mode

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving `z` toggles a Chess Zen mode that hides surrounding app chrome while keeping both boards visible.
  Evidence: Focused RED test failed on 2026-06-04 because the Chess match region had no `data-zen-mode="false"` state marker and no `z` shortcut behavior.
- [x] Implement a Chess match-level Zen mode that is unavailable outside Chess matches and toggles from the `z` shortcut.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding Chess-only `z` shortcut handling, Zen-mode app chrome removal, match-summary hiding, `data-zen-mode` state, and compact two-board Zen layout styling.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke created a Chess match, verified `z` changed `data-zen-mode` from `false` to `true`, hid the top heading, primary navigation, and match summary while keeping both Chess boards mounted, saved `/tmp/fairgame-chess-zen-mode.png`, pressed `z` again to restore the normal shell, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with two-board Chess Zen mode red/green test evidence, full verification, in-app browser smoke evidence, and screenshot path.

## Follow-Up: Board-Scoped Wheel Replay Navigation

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving wheel scrolling over one Chess board navigates only that board's replay state.
  Evidence: Focused RED test failed on 2026-06-04 because wheel-up over Board A left Board A at `data-review-ply="live"` instead of entering replay ply 1.
- [x] Implement board-scoped wheel replay handling that reuses the existing previous/next replay helpers.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after wiring Chess board panel wheel events through the existing board-local previous/next replay helpers.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke created and joined a Chess match, seeded `e4 e5` on Board A, verified scrolling over Board B did not affect replay state, verified scrolling up over Board A entered `data-review-ply="1"` while Board B stayed live, verified scrolling down over Board A returned Board A live, saved `/tmp/fairgame-chess-wheel-replay.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-scoped wheel replay red/green test evidence, full verification, in-app browser smoke evidence, and screenshot path.

## Follow-Up: Board-Local Chess Annotation Circles

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving right-click annotation circles are board-local and support modifier colors.
  Evidence: Focused RED test failed on 2026-06-04 because right-clicking Board A `e4` did not render `Board A square e4 empty green circle` or an `annotation-green` class.
- [x] Implement board-local right-click annotation circles without changing legal move click behavior.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding board-local annotation state, context-menu square toggling, annotation color labels/classes, and CSS rings for green/red/blue/yellow circles.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke created a Chess match, right-clicked Board A `e4` into a green circle, shift-right-clicked Board B `e4` into a red circle, verified Board A and Board B labels/classes stayed independent, right-clicked Board A `e4` again to remove only Board A's circle, saved `/tmp/fairgame-chess-annotation-circles.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local annotation circle red/green test evidence, full verification, in-app browser smoke evidence, and screenshot path.

## Follow-Up: Board-Local Chess Annotation Arrows

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving right-click drag annotation arrows are board-local and support modifier colors.
  Evidence: Focused RED test failed on 2026-06-04 because right-click dragging Board A `e2` to `e4` did not render `Board A arrow e2 to e4 green`.
- [x] Implement board-local right-click drag arrows without interfering with circle toggles or move input.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding board-local arrow state, right-button drag detection, drag-context-menu suppression, and orientation-aware SVG arrows with green/red/blue/yellow classes.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. During verification, a full-suite run exposed an intermittent Zen shortcut listener race; fixed it by mounting the window key listener once and reading current Chess-match state from a ref, then reran and passed the same verification commands. Standalone Playwright smoke with an in-memory API and Vite created a Chess match, true right-dragged Board A `e2` to `e4` into a green arrow, shift-right-dragged Board B `e7` to `e5` into a red arrow, verified arrow labels/classes stayed independent, verified the drag did not create an unwanted circle, verified repeating Board A's arrow gesture removed only Board A's arrow, saved `/tmp/fairgame-chess-annotation-arrows.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local annotation arrow red/green test evidence, full verification, Playwright smoke evidence, and screenshot path.

## Follow-Up: Board-Local Chess Annotation Clearing

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving left-clicking empty board space clears only that board's annotations.
  Evidence: Focused RED test failed on 2026-06-04 because left-clicking Board A `a4` left Board A `c4` labeled `green circle` and left Board A's `d2` to `d4` green arrow rendered.
- [x] Implement board-local annotation clearing without interfering with piece selection or legal move input.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after routing plain empty-square left clicks through board-local annotation clearing while preserving legal-destination move handling.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke with an in-memory API and Vite created a Chess match, right-clicked Board A `c4` into a green circle and Board B `e4` into a red circle, left-clicked Board A `a4`, verified Board A's circle cleared while Board B's circle remained, and saved `/tmp/fairgame-chess-annotation-clear-circles.png`. Standalone Playwright smoke with the same local servers added Board A and Board B circles plus true right-drag arrows, left-clicked Board A `a4`, verified Board A's circle and arrow cleared while Board B's red circle and red arrow remained, saved `/tmp/fairgame-chess-annotation-clear.png`, then stopped the local smoke servers and confirmed ports 4100 and 5174 were clear.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local annotation clearing red/green test evidence, full verification, browser smoke evidence, and screenshot paths.

## Follow-Up: Destination-Square Chess Promotion Picker

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving the Chess promotion picker is anchored to the promotion destination square and board orientation.
  Evidence: Focused RED test failed on 2026-06-04 because the rendered promotion picker had no `data-promotion-square="a8"` placement metadata.
- [x] Implement destination-square promotion picker placement without changing promotion move submission.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx` on 2026-06-04 after adding orientation-aware promotion square grid positioning, picker placement metadata, and a square-anchored vertical promotion chooser.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. Standalone Playwright smoke with Vite and mocked API routes opened a deterministic Board A promotion position, clicked `a7` to `a8`, verified the picker had `data-promotion-square="a8"`, `data-board-orientation="white"`, `--promotion-file: 0`, `--promotion-rank: 0`, and a top-left board delta of `0,0`, clicked `Promote to queen`, verified the submitted move payload was `{ from: "a7", to: "a8", promotion: "q" }`, saved `/tmp/fairgame-chess-promotion-picker.png`, then stopped Vite and confirmed port 5174 was clear.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with destination-square promotion picker red/green test evidence, full verification, browser smoke evidence, and screenshot path.

## Follow-Up: Flipped-Board Chess Promotion Picker

Status: Superseded
Started: 2026-06-04

- [ ] Add a failing web test proving the promotion picker anchors correctly on a black-oriented board.
  Evidence: Superseded before implementation because the destination-square promotion picker already routes placement through the orientation-aware `getChessSquareGridPosition` helper, making this a duplicate of the existing coverage path rather than a separate behavior slice.
- [ ] Implement any needed flipped-board placement correction without changing promotion move submission.
  Evidence: Superseded before implementation; continuation moved to board-local premoves as the next higher-value lichess-like Chess interaction.
- [ ] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Not run for this superseded slice.
- [ ] Update roadmap and this plan with evidence.
  Evidence: This plan records the supersession point and continuation condition.

Continuation: Proceed with `Follow-Up: Board-Local Chess Premoves`.

## Follow-Up: Board-Local Chess Premoves

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving a non-turn Chess player can queue a board-local premove without submitting it immediately.
  Evidence: Focused RED test failed on 2026-06-04 with `Unable to find an accessible element with the role "button" and name "Board B square e5 empty premove destination"` after selecting an own black pawn on waiting Board B.
- [x] Implement board-local premove selection, highlighting, and automatic submission when that board becomes actionable.
  Evidence: Passed focused premove test on 2026-06-04 after adding waiting-player own-piece selection, `premove-destination` / `premove-source` / `premove-target` labels and classes, board-local pending premove state, and auto-submission when the server-projected legal move appears.
- [x] Verify focused web tests, whitespace, typecheck, full tests, build, and browser smoke.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx -t "queues and submits a board-local Chess premove"`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. In-app browser smoke with a disposable built frontend/API fixture created a Chess match, queued Board B black `e7-e5` while Board B was noninteractive and opponent-to-move, verified `premove-source` and `premove-target` classes, triggered the board-ready update, verified the submitted payload was `{ boardId: "B", seat: "seat1", move: { from: "e7", to: "e5" } }`, verified the premove highlights cleared when Board B became actionable, saved `/tmp/fairgame-chess-premove.png`, and confirmed port 4175 was clear after stopping the smoke server.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local Chess premove red/green test evidence, full verification, and in-app browser smoke evidence.

## Follow-Up: Board-Local Chess Premove Cancellation

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving a queued board-local Chess premove can be canceled before it submits.
  Evidence: Focused RED test failed on 2026-06-04 because right-clicking the queued Board B premove target left `Board B square e7 black pawn premove source` rendered, so the normal `Board B square e7 black pawn` label was missing.
- [x] Implement premove cancellation without interfering with normal board-local annotation behavior.
  Evidence: Passed the focused premove-cancellation test on 2026-06-04 after making a right-click on a board with a pending premove clear that board's premove/selection before annotation handling; a second right-click on the same square still creates the normal board-local annotation circle.
- [x] Verify focused web tests, whitespace, typecheck, full tests, build, and browser smoke if useful.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx -t "cancels a queued board-local Chess premove"`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04. No separate browser smoke was added for this narrow context-menu fix because the focused DOM test exercises the rendered right-click cancellation path and verifies normal annotation behavior resumes afterward.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-local Chess premove-cancellation red/green test evidence and verification results.

## Follow-Up: Board-Scoped Chess Escape Cancellation

Status: Done
Started: 2026-06-04

- [x] Add a failing web test proving Escape cancels a queued board-local Chess premove before it submits.
  Evidence: Focused RED test failed on 2026-06-04 because pressing Escape on the Board B panel left `Board B square e7 black pawn premove source` rendered, so the normal `Board B square e7 black pawn` label was missing.
- [x] Implement board-scoped Escape cancellation for transient Chess interaction state.
  Evidence: Passed the focused Escape premove-cancellation test on 2026-06-04 after adding a board-local Escape path that clears selected square, pending premove, promotion picker, and pending confirmation for the focused Chess board.
- [x] Verify focused web tests, whitespace, typecheck, full tests, and build.
  Evidence: Passed `npm test -w @fairgame/web -- App.test.tsx -t "cancels a queued board-local Chess premove with Escape"`, `npm test -w @fairgame/web -- App.test.tsx`, `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` on 2026-06-04.
- [x] Update roadmap and this plan with evidence.
  Evidence: Updated `roadmap.md` and this plan with board-scoped Chess Escape cancellation red/green test evidence and verification results.

## Final Closure Audit

Status: Done
Started: 2026-06-04

- [x] Audit the broad Chess/domain/server/web diff for obvious regressions before commit.
  Evidence: Reviewed the Chess rules, server game registry projection/control path, web Chess board interaction state, move-history/replay helpers, and roadmap/plan state on 2026-06-04. No blocking correctness issue was found; the only suspected seat-forgery concern was already blocked at the HTTP route boundary because commands accept only `seat1` or `seat2`, matching the fixed two-seat match model.
- [x] Run fresh full verification before final commit.
  Evidence: Passed `git diff --check`, `npm run typecheck`, `npm test` (shared 2, domain 103, server 51, web 37), and `npm run build` on 2026-06-04.
- [x] Run a final two-board Chess browser smoke.
  Evidence: In-app browser smoke against a disposable in-memory API on port 4100 and Vite on port 5174 created a Chess match, joined Player 2 through the local API, played Board A `e2-e4`, verified Board A move history showed `e4`, queued Board B black `e7-e5` as a premove, submitted Board B White `e2-e4` through the local API, verified the Board B premove auto-submitted and Board B move history showed `e5`, verified focused Board A `f` flipped only Board A while Board B remained black-oriented, toggled Zen mode with `z`, saved `/tmp/fairgame-chess-final-smoke.png`, and confirmed ports 4100 and 5174 were clear afterward.
- [x] Update roadmap and this plan with closure evidence.
  Evidence: Updated `roadmap.md` and this plan with fresh verification and final browser-smoke evidence. Commit hash pending.
