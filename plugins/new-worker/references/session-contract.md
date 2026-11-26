# Session Document and Scratch Contract

This contract governs session documents (`tasks.md`, `NN-<slug>.plan.md`, `NN-<slug>.report.md`) and external
scratch outputs across all skills and subagents.

## 1. Directory, Metadata, and Link Resolution

1. Resolve `<session-dir>`, `<scratch-dir>`, file-write metadata flags, and Markdown link formatting by reading the
   single host adapter matching the active runtime in [../harnesses/README.md](../harnesses/README.md).
2. When the `new-worker-ui` MCP server is connected, treat its SQLite database (`<dataDir>/new-worker.sqlite`,
   managed with forward-only transactional migrations and pre-migration `.bak` backups) as the canonical structured
   state. Pass `exportDir: "<session-dir>"` (and optional `rootDir` / `groupId`) so the server exports matching
   `tasks.md`, `NNN-<slug>.plan.md`, and `NNN-<slug>.report.md` files automatically. Reading workspace state via
   `open_workspace`, `query_workspace`, `query_timeline`, `app_get_dashboard_state`, or `app_get_widget_state` is
   strictly read-only and writes zero database rows. When `new-worker-ui` is unavailable, write those Markdown files
   directly using host file tools.
3. When the active host places `<session-dir>` inside the target repository workspace, inspect `.gitignore` or
   `.git/info/exclude` first and never stage or commit session documents unless the user explicitly asks to commit them.
4. Never write `<scratch-dir>` outputs (such as `new::project-scout` reports or temporary analysis scripts) inside a
   target repository tree.

## 2. Global Task Numbering (`taskId` / `NNN`)

1. When `new-worker-ui` is connected, `write_plan`, `upsert_task`, and standalone `write_report` allocate a global
   auto-incrementing integer `taskId` starting at `1` across all sessions (`#1`, `#2`, `#3`) when `taskId` is omitted.
   Exported artifacts use at least three digits (`001-<slug>.plan.md`, `001-<slug>.report.md`, and so on). When
   `new-worker-ui` is unavailable, inspect `tasks.md` and existing files in `<session-dir>` and allocate `max(NN) + 1`
   starting at `01` (`01`, `02`, `03`, or three-digit `001` when continuing an exported session).
2. Name task artifacts `NNN-<kebab-slug>.<role>.md` (or `NN-<kebab-slug>.<role>.md` in manual fallback sessions),
   keeping `<kebab-slug>` to 3 to 5 lowercase ASCII words. Supported roles are `plan` and `report`.
3. Never reuse an allocated task ID or overwrite an earlier task's documents.

## 3. Mutability Rules

1. **`tasks.md` (single mutable hub)**:
    - Keep a `# Session Tasks` header and `# | Status | Task | Docs` Overview Table at the top so every task's status
      and artifact links remain visible in the first 10 lines.
    - Collapse completed, cancelled, or superseded tasks inside `<details>` blocks
      (`<summary>[x] Task #1 - Title</summary>`), placing Markdown links in the Overview Table and on the first Markdown
      line inside `<details>` (never inside `<summary>`). Once more than 3 tasks finish in one session, older collapsed
      `<details>` blocks can keep only `Docs` and `Summary` instead of every historical checkbox.
    - Keep only active tasks expanded under `## Task #<id> - <Title>` (or `## Task NN - <Title>` in manual fallback)
      using standard GFM `- [ ]` and `- [x]` checkboxes, with at most one item marked `- [ ] **(in progress)**`.
2. **`NNN-<slug>.plan.md`**: Updatable via `update_plan` (or `write_plan` with `taskId`) during pre-approval review,
   mid-execution or post-completion reconfiguration, and when reconciling host Plan Mode disk edits back into SQLite.
   Record minor unscheduled implementation drift in the report's `Plan Deviations` section; update the plan directly
   when scope, architecture, or requirements change. When `new-worker-ui` is connected, `write_plan` generates the plan
   Markdown file on disk when `exportDir` is set and returns `taskId` plus `planFilePath` so the harness can present or
   move it as a native plan artifact.
3. **`NNN-<slug>.report.md`**: Immutable once delivered. The `new-worker-ui` server rejects `write_report` overwrites
   for an existing `taskId`.

## 4. Language Parity

Write the `tasks.md` entry and every `NN-<slug>.*` artifact for a task in one consistent language matching the user's
prompt or explicit language request.

## 5. Minimal Chat Handoff Discipline

Never paste `NN-<slug>.plan.md` or `NN-<slug>.report.md` contents into chat. Reply in 1 to 2 sentences linking the
relevant files (flagging open decisions when awaiting plan approval), using the link format required by the active host
adapter in [../harnesses/README.md](../harnesses/README.md).
