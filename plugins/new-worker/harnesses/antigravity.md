# Antigravity Host Adapter

Use this adapter when running inside Google Antigravity (`<Artifact Directory Path>`, `ArtifactMetadata`,
`invoke_subagent`, or `~/.gemini/config/plugins/`).

## 1. Paths and Pre-Scan Script

- **Plugin root**: `~/.gemini/config/plugins/my-agents/plugins/new-worker/` (or `~/.gemini/config/plugins/new-worker/`
  or `.agents/plugins/new-worker/` in standalone installs).
- **Pre-scan script**: `~/.gemini/config/plugins/my-agents/plugins/new-worker/scripts/scout_prescan.py` (fallback:
  `~/.gemini/config/plugins/new-worker/scripts/scout_prescan.py` or
  `.agents/plugins/new-worker/scripts/scout_prescan.py`).

## 2. Session and Scratch Artifacts

- **`<session-dir>`**: `<Artifact Directory Path>` (`<appDataDir>/brain/<conversation-id>/`). When writing session
  documents with `write_file` or `edit_file`, pass `Overwrite: true` and set `ArtifactMetadata` when exposed:
    - `NN-<slug>.plan.md` awaiting review: `UserFacing: true`, `RequestFeedback: true`.
    - `tasks.md` and `NN-<slug>.report.md`: `UserFacing: true`, `RequestFeedback: false`.
- **`<scratch-dir>`**: `<Artifact Directory Path>/scratch/` (for example, `scout-<repo>.md` or
  `scout-<repo>-<scope>.md`). Pass `Overwrite: true` and **omit `ArtifactMetadata`** so scratch outputs stay
  non-artifact files.

## 3. Links, Approval UI, and Tool Mapping

- **Links**: Use absolute `file:///...` links (`file:///path/to/file.ext#L10-L25`) for both sibling artifacts and
  workspace source files.
- **Plan approval handoff**: Invite the user to reply with approval or click `Proceed`.
- **Tool mapping**:
    - File reader / editor / writer: `read_file` / `edit_file` / `write_file`
    - Shell runner: `run_command` (`manage_task` for background jobs)
    - Structured user prompt: `ask_question`
    - Web search: `search_web`
    - Subagents: `invoke_subagent`, `manage_subagents`, `send_message`

## 4. Subagent Model and Invocation (`new::project-scout`)

- Antigravity ignores `model:` frontmatter on `agents/*.md` and defaults `invoke_subagent` to `inherit`. Always pass
  `Model: "flash"` explicitly when invoking `new::project-scout` and `new::project-scout-worker`.
- Pass `Workspace: "inherit"` and an explicit `OutputPath` under `<Artifact Directory Path>/scratch/` to
  `new::project-scout`.
- Stop calling tools and wait for reactive wakeup after launching subagents instead of polling in a loop.

## 5. MCP Tool Invocation (`new::tools-intellij` and `new-worker-ui`)

- Call eagerly registered MCP tools directly (`mcp_<server>_<toolName>`).
- For lazy-loaded MCP tools, inspect `<appDataDir>/mcp/<server>/<toolName>.json` for exact schemas, then invoke
  `call_mcp_tool` with `ServerName`, `ToolName`, and `Arguments`.
- For `new-worker-ui`: `open_workspace` registers `aux_pane` and `global` entrypoints (`"New Worker"`) pointing to
  the isolated Dashboard UI (`ui://new-worker/dashboard`), while inline model tools render dedicated lightweight widgets
  (`ui://new-worker/widget/task`, `plan`, `report`, `handoff`, `questions`). `update_task_item` is data-only and does
  not render a step progress widget in chat. Reading via `open_workspace`, `query_workspace`, `query_timeline`,
  `app_get_dashboard_state`, or `app_get_widget_state` is strictly read-only. Whenever creating a new session, call
  `open_workspace({ sessionId })` so Antigravity auto-opens the Dashboard UI in the side pane. Persistent state lives
  in a SQLite database (`new-worker.sqlite`) inside `--data-dir` (configured as `${PLUGIN_DATA}` in `mcp_config.json`,
  falling back to `mcp-app/data/`). Pass `sessionId: "<conversation-id>"`, optional `rootDir` / `groupId`, and
  `exportDir: "<Artifact Directory Path>"` when calling mutating tools so Markdown artifacts stay synced.
- For tasks, plans, and context: `write_plan`, `upsert_task`, and standalone `write_report` allocate global
  auto-incrementing integer `taskId` values starting at `1` across all sessions. `manage_context` manages session
  titles, `rootDir`, 1:N session groups (`session_groups`), and manual timeline notes with polymorphic links.
  `query_workspace` and `query_timeline` let agents inspect session/group metadata, task steps, plans, reports,
  handoffs, questions, and timeline events on demand.
- For plans, reports, and tasks: `write_plan`, `update_plan`, `write_report`, and `upsert_task` render a single-row
  inline summary with a clickable file link to the exported Markdown artifact (`tasks.md`, `NNN-<slug>.plan.md`,
  `NNN-<slug>.report.md`). `write_plan` generates `NNN-<slug>.plan.md` and returns `taskId` plus `planFilePath` so
  Antigravity can present it as a plan artifact (`ArtifactMetadata`) for approval in Antigravity's native UI.
- For Plan Mode sync and reconfiguration: Prefer `update_plan` (passing `sessionId`, `taskId`, only changed fields, and
  optional `changeSummary` or `reviewStatus`) instead of raw `edit_file` or `write_file` on `NNN-<slug>.plan.md`. If
  Antigravity Plan Mode edits `NNN-<slug>.plan.md` directly on disk after generating it, call `update_plan` right after
  starting the task in Execution Mode to sync the final Markdown back into SQLite without toggling back into Plan Mode
  (preserving the prompt prefix cache). `update_plan` also works after task completion when a plan is reconfigured.
- For questions, logs, and Dashboard layout: `ask_questions` supports `blockingMode` (`immediate`, `before_step_finish`,
  `anytime`) and optional global `taskId` + `stepNumber`. Task checklists in the Dashboard UI are read-only with
  automatic task/step/item time tracking and show steps for archived tasks as well. The Dashboard uses a CSS Grid layout
  with a sticky header, a **Logs** toggle button that opens the scrollable footer Log view (max 100 viewable entries,
  with **Clear All**, automatically pruned to 100 rows in SQLite whenever a new session starts), and **Settings**
  configuring `Default Widget Display` for expandable widgets (Handoffs and Questions). Numbered task steps exclude
  plan/workspace initialization.
- For live UI development, set `NEW_WORKER_DASHBOARD_HTML` / `NEW_WORKER_WIDGET_HTML` (or pass `--dashboard-html` /
  `--widget-html`) and refresh `new-worker_new-worker-ui` through **MCP Servers** settings or `RefreshMcpServers`.

## 6. Rule Budget Guardrail

Antigravity caps each rule file under `rules/` at `24,000` bytes and auto-loads every Markdown file inside `rules/`.
Keep only `rules/AGENTS.md` inside `rules/`.
