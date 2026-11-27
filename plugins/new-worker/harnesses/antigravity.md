# Antigravity Host Adapter

Use this adapter when running inside Google Antigravity (`<Artifact Directory Path>`, `ArtifactMetadata`,
`invoke_subagent`, or `~/.gemini/config/plugins/`).

## 1. Paths and Pre-Scan Script

- **Plugin root**: `~/.gemini/config/plugins/my-agents/plugins/new-worker/` (or `~/.gemini/config/plugins/new-worker/`
  or `.agents/plugins/new-worker/` in standalone installs).
- **Pre-scan script**: `~/.gemini/config/plugins/my-agents/plugins/new-worker/scripts/scout_prescan.py` (fallback:
  `~/.gemini/config/plugins/new-worker/scripts/scout_prescan.py` or
  `.agents/plugins/new-worker/scripts/scout_prescan.py`).

## 2. Native Artifacts and Scratch Directory

- **Native artifacts**: Write Antigravity's native planning, task, and walkthrough artifacts inside
  `<Artifact Directory Path>` (`<appDataDir>/brain/<conversation-id>/`), passing `Overwrite: true` and
  `ArtifactMetadata` when exposed.
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

## 5. MCP Tool Invocation (`new::tools-intellij`)

- Call eagerly registered MCP tools directly (`mcp_<server>_<toolName>`).
- For lazy-loaded MCP tools, inspect `<appDataDir>/mcp/<server>/<toolName>.json` for exact schemas, then invoke
  `call_mcp_tool` with `ServerName`, `ToolName`, and `Arguments`.

## 6. Rule Budget Guardrail

Antigravity caps each rule file under `rules/` at `24,000` bytes and auto-loads every Markdown file inside `rules/`.
Keep only `rules/AGENTS.md` inside `rules/` (and mirror it in `guidelines/AGENTS.md` for Junie compatibility).
