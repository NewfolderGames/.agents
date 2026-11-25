# Claude Code Host Adapter

Use this adapter when running inside Claude Code (`Read`/`Edit`/`Write`/`Bash`/`Agent` toolset or `~/.claude/`).

## 1. Wiring and Discovery

- Reference or symlink `rules/AGENTS.md` from `~/.claude/CLAUDE.md` (or a repository `CLAUDE.md`).
- Register `<plugin-root>/skills/` and `<plugin-root>/agents/` via Claude Code plugin paths or `~/.claude/` directories.

## 2. Session and Scratch Directories

- **`<session-dir>`**: `~/.claude/plans/<repo-slug>/<YYYYMMDD-HHMM>-<session-slug>/` using plain Markdown files.
- **`<scratch-dir>`**: Use `~/.claude/plans/<repo-slug>/scratch/` or `mktemp -d "${TMPDIR:-/tmp}/project-scout-XXXXXX"`
  (mode `0700`), strictly outside the target repository tree.

## 3. Links and Tool Mapping

- **Links**: Use relative `./NN-<slug>.<role>.md` links between sibling session files and workspace-relative `path:line`
  citations for source code.
- **Tool mapping**:
    - File reader / editor / writer: `Read` / `Edit` / `Write`
    - Shell runner: `Bash`
    - Structured user prompt: `AskUserQuestion`
    - Web search: `WebSearch`
    - Subagent launcher: `Agent`
    - MCP tools: Invoke advertised MCP server tools directly.

## 4. Subagents (`new::project-scout`)

- Select a fast, lightweight model tier (such as Haiku) when spawning `new::project-scout` and
  `new::project-scout-worker` via
  `Agent`.
- Locate the pre-scan script at `<plugin-root>/scripts/scout_prescan.py`.
- When no separate inter-agent messaging tool is exposed, return the compact handoff summary as the subagent's final
  response.
