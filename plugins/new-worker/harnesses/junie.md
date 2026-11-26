# JetBrains Junie Host Adapter

Use this adapter when running inside JetBrains Junie.

## 1. Wiring and Discovery

- Reference or symlink `rules/AGENTS.md` into your Junie guidelines configuration.
- Expose `<plugin-root>/skills/<name>/SKILL.md` through Junie's skill configuration or `.junie/` directory.

## 2. Session and Scratch Directories

- **`<session-dir>`**: `.junie/plans/<YYYYMMDD-HHMM>-<session-slug>/` using plain Markdown files (no artifact metadata
  object).
- **VCS hygiene**: Inspect `.gitignore` or `.git/info/exclude` before creating `.junie/plans/` and never stage or commit
  session documents unless the user explicitly requests committing them.
- **`<scratch-dir>`**: Write scratch files (such as `scout-<repo>.md`) to a writable directory outside the target
  repository, or create a private directory with `mktemp -d "${TMPDIR:-/tmp}/project-scout-XXXXXX"` (mode `0700`).

## 3. Links, Tools, and MCP

- **Links**: Use relative `./NN-<slug>.<role>.md` links between sibling session files so the directory stays portable,
  and standard workspace-relative `path:line` paths for source citations.
- **Tools**: Use Junie's native file, terminal, prompt, and web tools directly.
- **IntelliJ MCP**: Invoke advertised `intellij` or `jetbrains_air_ide` MCP tools directly without a lazy-loader
  wrapper.
- **Optional `new-worker-ui` stdio server**: Register `node <plugin-root>/mcp-app/dist/server.mjs --data-dir=<path>`
  (Node `>= 22.13`) as a stdio MCP server when structured SQLite tracking is wanted, passing `exportDir` (plus optional
  `rootDir` / `groupId`) for `.junie/plans/...` Markdown sync. When unconfigured, write Markdown session files directly.

## 4. Subagent Fallback (`new::project-scout`)

- Locate the pre-scan script at `<plugin-root>/scripts/scout_prescan.py` (or a caller-provided `PrescanScript`).
- If Junie does not auto-register `agents/*.md` as invokable subagents, execute the workflow in
  `<plugin-root>/agents/project-scout.md` directly (using Direct Single-Agent Path when parallel subagents are
  unavailable) and deliver the compact handoff summary in your reply.
