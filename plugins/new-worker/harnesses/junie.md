# JetBrains Junie Host Adapter

Use this adapter when running inside JetBrains Junie.

## 1. Wiring and Discovery

- Install `new-worker` from the repository's Junie marketplace (`.junie-extension/marketplace.json`), or reference
  `guidelines/AGENTS.md` (or `rules/AGENTS.md`) and expose `<plugin-root>/skills/<name>/SKILL.md` through Junie's
  skill configuration.

## 2. Native Artifacts and Scratch Directory

- **Native artifacts**: Follow Junie's built-in plan and task workflow. When `.junie/plans/` is used inside a workspace,
  inspect `.gitignore` or `.git/info/exclude` first and never stage or commit temporary session files unless the user
  explicitly requests committing them.
- **`<scratch-dir>`**: Write scratch files (such as `scout-<repo>.md`) to a writable directory outside the target
  repository, or create a private directory with `mktemp -d "${TMPDIR:-/tmp}/project-scout-XXXXXX"` (mode `0700`).

## 3. Links, Tools, and MCP

- **Links**: Use workspace-relative `path:line` paths for source citations and relative links when referencing local
  documents.
- **Tools**: Use Junie's native file, terminal, prompt, and web tools directly.
- **IntelliJ MCP**: Invoke advertised `intellij` or `jetbrains_air_ide` MCP tools directly without a lazy-loader
  wrapper.

## 4. Subagent Fallback (`new::project-scout`)

- Locate the pre-scan script at `<plugin-root>/scripts/scout_prescan.py` (or a caller-provided `PrescanScript`).
- If Junie does not auto-register `agents/*.md` as invokable subagents, execute the workflow in
  `<plugin-root>/agents/project-scout.md` directly (using Direct Single-Agent Path when parallel subagents are
  unavailable) and deliver the compact handoff summary in your reply.
