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
  (`ui://new-worker/widget/task`, `task-step`, `plan`, `report`, `handoff`, `questions`). Reading via `open_workspace`,
  `query_workspace`, `query_timeline`, `app_get_dashboard_state`, or `app_get_widget_state` is strictly read-only.
  Persistent state lives in a SQLite database (`new-worker.sqlite`) inside `--data-dir` (configured as `${PLUGIN_DATA}`
  in `mcp_config.json`, falling back to `mcp-app/data/`). Pass `sessionId: "<conversation-id>"`, optional `rootDir` /
  `groupId`, and `exportDir: "<Artifact Directory Path>"` when calling mutating tools so Markdown artifacts stay synced.
- For tasks, plans, and context: `write_plan`, `upsert_task`, and standalone `write_report` allocate global
  auto-incrementing integer `taskId` values starting at `1` across all sessions. `manage_context` manages session
  titles, `rootDir`, 1:N session groups (`session_groups`), and manual timeline notes with polymorphic links.
  `query_workspace` and `query_timeline` let agents inspect session/group metadata, task steps, plans, reports,
  handoffs, questions, and timeline events on demand.
- For plans: `write_plan` generates `NNN-<slug>.plan.md` and returns `taskId` plus `planFilePath` so Antigravity can
  present it as a plan artifact (`ArtifactMetadata`) for approval in Antigravity's native UI.
- For questions & tasks: `ask_questions` supports `blockingMode` (`immediate`, `before_step_finish`, `anytime`) and
  optional global `taskId` + `stepNumber`. Task checklists in the UI are read-only with automatic task/step/item time
  tracking, `update_task_item` embeds an immutable step snapshot inline so chat reloads keep exact step progress, inline
  widgets support three display modes (`minimized` single-row by default, `compact`, and `full`) plus Expand/Minimize
  controls configured via Dashboard **Settings** (`Default Widget Display` and `Step Widget Override`), **Tool Calls**
  includes **Clear History**, **Timeline** displays polymorphic session/group events, and the Dashboard auto-refreshes
  when
  database state changes. Numbered task steps exclude plan/workspace initialization.
- For live UI development, set `NEW_WORKER_DASHBOARD_HTML` / `NEW_WORKER_WIDGET_HTML` (or pass `--dashboard-html` /
  `--widget-html`) and refresh `new-worker_new-worker-ui` through **MCP Servers** settings or `RefreshMcpServers`.

## 6. Rule Budget Guardrail

Antigravity caps each rule file under `rules/` at `24,000` bytes and auto-loads every Markdown file inside `rules/`.
Keep only `rules/AGENTS.md` inside `rules/`.
