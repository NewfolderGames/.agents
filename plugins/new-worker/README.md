# new-worker

Harness-agnostic agent task execution bundle covering operational safety gates, Mode 1 chat flow, multi-task session
planning, Practical Software STE documentation, IntelliJ IDE MCP escalation, and read-only repository scouting.

## Prerequisites

- `node` (`>= 22.13`) to run the bundled `new-worker-ui` MCP server (`mcp-app/dist/server.mjs`, using built-in
  `node:sqlite`)
- `ripgrep` (`rg`) for fast text search
- `python3` for batch scripts and `scripts/scout_prescan.py`
- `pnpm` for building or testing `mcp-app/` during plugin development
- Optional: JetBrains IDE with MCP server enabled (`intellij` or `jetbrains_air_ide`) when using `new::tools-intellij`

## Contents

| Path                             | Purpose                                                                                                                                                                                                                          |
|----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `plugin.json`                    | Plugin manifest (`new-worker`)                                                                                                                                                                                                   |
| `mcp_config.json`                | Registers the stdio `new-worker-ui` MCP App server (`mcp-app/dist/server.mjs`)                                                                                                                                                   |
| `mcp-app/`                       | TypeScript SEP-1865 MCP server (`server/` with SQLite + Drizzle ORM), separated Dashboard and Widget React + Vite Web UIs (`src/`), and committed runtime bundles (`dist/server.mjs`, `dist/dashboard.html`, `dist/widget.html`) |
| `rules/AGENTS.md`                | Always-on rules covering precedence, safety gates, Mode 1 chat flow, session triggers, toolchain defaults, prose baseline, and skill/subagent routing                                                                            |
| `harnesses/`                     | Host adapters (`README.md`, `antigravity.md`, `junie.md`, `claude-code.md`, `generic.md`) mapping abstract capabilities to host tools and directories                                                                            |
| `references/session-contract.md` | Canonical specification for `<session-dir>`, `<scratch-dir>`, global `taskId` / `NNN` artifact naming, mutability rules, and language parity                                                                                     |
| `scripts/`                       | Zero-dependency repository pre-scan CLI (`scout_prescan.py`) and unit tests (`test_scout_prescan.py`) owned by `new::project-scout`                                                                                              |
| `agents/project-scout.md`        | `new::project-scout`: Repository-read-only scout orchestrator with single-pass pre-scan and parallel worker fan-out                                                                                                              |
| `agents/project-scout-worker.md` | `new::project-scout-worker`: Read-only partition analyst started by `new::project-scout` with disjoint file assignments                                                                                                          |
| `skills/ask/`                    | `new::ask`: Explicit-activation questioning workflow for multi-round planning interrogation and configurable execution check-ins (`Frequent` / `Less frequent` / `None`)                                                         |
| `skills/task/`                   | `new::task`: Multi-task session hub (`tasks.md`), immutable plans (`NN-<slug>.plan.md`), scaffold-first phases, atomic commits, and dual-mode reports (`NN-<slug>.report.md`)                                                    |
| `skills/docs/`                   | `new::docs`: Practical Software STE and anti-compression readability rules plus `references/` for slop substitutions, domain templates, and Korean style guide                                                                   |
| `skills/tools-intellij/`         | `new::tools-intellij`: IntelliJ IDE MCP escalation rules and language-specific reference guides (`tools-reference.md`, JVM, Go, Python, PHP, SQL, CMake/native)                                                                  |

## Multi-Harness Setup

Read [harnesses/README.md](harnesses/README.md) for host detection, capability mappings, and wiring instructions across
Antigravity, JetBrains Junie, Claude Code, and generic `AGENTS.md` hosts.

## MCP App Web UI Development

Prebuilt bundles (`mcp-app/dist/server.mjs`, `mcp-app/dist/dashboard.html`, and `mcp-app/dist/widget.html`) are
committed
so the plugin runs immediately after cloning. Persistent state lives in a SQLite database (`new-worker.sqlite`) managed
via Drizzle ORM with forward-only transactional migrations (creating timestamped `.bak` backups before upgrading
existing
databases) inside `--data-dir` (set to `${PLUGIN_DATA}` in `mcp_config.json`, falling back to `mcp-app/data/`). Read
tools (`open_workspace`, `query_workspace`, `query_timeline`, `app_get_dashboard_state`, and `app_get_widget_state`)
write zero database rows. Features include global integer task IDs starting at `1`, 1:N multi-session grouping,
optional session `rootDir` metadata, polymorphic timeline tracking (`timeline_events` + `timeline_links`), isolated
inline widgets (`minimized`, `compact`, and `full` display modes), automatic task/step/item time tracking, and a tool
call history clear button. For local development (`dev` serves `/dashboard` and `/widget/:name` preview routes) or UI
edits:

```bash
pnpm --dir plugins/new-worker/mcp-app install
pnpm --dir plugins/new-worker/mcp-app test
pnpm --dir plugins/new-worker/mcp-app build
```

Set `NEW_WORKER_DASHBOARD_HTML` / `NEW_WORKER_WIDGET_HTML` (or pass `--dashboard-html` / `--widget-html`) when
iterating on UI bundles without rebuilding the server, then refresh `new-worker_new-worker-ui` in Antigravity's **MCP
Servers** settings.

## Citations

- [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/).
- Thomas Hikaru Clark, Matias B. Martin, and Kyle Mahowald (2026). [*Why is AI-generated language so hard to
  understand?*](https://arxiv.org/abs/2610.29162) (`arXiv:2610.29162`).
- [eGovFramework Documentation (`egovframe-docs`)](https://github.com/eGovFramework/egovframe-docs).
