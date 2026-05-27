# Checkpoint 0 Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/Volumes/T9/code/2-boards` into the top-level FairGame rebuild repo with archived old attempts and a verified clean npm/TypeScript/Playwright bootstrap.

**Architecture:** Keep old projects as ignored references under `archive/attempts/`. Create a clean `fairgame-rebuild` npm workspace with separate web, server, domain, shared, and E2E areas so later roadmap checkpoints can add domain logic, real-time rooms, persistence, and games without restructuring.

**Tech Stack:** npm, TypeScript, React, Vite, Express, Socket.IO-ready server structure, Vitest, Playwright.

---

### Task 1: Archive Old Attempts

**Files:**
- Modify: `/Volumes/T9/code/2-boards/AGENTS.md`
- Modify: `/Volumes/T9/code/2-boards/roadmap.md`
- Create: `/Volumes/T9/code/2-boards/.gitignore`
- Create: `/Volumes/T9/code/2-boards/archive/README.md`
- Move: existing attempt folders into `/Volumes/T9/code/2-boards/archive/attempts/`

- [ ] **Step 1: Create archive directory**

Run:

```bash
mkdir -p archive/attempts
```

Expected: `archive/attempts` exists.

- [ ] **Step 2: Move attempt folders**

Run:

```bash
mv board2 chess-llm-claude chess-with-llm chess2 claude-fairgame claude-fairgame2 claude-fairgame3 fairgame fairgame-gpt5 fairgame-old fairgame0 fairgame1 fairgame2 fairgame3 archive/attempts/
```

Expected: the listed folders are under `archive/attempts/` and no longer at the top level.

- [ ] **Step 3: Add top-level ignore rules**

Create `.gitignore` with:

```gitignore
.DS_Store
node_modules/
dist/
build/
coverage/
playwright-report/
test-results/
.env
.env.*
!.env.example
/archive/attempts/
```

- [ ] **Step 4: Add archive README**

Create `archive/README.md` describing `archive/attempts/` as ignored historical references.

- [ ] **Step 5: Update AGENTS and roadmap references**

Replace references to old top-level attempt paths with `archive/attempts/<name>` where relevant. Keep roadmap status evidence for the archive move.

### Task 2: Initialize Top-Level Git Repo

**Files:**
- Create: `/Volumes/T9/code/2-boards/.git/`

- [ ] **Step 1: Initialize repository**

Run:

```bash
git init
```

Expected: top-level `.git/` exists.

- [ ] **Step 2: Verify archive attempts are ignored**

Run:

```bash
git status --short --ignored
```

Expected: `archive/attempts/` appears as ignored, and old attempt contents are not tracked.

### Task 3: Scaffold Rebuild Workspace

**Files:**
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/package.json`
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/README.md`
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/tsconfig.base.json`
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/apps/web/*`
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/apps/server/*`
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/packages/domain/*`
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/packages/shared/*`
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/tests/e2e/*`

- [ ] **Step 1: Create npm workspace package files**

Create root and package-level `package.json` files with scripts for `dev`, `build`,
`typecheck`, `test`, and `test:e2e`.

- [ ] **Step 2: Create minimal domain and shared packages**

Add exported placeholder modules and unit tests so workspace references and Vitest are
verified before domain work starts.

- [ ] **Step 3: Create minimal server app**

Add Express server with `/health` returning `{ ok: true }`. Keep the structure ready for
future Socket.IO and command handlers.

- [ ] **Step 4: Create minimal web app**

Add React/Vite app that renders a bootstrap page with project name, status, and the
roadmap checkpoint label.

- [ ] **Step 5: Create Playwright smoke test**

Add an E2E test that opens the Vite app and verifies the bootstrap page content.

### Task 4: Install And Verify

**Files:**
- Create: `/Volumes/T9/code/2-boards/fairgame-rebuild/package-lock.json`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install
```

Expected: install completes and creates `package-lock.json`.

- [ ] **Step 2: Run type checks**

Run:

```bash
npm run typecheck
```

Expected: all workspace packages typecheck successfully.

- [ ] **Step 3: Run unit tests**

Run:

```bash
npm test
```

Expected: Vitest unit tests pass.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: server, web, domain, and shared packages build successfully.

- [ ] **Step 5: Run Playwright smoke test**

Run:

```bash
npm run test:e2e
```

Expected: Playwright starts the Vite dev server and the smoke test passes.

### Task 5: Record Evidence And Commit

**Files:**
- Modify: `/Volumes/T9/code/2-boards/roadmap.md`
- Git commit: checkpoint 0 bootstrap

- [ ] **Step 1: Update roadmap evidence**

Mark completed checkpoint 0 items as `[x]` and add evidence lines listing changed files,
verification commands, and results.

- [ ] **Step 2: Review Git status**

Run:

```bash
git status --short --ignored
```

Expected: tracked changes include docs, roadmap, AGENTS, `.gitignore`, `archive/README.md`,
and `fairgame-rebuild`; ignored changes include `archive/attempts/`.

- [ ] **Step 3: Commit checkpoint 0**

Run:

```bash
git add .gitignore AGENTS.md roadmap.md archive/README.md docs fairgame-rebuild
git commit -m "chore: bootstrap fairgame rebuild workspace"
```

Expected: commit succeeds.

- [ ] **Step 4: Add commit hash to roadmap**

Run:

```bash
git rev-parse --short HEAD
```

Expected: commit hash is available and recorded in `roadmap.md` evidence.
