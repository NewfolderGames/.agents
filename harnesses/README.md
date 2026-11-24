# Harness Adapters

Core rules, skills, templates, and agent instructions use abstract capability terms so they stay portable across coding
agents. Load only the single adapter matching your active host before writing session or scratch files, invoking host
MCP tools, prompting with structured UI, or launching subagents.

## 1. Host Detection and Adapter Index

| Host                | Detection Signals                                                                                  | Adapter File                     |
|---------------------|----------------------------------------------------------------------------------------------------|----------------------------------|
| **Antigravity**     | `<Artifact Directory Path>`, `ArtifactMetadata`, `invoke_subagent`, or `~/.gemini/config/plugins/` | [antigravity.md](antigravity.md) |
| **JetBrains Junie** | JetBrains IDE Junie environment or `.junie/` workspace configuration                               | [junie.md](junie.md)             |
| **Claude Code**     | `Read`/`Edit`/`Write`/`Bash`/`Agent` toolset or `~/.claude/` configuration                         | [claude-code.md](claude-code.md) |
| **Generic / Other** | Codex, Cursor, OpenCode, or any unlisted host                                                      | [generic.md](generic.md)         |

## 2. Abstract Capability Mapping

| Capability                              | Antigravity                                                              | JetBrains Junie                              | Claude Code                                      | Generic                                    |
|-----------------------------------------|--------------------------------------------------------------------------|----------------------------------------------|--------------------------------------------------|--------------------------------------------|
| **File Reader / Editor / Writer**       | `read_file` / `edit_file` / `write_file`                                 | Native file tools                            | `Read` / `Edit` / `Write`                        | Host built-in file tools                   |
| **Shell Runner**                        | `run_command` (+ `manage_task`)                                          | Native terminal tool                         | `Bash`                                           | Host shell tool                            |
| **Structured User Prompt**              | `ask_question`                                                           | Native prompt or numbered chat options       | `AskUserQuestion`                                | Numbered chat options                      |
| **Web Search**                          | `search_web`                                                             | Native search or doc citations               | `WebSearch`                                      | Search tool or doc citations               |
| **Subagent Launcher & Handoff**         | `invoke_subagent` (`Model: "flash"`), `send_message`, `manage_subagents` | Native subagent or direct execution fallback | `Agent` (fast tier), final reply                 | Subagent tool or direct execution          |
| **MCP Tool Invocation**                 | `mcp_<server>_<tool>` or `<appDataDir>/mcp/` + `call_mcp_tool`           | Native MCP tools directly                    | Native MCP tools directly                        | Native MCP tools directly                  |
| **Session Directory (`<session-dir>`)** | `<Artifact Directory Path>` (`ArtifactMetadata`)                         | `.junie/plans/<YYYYMMDD-HHMM>-<slug>/`       | `~/.claude/plans/<repo>/<YYYYMMDD-HHMM>-<slug>/` | `.agents/sessions/<YYYYMMDD-HHMM>-<slug>/` |
| **Scratch Directory (`<scratch-dir>`)** | `<Artifact Directory Path>/scratch/` (no `ArtifactMetadata`)             | External dir or `mktemp -d`                  | `~/.claude/plans/<repo>/scratch/` or `mktemp -d` | `mktemp -d` (`0700`)                       |
| **Link Format**                         | Absolute `file:///...`                                                   | Relative `./` sibling + repo path            | Relative `./` sibling + repo path                | Relative `./` sibling + repo path          |
| **Approval UI**                         | Reply approval or `Proceed` button                                       | Reply approval                               | Reply approval                                   | Reply approval                             |

## 3. Runtime Metadata Boundary

`plugin.json` and the YAML `tools:`, `subagent:`, and `mainAgent:` frontmatter keys in `agents/*.md` remain
Antigravity-compatible runtime declarations. All Markdown prose inside `rules/`, `references/`, `skills/`, and `agents/`
bodies stays harness-agnostic.

## 4. Multi-Harness Installation and Wiring

- **Antigravity**: Clone or copy this repository into `~/.gemini/config/plugins/my-agents/`. Antigravity auto-discovers
  `plugin.json`, `rules/AGENTS.md`, `skills/*/SKILL.md`, and `agents/*.md`.
- **JetBrains Junie**: Clone this repository outside target workspaces, reference or symlink `rules/AGENTS.md` in your
  Junie project or user guidelines, and point Junie's skill paths to `<plugin-root>/skills/` (see [junie.md](junie.md)).
- **Claude Code**: Reference or symlink `rules/AGENTS.md` from `~/.claude/CLAUDE.md` (or a repository `CLAUDE.md`) and
  register `<plugin-root>/skills/` and `<plugin-root>/agents/` in your Claude Code configuration
  (see [claude-code.md](claude-code.md)).
- **Generic `AGENTS.md` Hosts**: Point your host's global instructions file to `rules/AGENTS.md` and register
  `<plugin-root>/skills/` for progressive skill loading (see [generic.md](generic.md)).
