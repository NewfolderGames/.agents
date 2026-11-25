# Generic Host Adapter

Use this adapter on Codex, Cursor, OpenCode, or any host not listed in [README.md](README.md).

## 1. Session and Scratch Directories

- **`<session-dir>`**: `.agents/sessions/<YYYYMMDD-HHMM>-<session-slug>/` inside the workspace using plain Markdown
  files.
- **VCS hygiene**: Inspect `.gitignore` or `.git/info/exclude` before creating `.agents/sessions/` and never stage or
  commit session documents unless the user explicitly asks to commit them.
- **`<scratch-dir>`**: Create a private external directory with `mktemp -d "${TMPDIR:-/tmp}/project-scout-XXXXXX"` (mode
  `0700`), write `scout-<repo-slug>.md` inside it, and report the path in the handoff so the caller can remove it after
  reading.

## 2. Links and Capability Fallbacks

- **Links**: Use relative `./NN-<slug>.<role>.md` links between sibling session files and workspace-relative `path:line`
  citations for source code.
- **Structured user prompts**: Present numbered options in plain chat text when no interactive question tool exists,
  or read the plain-text fallback returned by `ask_questions` when `new-worker-ui` is registered as a stdio MCP server
  (`node <plugin-root>/mcp-app/dist/server.mjs --data-dir=<path>`).
- **Web search**: Cite canonical book titles, official documentation page headings, and exact search keywords rather
  than unverified URLs when web search is unavailable.
- **Pre-scan script (`new::project-scout`)**: Run `<plugin-root>/scripts/scout_prescan.py` when `python3` and the script
  are
  accessible. Otherwise run the batched read-only `git` or pruned `find` fallback documented
  in [../agents/project-scout.md](../agents/project-scout.md) in Direct Single-Agent Path, and return the compact
  handoff summary in your final text reply.
