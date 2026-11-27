# Generic Host Adapter

Use this adapter on Codex, Cursor, OpenCode, or any host not listed in [README.md](README.md).

## 1. Native Artifacts and Scratch Directory

- **Native artifacts**: Follow the active host's built-in plan, task, or chat workflow. If the host stores temporary
  session files inside `.agents/sessions/` in the workspace, inspect `.gitignore` or `.git/info/exclude` first and never
  stage or commit them unless the user explicitly asks to commit them.
- **`<scratch-dir>`**: Create a private external directory with `mktemp -d "${TMPDIR:-/tmp}/project-scout-XXXXXX"` (mode
  `0700`), write `scout-<repo-slug>.md` inside it, and report the path in the handoff so the caller can remove it after
  reading.

## 2. Links and Capability Fallbacks

- **Links**: Use workspace-relative `path:line` citations for source code.
- **Structured user prompts**: Present numbered options in plain chat text when no interactive question tool exists.
- **Web search**: Cite canonical book titles, official documentation page headings, and exact search keywords rather
  than unverified URLs when web search is unavailable.
- **Pre-scan script (`new::project-scout`)**: Run `<plugin-root>/scripts/scout_prescan.py` when `python3` and the script
  are
  accessible. Otherwise run the batched read-only `git` or pruned `find` fallback documented
  in [../agents/project-scout.md](../agents/project-scout.md) in Direct Single-Agent Path, and return the compact
  handoff summary in your final text reply.
