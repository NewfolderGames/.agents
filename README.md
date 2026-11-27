# Newfolder Agent Plugins Monorepo

This repository packages modular, harness-agnostic plugins for AI coding agents under `plugins/`, split by concern so
each plugin can be enabled or installed independently.

## Plugins

| Plugin                | Path                                                              | Scope                                                                                                                | Bundled Skills & Subagents                                                                        |
|-----------------------|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| **new-worker**        | [plugins/new-worker/](plugins/new-worker/README.md)               | Core safety gates, Mode 1 chat flow, host-native artifact workflow, documentation, IDE escalation, and repo scouting | `new::ask`, `new::docs`, `new::tools-intellij`, `new::project-scout`, `new::project-scout-worker` |
| **new-personal**      | [plugins/new-personal/](plugins/new-personal/README.md)           | Personal code style, deletable architecture, caller-focused error design, functional pipelines, and untangling       | `new::code`                                                                                       |
| **new-framework-web** | [plugins/new-framework-web/](plugins/new-framework-web/README.md) | Web frontend framework and stylesheet conventions                                                                    | `new::rscss`                                                                                      |
| **new-learning**      | [plugins/new-learning/](plugins/new-learning/README.md)           | Self-learning DIY coaching (`guide` and `active` Socratic pair-coding modes)                                         | `new::learning-diy`                                                                               |

## Installation

### Antigravity

Clone this repository into `~/.gemini/config/plugins/my-agents/` (or anywhere on disk) and register its `plugins/`
directory in `~/.gemini/config/plugins.json` using an absolute path:

```json
{
  "entries": [
    {
      "path": "/home/<user>/.gemini/config/plugins/my-agents/plugins"
    }
  ]
}
```

Alternatively, copy or symlink individual subdirectories from `plugins/*` directly into `~/.gemini/config/plugins/`.

### JetBrains Junie

This repository includes a Junie marketplace manifest at `.junie-extension/marketplace.json` and `extension.json`
manifests under each plugin directory (`plugins/*`). Add `NewfolderGames/.agents` (or a local clone path) as a Junie
marketplace and enable any combination of `new-worker`, `new-personal`, `new-framework-web`, and `new-learning`.

### Other Harnesses (Claude Code, Generic)

Read [plugins/new-worker/harnesses/README.md](plugins/new-worker/harnesses/README.md) for host detection, abstract
capability mappings, and setup steps across JetBrains Junie, Claude Code, and generic `AGENTS.md` hosts (Codex, Cursor,
OpenCode).

## Prerequisites

- `ripgrep` (`rg`) for fast text search
- `python3` for batch scripts, structural analysis, and `plugins/new-worker/scripts/scout_prescan.py`
- `pnpm` as the default Node.js package manager when a project lockfile does not specify one
- Optional: JetBrains IDE with MCP server enabled (`idea` or `jetbrains_air_ide`) when using `new::tools-intellij`

## Extra Plugin Recommendations

- [agy-fast](https://github.com/INK-Q/agy-fast): Faster Google Antigravity
- [ast-grep](https://github.com/ast-grep/agent-skill): `ast-grep` tool usage
- [elephant-goldfish-model](https://github.com/google/elephant-goldfish-model): Review looper
- [modern-web-guidance](https://github.com/googlechrome/modern-web-guidance): Guide for using newer web technologies

## Citations

External sources adapted across the plugins in this repository:

- **`new-personal` (`skills/code/`)**:
  - Roman Kashitsyn (2022). [*Designing error types in Rust*](https://mmapped.blog/posts/12-rust-error-handling).
  - The Rust Standard Library. [*When to use `panic!` vs `Result`*](https://doc.rust-lang.org/std/macro.panic.html#when-to-use-panic-vs-result).
  - Alexis King (2019). [*Parse, don't validate*](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).
- **`new-worker` (`rules/AGENTS.md` and `skills/docs/`)**:
  - [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/).
  - Thomas Hikaru Clark, Matias B. Martin, and Kyle Mahowald (2026). [*Why is AI-generated language so hard to understand?*](https://arxiv.org/abs/2610.29162) (`arXiv:2610.29162`).
  - [eGovFramework Documentation (`egovframe-docs`)](https://github.com/eGovFramework/egovframe-docs).
- **`new-framework-web` (`skills/rscss/`)**:
  - Rico Sta. Cruz. [*RSCSS (Reasonable System for CSS Stylesheet Structure)*](https://ricostacruz.com/rscss/).
