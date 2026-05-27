# Checkpoint 0 Bootstrap Design

## Goal

Prepare `/Volumes/T9/code/2-boards` as the top-level repository for the Fair
Two-Board Game rebuild, while keeping all prior attempts locally available as
ignored reference material.

## Workspace Layout

The final top-level layout should be:

```text
/Volumes/T9/code/2-boards/
  .git/
  .gitignore
  AGENTS.md
  roadmap.md
  archive/
    README.md
    attempts/       # ignored by the top-level Git repo
      board2/
      chess2/
      fairgame-gpt5/
      ...
  docs/
    superpowers/
      specs/
      plans/
  fairgame-rebuild/
```

Old attempt folders remain useful references, but they should not be tracked by the new
top-level repository. Many contain their own `.git` directories, so tracking them in
the parent repo would create nested repository problems and unnecessary history.

## Rebuild Project Bootstrap

Create `fairgame-rebuild` as a clean npm workspace project with this structure:

```text
fairgame-rebuild/
  README.md
  package.json
  tsconfig.base.json
  apps/
    server/
    web/
  packages/
    domain/
    shared/
  tests/
    e2e/
```

The bootstrap should include working scripts for TypeScript checking, unit testing,
building, development servers, and Playwright E2E smoke tests.

## Technical Decisions

- Package manager: npm.
- Language: TypeScript.
- Web app: React and Vite.
- Server app: Node, Express, and Socket.IO-ready structure.
- Local database later: PGlite.
- Hosted database later: Neon Postgres.
- Unit test runner: Vitest.
- E2E runner: Playwright.
- Browser verification: Codex built-in browser tooling only, unless the user explicitly
  asks for Chrome.

## Initial Verification Target

The bootstrap is complete when:

- old attempts are moved to `archive/attempts/`;
- `/archive/attempts/` is ignored by the top-level Git repo;
- the top-level repo is initialized;
- `fairgame-rebuild` installs dependencies;
- `npm run typecheck`, `npm test`, and `npm run build` pass in `fairgame-rebuild`;
- Playwright can open the local web app and verify the bootstrap page;
- `roadmap.md` contains evidence for completed checkpoint 0 items;
- the checkpoint is committed.
