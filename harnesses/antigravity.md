# Antigravity Host Adapter

Use this adapter when running inside Google Antigravity (`<Artifact Directory Path>`, `ArtifactMetadata`,
`invoke_subagent`, or `~/.gemini/config/plugins/`).

## 1. Paths and Pre-Scan Script

- **Plugin root**: `~/.gemini/config/plugins/my-agents/` (or `.agents/plugins/my-agents/` in workspace installs).
- **Pre-scan script**: `~/.gemini/config/plugins/my-agents/scripts/scout_prescan.py` (fallback:
  `.agents/plugins/my-agents/scripts/scout_prescan.py`).

## 2. Session and Scratch Artifacts

- **`<session-dir>`**: `<Artifact Directory Path>` (`<appDataDir>/brain/<conversation-id>/`). When writing session
  documents with `write_file` or `edit_file`, pass `Overwrite: true` and set `ArtifactMetadata` when exposed:
    - `NN-<slug>.plan.md` awaiting review: `UserFacing: true`, `RequestFeedback: true`.
    - `tasks.md`, `NN-<slug>.report.md`, `NN-<slug>.diy-guide.md`, `NN-<slug>.learning-log.md`: `UserFacing: true`,
      `RequestFeedback: false`.
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

## 4. Subagent Model and Invocation (`project-scout`)

- Antigravity ignores `model:` frontmatter on `agents/*.md` and defaults `invoke_subagent` to `inherit`. Always pass
  `Model: "flash"` explicitly when invoking `project-scout` and `project-scout-worker`.
- Pass `Workspace: "inherit"` and an explicit `OutputPath` under `<Artifact Directory Path>/scratch/` to
  `project-scout`.
- Stop calling tools and wait for reactive wakeup after launching subagents instead of polling in a loop.

## 5. MCP Tool Invocation (`my-using-intellij`)

- Call eagerly registered MCP tools directly (`mcp_<server>_<toolName>`).
- For lazy-loaded MCP tools, inspect `<appDataDir>/mcp/<server>/<toolName>.json` for exact schemas, then invoke
  `call_mcp_tool` with `ServerName`, `ToolName`, and `Arguments`.

## 6. Rule Budget Guardrail

Antigravity caps each rule file under `rules/` at `24,000` bytes and auto-loads every Markdown file inside `rules/`.
Keep only `rules/AGENTS.md` inside `rules/`.
