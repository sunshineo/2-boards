# /Volumes/T9/code/2-boards Index

Last updated: 2026-05-27

This index describes the immediate subfolders under `/Volumes/T9/code/2-boards`. It is intentionally one level deep; deeper indexes can be added inside individual project folders later.

| Folder | Description | Status / Notes |
| --- | --- | --- |
| `archive` | Historical reference material. `archive/attempts/` contains old board-game and FairGame attempts and is ignored by the top-level Git repo. | Keep as reference only. Do not develop in archived attempts unless explicitly instructed. |
| `docs` | Durable Superpowers specs and implementation plans for the rebuild. | Tracked in the top-level repo. |
| `fairgame-rebuild` | Clean active implementation of the Fair Two-Board Game platform. | Create and develop here. |

## Notes

- The top-level `/Volumes/T9/code/2-boards` folder is the active rebuild repository.
- Old attempts have moved to `archive/attempts/` and should remain ignored by the top-level Git repo.
- `archive/attempts/fairgame3/fairgame` is a nested Git repo under another archived Git repo. Treat it as historical reference material only.

## Fair Two-Board Roadmap Tracking

- Treat `roadmap.md` as the durable execution roadmap for the next FairGame rebuild.
- Build the next FairGame implementation in a clean new project folder under `/Volumes/T9/code/2-boards`, not inside any existing attempt folder.
- Use `fairgame-rebuild` as the default new folder name unless the user explicitly chooses a different name before bootstrapping.
- Move old attempt folders into `archive/attempts/`, ignore that directory from the top-level Git repo, and treat those attempts as references only.
- After the archive move, refer to old attempts by paths such as `archive/attempts/fairgame-gpt5`, `archive/attempts/board2`, `archive/attempts/chess2`, `archive/attempts/claude-fairgame`, and `archive/attempts/fairgame2`.
- Initialize a Git repository at `/Volumes/T9/code/2-boards` and commit completed roadmap checkpoints there. Do not track `archive/attempts/`.
- Use `npm` as the package manager, PGlite as the local database, and keep the database layer compatible with a later move to Neon Postgres.
- Use both append-only event storage and current snapshots for persistence unless the user explicitly changes this decision.
- Keep the fair-match framework game-agnostic. Game-specific concepts such as checkmate, castling, columns, captures, marks, and draw-offer rules belong inside each game rules module.
- Keep board outcomes generic: in-progress, draw, win, or canceled. Game-specific outcome reasons may be stored/displayed as strings but should not be interpreted by the framework beyond scoring and match completion.
- Treat `canceled` as a whole-match outcome, not a single-board outcome.
- Before accounts exist, use refresh-safe seat claims for player continuity; prefer secure HTTP-only cookies for normal browser play.
- Keep generic match UI and game-specific board UI separate: the framework owns room/two-board/timer/score layout, while each game owns board rendering and move input semantics.
- Work through roadmap checkpoints sequentially: write/confirm a spec when needed, write a Superpowers implementation plan, execute the plan, verify with tests and browser automation, commit, update `roadmap.md`, then move to the next checkpoint.
- For browser verification, use Codex's built-in browser tooling and Playwright-based automation. Do not open or control the user's Chrome browser unless the user explicitly requests Chrome for that task.
- After implementing UI behavior and starting the local dev server, verify important flows in the built-in browser and record the result in `roadmap.md` when it completes a roadmap item.
- When starting, completing, blocking, skipping, or superseding roadmap work, update the relevant checkbox/status in `roadmap.md`.
- For completed work, record evidence in `roadmap.md`: files changed, verification command/result, and commit hash when available.
- Do not leave roadmap items appearing unstarted after implementation work has happened.
